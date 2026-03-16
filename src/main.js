import * as THREE from 'three';
import { initScene } from './scene/scene.js';
import { initCamera } from './scene/camera.js';
import { initLights } from './scene/lighting.js';
import { initPlane } from './scene/plane.js';
import { ModelManager, MODELS } from './models/modelLoader.js';
import { initHandTracker } from './hand/handTracker.js';
import { HandVisualizer } from './hand/landmarks.js';
import { GreenBandHandFilter } from './hand/greenBandFilter.js';
import { KeypointClassifier } from './hand/keypointClassifier.js';
import { updateStatus } from './ui/overlay.js';
import { initControls } from './ui/controls.js';
import { GeminiService } from './ai/geminiService.js';
import { castRay } from './interaction/raycaster.js';
import { translator } from './i18n/translator.js';

const videoElem = document.getElementsByClassName('input_video')[0];
const canvasElem = document.getElementsByClassName('output_canvas')[0];

globalThis.__handspaceModuleLoaded = true;

// ── Camera orbit/zoom helpers (from optimized gesture system) ──

function getCameraSpherical(controls) {
    const camera = controls?.object;
    const target = controls?.target;
    if (!camera || !target) return null;

    const offset = new THREE.Vector3().subVectors(camera.position, target);
    const radius = offset.length();
    if (radius === 0) return null;

    const theta = Math.atan2(offset.x, offset.z);
    const phi = Math.acos(THREE.MathUtils.clamp(offset.y / radius, -1, 1));
    return { radius, theta, phi };
}

function setCameraSpherical(controls, { radius, theta, phi }) {
    const camera = controls?.object;
    const target = controls?.target;
    if (!camera || !target) return;

    const eps = 1e-3;
    const clampedPhi = THREE.MathUtils.clamp(phi, eps, Math.PI - eps);

    const offset = new THREE.Vector3(
        radius * Math.sin(clampedPhi) * Math.sin(theta),
        radius * Math.cos(clampedPhi),
        radius * Math.sin(clampedPhi) * Math.cos(theta)
    );

    camera.position.copy(target).add(offset);
    camera.lookAt(target);
}

function zoomCamera(controls, zoomDelta, { minDistance, maxDistance }) {
    const camera = controls?.object;
    const target = controls?.target;
    if (!camera || !target) return;

    const offset = new THREE.Vector3().subVectors(camera.position, target);
    const radius = offset.length();
    if (radius === 0) return;

    const nextRadius = THREE.MathUtils.clamp(radius * Math.exp(-zoomDelta), minDistance, maxDistance);
    offset.normalize().multiplyScalar(nextRadius);
    camera.position.copy(target).add(offset);
    camera.lookAt(target);
}

function getStableHandCenter(hand) {
    const idx = [0, 5, 9, 13, 17];
    let sumX = 0;
    let sumY = 0;
    for (let i = 0; i < idx.length; i++) {
        const p = hand[idx[i]];
        sumX += p.x;
        sumY += p.y;
    }
    return { x: sumX / idx.length, y: sumY / idx.length };
}

// ── App State ──

let sceneObj, rendererObj, cameraObj, orbitControls;
let modelMgr, handViz;
let greenBandFilter;
let keypointClassifier;
let selectedMesh = null;
let targetMarker;
let attachedMesh = null;
let attachedLocalPoint = null;

// Gesture state
let lastActionUpdateMs = 0;
let lastStatusText = '';
let actionHistory = [];
let currentAction = { label: null, confidence: 0 };
let lastRawAction = { label: null, confidence: 0, text: '' };
let orbitUntilMs = 0;
let orbitPrevPos = null;
let lastOrbitDxDy = null;
let orbitVel = { x: 0, y: 0 };
let orbitAnglesTarget = null;
let orbitAnglesCurrent = null;
let zoomUntilMs = 0;
let zoomPrevY = null;
let zoomVel = 0;
let lastRenderMs = 0;
let orbitActive = false;
let zoomActive = false;
const gestureDebug = (typeof localStorage !== 'undefined') && localStorage.getItem('gestureDebug') === '1';

// Orbit tuning constants
const ORBIT_ENGAGE_CONF = 0.20;
const ORBIT_RELEASE_CONF = 0.20;
const ORBIT_HOLD_MS = 650;
const ORBIT_DEADZONE = 0.00034;
const ORBIT_VEL_GAIN = 125.0;
const ORBIT_ALPHA = 0.12;
const ORBIT_MAX_VEL = 6.5;
const ORBIT_SPEED_MULT = 4.2;
const ORBIT_TRACK_LOSS_GRACE_MS = 450;
const ORBIT_VEL_EPS = 0.02;
const ORBIT_ANGLE_SMOOTH_RATE = 22.0;

// Zoom tuning constants
const ZOOM_ENGAGE_CONF = 0.20;
const ZOOM_RELEASE_CONF = 0.20;
const ZOOM_HOLD_MS = 650;
const ZOOM_DEADZONE = 0.00036;
const ZOOM_VEL_GAIN = 140.0;
const ZOOM_ALPHA = 0.14;
const ZOOM_MAX_VEL = 7.5;
const ZOOM_SPEED_MULT = 3.8;
const ZOOM_TRACK_LOSS_GRACE_MS = 450;
const ZOOM_VEL_EPS = 0.02;
const ZOOM_MIN_DISTANCE = 0.9;
const ZOOM_MAX_DISTANCE = 12.0;

// ── Init ──

function init() {
    updateStatus('Booting...');
    try {
        ({ scene: sceneObj, renderer: rendererObj } = initScene(canvasElem));
        ({ camera: cameraObj, controls: orbitControls } = initCamera(rendererObj));

        sceneObj.add(cameraObj);

        initLights(sceneObj);
        initPlane(sceneObj);

        modelMgr = new ModelManager(sceneObj);
        handViz = new HandVisualizer(cameraObj);
        greenBandFilter = new GreenBandHandFilter({ greenLockMs: 1000, lockDistancePx: 160 });
        keypointClassifier = new KeypointClassifier({ cacheBust: true });
        keypointClassifier.load();

        // --- LANDING PAGE LOGIC ---
        const landingPage = document.getElementById('landing-page');
        const btnStart = document.getElementById('btn-start-app');
        const uiContainer = document.getElementById('ui-container');
        const modelMenu = document.getElementById('model-menu');

        modelMenu.classList.add('hidden');

        btnStart.addEventListener('click', async () => {
            await modelMgr.loadUploadedModels();
            initControls(modelMgr, orbitControls);

            landingPage.style.opacity = 0;
            setTimeout(() => {
                landingPage.classList.add('hidden');
            }, 500);

            uiContainer.classList.remove('hidden');
            modelMenu.classList.remove('hidden');

            // Apply Preferences (Auto-Rotate)
            const prefs = JSON.parse(localStorage.getItem('handspace_prefs') || '{}');
            if (orbitControls) {
                orbitControls.autoRotate = !!prefs.autoRotate;
                orbitControls.autoRotateSpeed = 2.0;
            }

            // Check URL for specific model
            const urlParams = new URLSearchParams(window.location.search);
            const specificModel = urlParams.get('model');

            if (specificModel) {
                modelMgr.load(specificModel);
            } else {
                modelMgr.load(MODELS[0].file);
            }

            // Start hand tracking
            initHandTracker(videoElem, processHandData, {
                maxFps: 30, width: 640, height: 480, maxNumHands: 1, modelComplexity: 0
            });
        });

        // --- AI INTEGRATION ---
        const geminiSvc = new GeminiService();
        let isAiMode = false;
        let currentLanguage = 'English';

        // --- GESTURE GUIDE TOGGLE ---
        const btnToggleGuide = document.getElementById('btn-toggle-guide');
        const gestureGuide = document.getElementById('gesture-guide');

        if (btnToggleGuide && gestureGuide) {
            btnToggleGuide.addEventListener('click', () => {
                gestureGuide.classList.toggle('minimized');
                btnToggleGuide.textContent = gestureGuide.classList.contains('minimized') ? '\u{1F590}\uFE0F' : '\u2212';
            });
        }

        // --- GENERIC MODEL VARIANT TOGGLE ---
        const btnVariant = document.getElementById('btn-toggle-variant');

        const variantGroups = [
            {
                name: 'heart',
                files: ['heart.glb', 'beating_heart_3D.glb'],
                icons: ['\u{1FAC0}', '\u{1F493}']
            },
            {
                name: 'brain',
                files: ['colored_brain_model.glb', 'brain_model_right_-_general_anatomy.glb'],
                icons: ['\u{1F9E0}', '\u{1F9EC}']
            }
        ];

        let currentVariantGroup = null;
        let currentVariantIndex = -1;
        let isTransitioning = false;

        const loadModelOriginal = modelMgr.load.bind(modelMgr);

        modelMgr.load = function (file, onLoaded = null) {
            loadModelOriginal(file, onLoaded);

            setTimeout(() => {
                if (btnVariant) {
                    const group = variantGroups.find(g => g.files.includes(file));

                    if (group) {
                        currentVariantGroup = group;
                        currentVariantIndex = group.files.indexOf(file);
                        btnVariant.classList.remove('hidden');
                        btnVariant.textContent = group.icons[currentVariantIndex];
                        btnVariant.classList.toggle('active', currentVariantIndex > 0);
                    } else {
                        currentVariantGroup = null;
                        currentVariantIndex = -1;
                        btnVariant.classList.add('hidden');
                    }
                }
            }, 100);
        };

        if (btnVariant) {
            btnVariant.addEventListener('click', async function (e) {
                e.preventDefault();
                e.stopPropagation();

                if (isTransitioning || !currentVariantGroup) return;
                isTransitioning = true;

                const nextIndex = (currentVariantIndex + 1) % currentVariantGroup.files.length;
                const newModel = currentVariantGroup.files[nextIndex];

                await modelMgr.fadeOut(300);

                loadModelOriginal(newModel, () => {
                    modelMgr.fadeIn(400);
                });

                currentVariantIndex = nextIndex;
                btnVariant.textContent = currentVariantGroup.icons[currentVariantIndex];
                btnVariant.classList.toggle('active', currentVariantIndex > 0);

                setTimeout(async () => {
                    await modelMgr.fadeIn(400);
                    isTransitioning = false;
                }, 500);
            });
        }

        const btnAi = document.getElementById('btn-ask-gemini');
        const btnLang = document.getElementById('btn-lang');
        const cardAi = document.getElementById('gemini-card');
        const textAi = document.getElementById('gemini-response-text');
        const loaderAi = document.getElementById('ai-spinner');
        const btnClose = document.getElementById('btn-close-card');

        // --- AI IMAGE GENERATION ---
        const btnGenImage = document.getElementById('btn-generate-image');
        const imageModal = document.getElementById('ai-image-modal');

        if (btnGenImage && imageModal) {
            async function triggerImageGeneration() {
                const loadingEl = document.getElementById('ai-image-loading');
                const loadingText = document.getElementById('ai-image-loading-text');
                const imgEl = document.getElementById('ai-generated-image');
                const descEl = document.getElementById('ai-image-description');
                const errorEl = document.getElementById('ai-image-error');
                const downloadBtn = document.getElementById('btn-download-ai-image');
                const regenBtn = document.getElementById('btn-regenerate-image');

                imageModal.classList.remove('hidden');
                loadingEl.classList.remove('hidden');
                imgEl.classList.add('hidden');
                descEl.classList.add('hidden');
                errorEl.classList.add('hidden');
                downloadBtn.classList.add('hidden');
                regenBtn.classList.add('hidden');

                const meta = modelMgr.getCurrentModelMetadata();
                loadingText.textContent = `Generating AI image of "${meta.name}"...`;

                rendererObj.render(sceneObj, cameraObj);
                const screenshot = canvasElem.toDataURL('image/jpeg', 0.85);

                const result = await geminiSvc.generateImage(meta.name, screenshot);

                loadingEl.classList.add('hidden');

                if (result.image) {
                    imgEl.src = result.image;
                    imgEl.classList.remove('hidden');
                    descEl.textContent = result.text;
                    descEl.classList.remove('hidden');
                    downloadBtn.classList.remove('hidden');
                    regenBtn.classList.remove('hidden');
                } else {
                    errorEl.textContent = result.text || 'Failed to generate image.';
                    errorEl.classList.remove('hidden');
                    regenBtn.classList.remove('hidden');
                }
            }

            btnGenImage.addEventListener('click', triggerImageGeneration);

            document.getElementById('btn-close-image-modal').addEventListener('click', () => {
                imageModal.classList.add('hidden');
            });

            imageModal.addEventListener('click', (e) => {
                if (e.target === imageModal) imageModal.classList.add('hidden');
            });

            document.getElementById('btn-download-ai-image').addEventListener('click', () => {
                const imgEl = document.getElementById('ai-generated-image');
                if (!imgEl.src) return;
                const meta = modelMgr.getCurrentModelMetadata();
                const a = document.createElement('a');
                a.href = imgEl.src;
                a.download = `${meta.name.replace(/\s+/g, '_')}_AI_Generated.png`;
                a.click();
            });

            document.getElementById('btn-regenerate-image').addEventListener('click', triggerImageGeneration);
        }

        // Language Toggle
        const langMenu = document.getElementById('lang-menu');
        const langOptions = document.querySelectorAll('.lang-opt');

        btnLang.onclick = (e) => {
            e.stopPropagation();
            langMenu.classList.toggle('hidden');
        };

        window.addEventListener('click', (e) => {
            if (!e.target.closest('#lang-wrapper')) {
                langMenu.classList.add('hidden');
            }
        });

        langOptions.forEach(opt => {
            opt.onclick = async () => {
                const selectedLang = opt.dataset.lang;
                currentLanguage = selectedLang;

                langOptions.forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                langMenu.classList.add('hidden');

                await translator.load(selectedLang);
                translator.apply();

                if (currentLanguage === 'Hindi') {
                    textAi.innerText = "\u092D\u093E\u0937\u093E \u092C\u0926\u0932\u0940: \u0939\u093F\u0902\u0926\u0940";
                } else {
                    textAi.innerText = "Language switched: English";
                }
            };
            if (opt.dataset.lang === currentLanguage) opt.classList.add('active');
        });

        translator.load().then(() => translator.apply());

        // UI Toggle
        btnAi.onclick = () => {
            isAiMode = !isAiMode;
            if (isAiMode) {
                cardAi.classList.remove('hidden');
                btnAi.style.background = 'rgba(0, 242, 254, 0.4)';
                textAi.innerText = "Tap any part of the model to learn about it!";
            } else {
                cardAi.classList.add('hidden');
                btnAi.style.background = '';

                if (selectedMesh) {
                    selectedMesh.material = selectedMesh.userData.originalMat;
                    selectedMesh = null;
                    rendererObj.render(sceneObj, cameraObj);
                }
            }
        };

        btnClose.onclick = () => {
            isAiMode = false;
            cardAi.classList.add('hidden');
            btnAi.style.background = '';

            if (selectedMesh) {
                selectedMesh.material = selectedMesh.userData.originalMat;
                selectedMesh = null;
                rendererObj.render(sceneObj, cameraObj);
            }
        };

        // Create Target Marker (Red Sphere)
        const markerGeo = new THREE.SphereGeometry(0.05, 16, 16);
        const markerMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        targetMarker = new THREE.Mesh(markerGeo, markerMat);
        targetMarker.visible = false;
        sceneObj.add(targetMarker);

        // --- TTS FUNCTIONALITY ---
        let synth = window.speechSynthesis;

        function speakText(text, lang) {
            if (!synth) return;
            synth.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = lang === 'Hindi' ? 'hi-IN' : 'en-US';
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            const voices = synth.getVoices();
            const voice = voices.find(v => v.lang.includes(utterance.lang));
            if (voice) utterance.voice = voice;
            synth.speak(utterance);
        }

        // Interaction Listener (AI click)
        window.addEventListener('pointerdown', async (event) => {
            if (!isAiMode) return;
            if (event.target.closest('#ui-container')) return;
            if (event.target.closest('#lang-wrapper')) return;

            const hitData = castRay(event, cameraObj, sceneObj);

            if (hitData) {
                const hitMesh = hitData.object;
                loaderAi.classList.remove('hidden');
                synth.cancel();

                targetMarker.position.copy(hitData.point);
                targetMarker.visible = true;

                attachedMesh = hitMesh;
                attachedLocalPoint = hitMesh.worldToLocal(hitData.point.clone());

                rendererObj.render(sceneObj, cameraObj);

                const activeModelMeta = modelMgr.getCurrentModelMetadata();
                const screenshot = canvasElem.toDataURL('image/jpeg', 0.9);

                let aiData = { part_name: "Scanning...", description: "Please wait." };
                try {
                    const rawJson = await geminiSvc.explainMesh(
                        hitMesh.name,
                        activeModelMeta.name,
                        screenshot,
                        currentLanguage
                    );
                    const cleanJson = rawJson.replace(/```json/g, '').replace(/```/g, '').trim();

                    try {
                        aiData = JSON.parse(cleanJson);
                    } catch (jsonErr) {
                        const firstPeriod = cleanJson.indexOf('.');
                        const firstNewline = cleanJson.indexOf('\n');
                        let splitIndex = -1;

                        if (firstNewline !== -1 && firstNewline < 50) splitIndex = firstNewline;
                        else if (firstPeriod !== -1 && firstPeriod < 50) splitIndex = firstPeriod + 1;

                        if (splitIndex !== -1) {
                            aiData = {
                                part_name: cleanJson.substring(0, splitIndex).trim(),
                                description: cleanJson.substring(splitIndex).trim()
                            };
                        } else {
                            aiData = {
                                part_name: hitMesh.name,
                                description: cleanJson
                            };
                        }
                    }
                } catch (e) {
                    console.error("AI Error", e);
                    aiData = { part_name: "Error", description: "Could not analyze part." };
                }

                loaderAi.classList.add('hidden');

                const lineLayer = document.getElementById('line-layer');
                const annoContainer = document.getElementById('annotation-container');

                lineLayer.innerHTML = '';
                annoContainer.innerHTML = '';

                const p3d = hitData.point.clone();
                p3d.project(cameraObj);

                const x = (p3d.x * 0.5 + 0.5) * canvasElem.clientWidth;
                const y = (-(p3d.y * 0.5) + 0.5) * canvasElem.clientHeight;

                const labelX = x + 100;
                const labelY = y - 80;

                const lineHtml = `
                    <circle cx="${x}" cy="${y}" r="3" class="connector-dot" />
                    <path d="M ${x} ${y} L ${x + 50} ${y - 50} L ${labelX} ${y - 50}" fill="none" class="connector-line" />
                `;
                lineLayer.innerHTML = lineHtml;

                const labelDiv = document.createElement('div');
                labelDiv.className = 'annotation-label';
                labelDiv.style.left = `${labelX}px`;
                labelDiv.style.top = `${y - 50}px`;

                labelDiv.innerHTML = `
                    <span class="annotation-title">${aiData.part_name}</span>
                    <span class="annotation-desc">${aiData.description}</span>
                    <button class="annotation-speak-btn" id="btn-speak-anno">\u{1F50A} Listen</button>
                `;
                annoContainer.appendChild(labelDiv);

                const speakBtn = labelDiv.querySelector('#btn-speak-anno');
                if (speakBtn) {
                    speakBtn.addEventListener('pointerdown', (e) => {
                        e.stopPropagation();
                        const fullText = `${aiData.part_name}. ${aiData.description}`;
                        speakText(fullText, currentLanguage);
                    });
                }

                cardAi.classList.add('hidden');

            } else {
                targetMarker.visible = false;
                attachedMesh = null;
                rendererObj.render(sceneObj, cameraObj);
                document.getElementById('line-layer').innerHTML = '';
                document.getElementById('annotation-container').innerHTML = '';
                synth.cancel();
            }
        });

        // Listen for preference changes (Auto-Rotate dynamic update)
        window.addEventListener('storage', (e) => {
            if (e.key === 'handspace_prefs' && orbitControls) {
                const newPrefs = JSON.parse(e.newValue || '{}');
                orbitControls.autoRotate = !!newPrefs.autoRotate;
            }
        });

        renderLoop();
    } catch (e) {
        console.error('Init failed:', e);
        updateStatus(`Error: ${e?.message || 'Init failed'}`);
    }
}

// ── Hand Gesture Processing (new optimized system) ──

function processHandData(detectionResults) {
    handViz.hide();

    const filtered = greenBandFilter.filter(detectionResults);
    if (!filtered) {
        const nowMs = performance.now();
        const orbitCoasting = orbitActive && (nowMs < (orbitUntilMs + ORBIT_TRACK_LOSS_GRACE_MS));
        const zoomCoasting = zoomActive && (nowMs < (zoomUntilMs + ZOOM_TRACK_LOSS_GRACE_MS));
        const orbitInfo = orbitCoasting ? ' | Orbit: on' : '';
        const zoomInfo = zoomCoasting ? ' | Zoom: on' : '';
        const actionInfo = lastRawAction?.text ? ` | Action: ${lastRawAction.text}` : '';
        const statusText = `State: ${(orbitCoasting || zoomCoasting) ? 'TRACKING' : 'IDLE'} | Track: none | GreenHands: 0${actionInfo}${orbitInfo}${zoomInfo}`;
        if (statusText !== lastStatusText) {
            updateStatus(statusText);
            lastStatusText = statusText;
        }
        updateGestureHUD({ gesture: 'No hand', greenBand: false, orbit: orbitCoasting, zoom: zoomCoasting });
        return;
    }

    if (filtered && filtered.multiHandLandmarks && filtered.multiHandLandmarks.length > 0) {
        const primaryHand = filtered.multiHandLandmarks[0];
        const trackMode = filtered.__greenBand?.trackMode || 'unknown';
        const greenCount = filtered.__greenBand?.greenCount ?? null;
        const nowMs = performance.now();
        const handedness = filtered.multiHandedness?.[0]?.label || filtered.multiHandedness?.[0]?.[0]?.label || null;
        const mirrorX = handedness === 'Left';

        let debugSuffix = '';

        if (keypointClassifier?.loadError) {
            lastRawAction = { label: null, confidence: 0, text: 'model error' };
        } else if (!keypointClassifier?.ready) {
            lastRawAction = { label: null, confidence: 0, text: 'loading...' };
        } else if ((nowMs - lastActionUpdateMs) > 120) {
            const pred = keypointClassifier.classify(primaryHand, { mirrorX });
            if (pred) {
                lastRawAction = {
                    label: pred.label,
                    confidence: pred.confidence,
                    text: `${pred.label} (${Math.round(pred.confidence * 100)}%)`
                };

                actionHistory.push({ idx: pred.labelIndex, label: pred.label, conf: pred.confidence });
                if (actionHistory.length > 7) actionHistory.shift();

                const sums = new Map();
                for (const p of actionHistory) {
                    const prev = sums.get(p.idx) || { sum: 0, count: 0, label: p.label };
                    prev.sum += p.conf;
                    prev.count += 1;
                    prev.label = p.label;
                    sums.set(p.idx, prev);
                }

                let best = null;
                for (const entry of sums.values()) {
                    if (!best || entry.sum > best.sum) best = entry;
                }

                if (best) {
                    const avg = best.count > 0 ? (best.sum / best.count) : 0;
                    currentAction = { label: best.label, confidence: avg };
                }
                lastActionUpdateMs = nowMs;
            }
        }

        const rawLabelKey = (lastRawAction?.label || '').toLowerCase();
        const labelSaysTwoFingerHold = rawLabelKey === 'twofingerhold' || lastRawAction.text.toLowerCase().includes('twofingerhold');
        const labelSaysPinch = rawLabelKey === 'pinching' || rawLabelKey === 'pinch' || lastRawAction.text.toLowerCase().includes('pinch');
        const conf = lastRawAction?.confidence ?? 0;
        const isTwoFingerHoldStrong = labelSaysTwoFingerHold && conf >= ORBIT_ENGAGE_CONF;
        const isTwoFingerHoldWeak = labelSaysTwoFingerHold && conf >= ORBIT_RELEASE_CONF;
        const isPinchStrong = labelSaysPinch && conf >= ZOOM_ENGAGE_CONF;
        const isPinchWeak = labelSaysPinch && conf >= ZOOM_RELEASE_CONF;

        // Pinch overrides orbit
        if (isPinchStrong && orbitActive) {
            orbitActive = false;
            orbitPrevPos = null;
            lastOrbitDxDy = null;
            orbitVel.x = 0;
            orbitVel.y = 0;
            orbitAnglesTarget = null;
            orbitAnglesCurrent = null;
        }

        // Orbit engage/sustain/release
        if (isTwoFingerHoldStrong) {
            orbitActive = true;
            orbitUntilMs = nowMs + ORBIT_HOLD_MS;
            if (zoomActive) {
                zoomActive = false;
                zoomPrevY = null;
                zoomVel = 0;
            }
        } else if (orbitActive && isTwoFingerHoldWeak) {
            orbitUntilMs = nowMs + ORBIT_HOLD_MS;
        } else if (orbitActive && nowMs > orbitUntilMs) {
            orbitActive = false;
            orbitPrevPos = null;
            lastOrbitDxDy = null;
            orbitVel.x = 0;
            orbitVel.y = 0;
            orbitAnglesTarget = null;
            orbitAnglesCurrent = null;
        }

        // Orbit velocity from hand movement
        if (orbitActive) {
            const center = getStableHandCenter(primaryHand);
            const xView = 0.5 - center.x;
            const yView = 0.5 - center.y;
            if (!orbitPrevPos) {
                orbitPrevPos = { x: xView, y: yView };
            } else {
                const dx = xView - orbitPrevPos.x;
                const dy = yView - orbitPrevPos.y;
                orbitPrevPos = { x: xView, y: yView };

                const targetVx = Math.abs(dx) > ORBIT_DEADZONE ? (dx * ORBIT_VEL_GAIN) : 0;
                const targetVy = Math.abs(dy) > ORBIT_DEADZONE ? (dy * ORBIT_VEL_GAIN) : 0;

                orbitVel.x = orbitVel.x + ORBIT_ALPHA * (targetVx - orbitVel.x);
                orbitVel.y = orbitVel.y + ORBIT_ALPHA * (targetVy - orbitVel.y);

                orbitVel.x = THREE.MathUtils.clamp(orbitVel.x, -ORBIT_MAX_VEL, ORBIT_MAX_VEL);
                orbitVel.y = THREE.MathUtils.clamp(orbitVel.y, -ORBIT_MAX_VEL, ORBIT_MAX_VEL);

                lastOrbitDxDy = { dx: orbitVel.x, dy: orbitVel.y };
            }
        }

        // Zoom engage/sustain/release
        if (isPinchStrong) {
            zoomActive = true;
            zoomUntilMs = nowMs + ZOOM_HOLD_MS;
        } else if (zoomActive && isPinchWeak) {
            zoomUntilMs = nowMs + ZOOM_HOLD_MS;
        } else if (zoomActive && nowMs > zoomUntilMs) {
            zoomActive = false;
            zoomPrevY = null;
            zoomVel = 0;
        }

        // Zoom velocity from hand movement
        if (zoomActive) {
            const center = getStableHandCenter(primaryHand);
            const yView = 0.5 - center.y;
            if (zoomPrevY == null) {
                zoomPrevY = yView;
            } else {
                const dy = yView - zoomPrevY;
                zoomPrevY = yView;
                const targetVz = Math.abs(dy) > ZOOM_DEADZONE ? (dy * ZOOM_VEL_GAIN) : 0;
                zoomVel = zoomVel + ZOOM_ALPHA * (targetVz - zoomVel);
                zoomVel = THREE.MathUtils.clamp(zoomVel, -ZOOM_MAX_VEL, ZOOM_MAX_VEL);
            }
        }

        // Update status
        const greenInfo = (greenCount == null) ? '' : ` | GreenHands: ${greenCount}`;
        const orbitInfo = orbitActive ? ' | Orbit: on' : '';
        const zoomInfo = zoomActive ? ' | Zoom: on' : '';
        if (gestureDebug && keypointClassifier?.ready) {
            const outSize = keypointClassifier.outputSize;
            const labelSize = keypointClassifier.labels?.length ?? 0;
            if (outSize != null) debugSuffix = ` | ModelOut: ${outSize}/${labelSize}`;
            if (lastOrbitDxDy) debugSuffix += ` | d: ${lastOrbitDxDy.dx.toFixed(3)},${lastOrbitDxDy.dy.toFixed(3)}`;
            if (zoomActive) debugSuffix += ` | z: ${zoomVel.toFixed(3)}`;
        }
        const actionInfo = lastRawAction?.text ? ` | Action: ${lastRawAction.text}` : '';
        const statusText = `State: TRACKING | Track: ${trackMode}${greenInfo}${actionInfo}${orbitInfo}${zoomInfo}${debugSuffix}`;
        if (statusText !== lastStatusText) {
            updateStatus(statusText);
            lastStatusText = statusText;
        }

        updateGestureHUD({
            gesture: lastRawAction?.text || 'Idle',
            greenBand: trackMode === 'green',
            orbit: orbitActive,
            zoom: zoomActive
        });

        handViz.update(filtered.multiHandLandmarks);
    }
}

// ── Gesture HUD ──

function updateGestureHUD(info) {
    const hud = document.getElementById('gesture-hud');
    if (!hud) return;

    const signEl = document.getElementById('hud-hand-sign');
    const motionEl = document.getElementById('hud-motion');
    const modeEl = document.getElementById('hud-mode');
    const bandEl = document.getElementById('hud-green-band');

    if (signEl) signEl.textContent = info.gesture || 'None';
    if (motionEl) {
        const parts = [];
        if (info.orbit) parts.push('Orbit');
        if (info.zoom) parts.push('Zoom');
        motionEl.textContent = parts.length > 0 ? parts.join('+') : 'Idle';
    }
    if (modeEl) modeEl.textContent = keypointClassifier?.ready ? 'TFLite' : 'Loading';
    if (bandEl) {
        if (info.greenBand === true) {
            bandEl.textContent = 'Detected';
            bandEl.style.color = '#00ff88';
        } else {
            bandEl.textContent = 'Locked';
            bandEl.style.color = '#ffaa00';
        }
    }

    hud.classList.remove('hidden');
}

// ── Render Loop (with velocity-based orbit/zoom physics) ──

function renderLoop() {
    requestAnimationFrame(renderLoop);

    const nowMs = performance.now();
    const dt = lastRenderMs ? Math.min(0.05, (nowMs - lastRenderMs) / 1000) : 0;
    lastRenderMs = nowMs;

    if (dt > 0) {
        // Velocity decay
        const decay = Math.exp(-dt * 14);
        orbitVel.x *= decay;
        orbitVel.y *= decay;
        zoomVel *= decay;
        if (Math.abs(orbitVel.x) < ORBIT_VEL_EPS) orbitVel.x = 0;
        if (Math.abs(orbitVel.y) < ORBIT_VEL_EPS) orbitVel.y = 0;
        if (Math.abs(zoomVel) < ZOOM_VEL_EPS) zoomVel = 0;

        // Grace period expiry
        if (orbitActive && nowMs > (orbitUntilMs + ORBIT_TRACK_LOSS_GRACE_MS)) {
            orbitActive = false;
            orbitPrevPos = null;
            lastOrbitDxDy = null;
            orbitAnglesTarget = null;
            orbitAnglesCurrent = null;
        }

        if (zoomActive && nowMs > (zoomUntilMs + ZOOM_TRACK_LOSS_GRACE_MS)) {
            zoomActive = false;
            zoomPrevY = null;
        }

        // Apply orbit via spherical camera interpolation
        if (orbitActive) {
            if (!orbitAnglesTarget || !orbitAnglesCurrent) {
                const sph = getCameraSpherical(orbitControls);
                if (sph) {
                    orbitAnglesTarget = { theta: sph.theta, phi: sph.phi };
                    orbitAnglesCurrent = { theta: sph.theta, phi: sph.phi };
                }
            }

            if (orbitAnglesTarget && orbitAnglesCurrent && (Math.abs(orbitVel.x) > 1e-4 || Math.abs(orbitVel.y) > 1e-4)) {
                orbitAnglesTarget.theta -= orbitVel.x * dt * ORBIT_SPEED_MULT;
                orbitAnglesTarget.phi -= orbitVel.y * dt * ORBIT_SPEED_MULT;
            }

            if (orbitAnglesTarget && orbitAnglesCurrent) {
                const rateAlpha = 1 - Math.exp(-dt * ORBIT_ANGLE_SMOOTH_RATE);
                const dTheta = Math.atan2(
                    Math.sin(orbitAnglesTarget.theta - orbitAnglesCurrent.theta),
                    Math.cos(orbitAnglesTarget.theta - orbitAnglesCurrent.theta)
                );
                orbitAnglesCurrent.theta += dTheta * rateAlpha;
                orbitAnglesCurrent.phi += (orbitAnglesTarget.phi - orbitAnglesCurrent.phi) * rateAlpha;

                const sphNow = getCameraSpherical(orbitControls);
                if (sphNow) {
                    setCameraSpherical(orbitControls, {
                        radius: sphNow.radius,
                        theta: orbitAnglesCurrent.theta,
                        phi: orbitAnglesCurrent.phi
                    });
                }
            }
        }

        // Apply zoom
        if (zoomActive && Math.abs(zoomVel) > 1e-4) {
            zoomCamera(orbitControls, zoomVel * dt * ZOOM_SPEED_MULT, {
                minDistance: ZOOM_MIN_DISTANCE,
                maxDistance: ZOOM_MAX_DISTANCE
            });
        }
    }

    // Update animations
    if (dt > 0) modelMgr?.update?.(dt);
    orbitControls.update();
    rendererObj.render(sceneObj, cameraObj);

    // Dynamic Marker Scaling & Annotation Positioning
    if (targetMarker && targetMarker.visible) {
        if (attachedMesh && attachedLocalPoint) {
            const worldPos = attachedLocalPoint.clone().applyMatrix4(attachedMesh.matrixWorld);
            targetMarker.position.copy(worldPos);
        }

        const distance = cameraObj.position.distanceTo(targetMarker.position);
        const scale = distance * 0.15;
        targetMarker.scale.setScalar(scale);

        const p3d = targetMarker.position.clone();
        p3d.project(cameraObj);

        const x = (p3d.x * 0.5 + 0.5) * canvasElem.clientWidth;
        const y = (-(p3d.y * 0.5) + 0.5) * canvasElem.clientHeight;

        const labelDiv = document.querySelector('.annotation-label');
        if (labelDiv) {
            if (p3d.z > 1) {
                labelDiv.style.display = 'none';
                document.getElementById('line-layer').style.display = 'none';
            } else {
                labelDiv.style.display = '';
                document.getElementById('line-layer').style.display = '';

                const labelX = x + 100;

                labelDiv.style.left = `${labelX}px`;
                labelDiv.style.top = `${y - 50}px`;

                const lineLayer = document.getElementById('line-layer');
                if (lineLayer) {
                    const lineHtml = `
                        <circle cx="${x}" cy="${y}" r="3" class="connector-dot" />
                        <path d="M ${x} ${y} L ${x + 50} ${y - 50} L ${labelX} ${y - 50}" fill="none" class="connector-line" />
                    `;
                    lineLayer.innerHTML = lineHtml;
                }
            }
        }
    }
}

window.addEventListener('error', (ev) => {
    console.error('Runtime error:', ev?.error || ev);
    updateStatus(`Error: ${ev?.message || 'Runtime error'}`);
});

window.addEventListener('unhandledrejection', (ev) => {
    console.error('Unhandled rejection:', ev?.reason || ev);
    const msg = (ev?.reason && (ev.reason.message || String(ev.reason))) || 'Unhandled promise rejection';
    updateStatus(`Error: ${msg}`);
});

window.onload = init;
