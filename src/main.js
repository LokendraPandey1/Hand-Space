import * as THREE from 'three';
import { initScene } from './scene/scene.js';
import { initCamera } from './scene/camera.js';
import { initLights } from './scene/lighting.js';
import { initPlane } from './scene/plane.js';
import { ModelManager, MODELS } from './models/modelLoader.js';
import { initHandTracker, setMaxHands } from './hand/handTracker.js';
import { detectGesture, getHandMode } from './hand/gestures.js';
import { HandVisualizer } from './hand/landmarks.js';
import { InteractionState } from './interaction/stateMachine.js';
import { applyInteraction } from './interaction/mapper.js';
import { updateStatus } from './ui/overlay.js';
import { initControls } from './ui/controls.js';
import { GeminiService } from './ai/geminiService.js';
import { castRay, castRayFromHand } from './interaction/raycaster.js';
import { translator } from './i18n/translator.js';

const videoElem = document.getElementsByClassName('input_video')[0];
const canvasElem = document.getElementsByClassName('output_canvas')[0];

let sceneObj, rendererObj, cameraObj, orbitControls;
let modelMgr, handViz, stateTracker;
let selectedMesh = null; // Track currently highlighted part
let pointedMesh = null; // Track mesh being pointed at by finger
let pointedHitData = null; // Store hit data for AI trigger

function init() {
    ({ scene: sceneObj, renderer: rendererObj } = initScene(canvasElem));
    ({ camera: cameraObj, controls: orbitControls } = initCamera(rendererObj));

    sceneObj.add(cameraObj);

    initLights(sceneObj);
    initPlane(sceneObj);

    modelMgr = new ModelManager(sceneObj);
    handViz = new HandVisualizer(cameraObj);
    stateTracker = new InteractionState();

    // --- LANDING PAGE LOGIC ---
    const landingPage = document.getElementById('landing-page');
    const btnStart = document.getElementById('btn-start-app');
    const uiContainer = document.getElementById('ui-container');
    const modelMenu = document.getElementById('model-menu');

    // Hide UI initially (uiContainer handled in HTML, but modelMenu needs help)
    modelMenu.classList.add('hidden');

    btnStart.addEventListener('click', async () => {
        // First, fetch uploaded models so they appear in the model selector
        await modelMgr.loadUploadedModels();

        // Now initialize controls (populates model list with all models)
        initControls(modelMgr, orbitControls);

        // Fade out landing page
        landingPage.style.opacity = 0;
        setTimeout(() => {
            landingPage.classList.add('hidden');
        }, 500);

        // Show UI
        uiContainer.classList.remove('hidden');
        modelMenu.classList.remove('hidden');

        // Check URL for specific model
        const urlParams = new URLSearchParams(window.location.search);
        const specificModel = urlParams.get('model');

        if (specificModel) {
            modelMgr.load(specificModel);
        } else {
            modelMgr.load(MODELS[0].file);
        }

        // Start Core Features
        initHandTracker(videoElem, processHandData);
    });

    // --- AI INTEGRATION (Dept 4) ---
    const geminiSvc = new GeminiService();
    let isAiMode = false;
    let currentLanguage = 'English'; // Default Language

    // --- GESTURE GUIDE TOGGLE ---
    const btnToggleGuide = document.getElementById('btn-toggle-guide');
    const gestureGuide = document.getElementById('gesture-guide');

    if (btnToggleGuide && gestureGuide) {
        btnToggleGuide.addEventListener('click', () => {
            gestureGuide.classList.toggle('minimized');
            btnToggleGuide.textContent = gestureGuide.classList.contains('minimized') ? '🖐️' : '−';
        });
    }

    // --- GENERIC MODEL VARIANT TOGGLE ---
    const btnVariant = document.getElementById('btn-toggle-variant');

    // Define groups of variants. Each group has a list of filenames and corresponding icons.
    const variantGroups = [
        {
            name: 'heart',
            files: ['heart.glb', 'beating_heart_3D.glb'],
            icons: ['🫀', '💓'] // 0: Static, 1: Animated
        },
        {
            name: 'brain',
            files: ['colored_brain_model.glb', 'brain_model_right_-_general_anatomy.glb'],
            icons: ['🧠', '🧬'] // 0: Colored, 1: Detailed
        }
    ];

    let currentVariantGroup = null;
    let currentVariantIndex = -1;
    let isTransitioning = false;

    // Store original load function
    const loadModelOriginal = modelMgr.load.bind(modelMgr);

    // Override load to check for variants
    modelMgr.load = function (file, onLoaded = null) {
        loadModelOriginal(file, onLoaded);

        // Check if this model belongs to a variant group
        setTimeout(() => {
            if (btnVariant) {
                // Find matching group
                const group = variantGroups.find(g => g.files.includes(file));

                if (group) {
                    currentVariantGroup = group;
                    currentVariantIndex = group.files.indexOf(file);

                    btnVariant.classList.remove('hidden');
                    // Show icon of the CURRENT state
                    btnVariant.textContent = group.icons[currentVariantIndex];

                    // Optional: Visual indication if it's the "alternate" version
                    btnVariant.classList.toggle('active', currentVariantIndex > 0);

                    console.log(`Variant loaded: ${group.name} (${currentVariantIndex})`);
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

            // Calculate next variant index (cycle)
            const nextIndex = (currentVariantIndex + 1) % currentVariantGroup.files.length;
            const newModel = currentVariantGroup.files[nextIndex];

            console.log(`Switching variant: ${currentVariantGroup.name} -> ${nextIndex}`);

            // Transition
            await modelMgr.fadeOut(300);

            loadModelOriginal(newModel, () => {
                modelMgr.fadeIn(400);
            });

            // Update state immediately
            currentVariantIndex = nextIndex;
            btnVariant.textContent = currentVariantGroup.icons[currentVariantIndex];
            btnVariant.classList.toggle('active', currentVariantIndex > 0);

            // Fade in after small delay for loading
            setTimeout(async () => {
                await modelMgr.fadeIn(400);
                isTransitioning = false;
            }, 500);
        });

        console.log('Generic variant system initialized');
    }

    const btnAi = document.getElementById('btn-ask-gemini');
    const btnLang = document.getElementById('btn-lang');
    const cardAi = document.getElementById('gemini-card');
    const textAi = document.getElementById('gemini-response-text');
    const loaderAi = document.getElementById('ai-spinner');
    const btnClose = document.getElementById('btn-close-card');

    // Language Toggle
    // Language Logic
    const langMenu = document.getElementById('lang-menu');
    const langOptions = document.querySelectorAll('.lang-opt');

    // Toggle Menu
    btnLang.onclick = (e) => {
        e.stopPropagation();
        langMenu.classList.toggle('hidden');
    };

    // Close menu when clicking outside
    window.addEventListener('click', (e) => {
        if (!e.target.closest('#lang-wrapper')) {
            langMenu.classList.add('hidden');
        }
    });

    // Handle Selection
    langOptions.forEach(opt => {
        opt.onclick = async () => {
            const selectedLang = opt.dataset.lang;
            currentLanguage = selectedLang;

            // Visual Update
            langOptions.forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            langMenu.classList.add('hidden');

            // Apply translations
            await translator.load(selectedLang);
            translator.apply();

            // Feedback
            if (currentLanguage === 'Hindi') {
                textAi.innerText = "भाषा बदली: हिंदी";
            } else {
                textAi.innerText = "Language switched: English";
            }
        };
        // Set initial active
        if (opt.dataset.lang === currentLanguage) opt.classList.add('active');
    });

    // Load initial translations
    translator.load().then(() => translator.apply());

    // UI Toggle
    btnAi.onclick = () => {
        isAiMode = !isAiMode;
        if (isAiMode) {
            stateTracker.currentMode = 'GEMINI_MODE'; // Optional: if you update state machine
            cardAi.classList.remove('hidden');
            btnAi.style.background = 'rgba(0, 242, 254, 0.4)';
            textAi.innerText = "Tap any part of the model to learn about it!";
        } else {
            cardAi.classList.add('hidden');
            btnAi.style.background = '';

            // Clear selection when closing
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

        // Clear selection when closing
        if (selectedMesh) {
            selectedMesh.material = selectedMesh.userData.originalMat;
            selectedMesh = null;
            rendererObj.render(sceneObj, cameraObj);
        }
    };

    // Create Target Marker (Red Sphere)
    const markerGeo = new THREE.SphereGeometry(0.05, 16, 16); // Small sphere
    const markerMat = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Bright Red
    const targetMarker = new THREE.Mesh(markerGeo, markerMat);
    targetMarker.visible = false;
    sceneObj.add(targetMarker);

    // --- TTS FUNCTIONALITY ---
    let synth = window.speechSynthesis;

    function speakText(text, lang) {
        if (!synth) return;

        // Stop any current speech
        synth.cancel();

        const utterance = new SpeechSynthesisUtterance(text);

        // Language Selection
        // 'en-US' for English, 'hi-IN' for Hindi
        utterance.lang = lang === 'Hindi' ? 'hi-IN' : 'en-US';
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        // Try to find a matching voice (optional but better quality)
        const voices = synth.getVoices();
        const voice = voices.find(v => v.lang.includes(utterance.lang));
        if (voice) utterance.voice = voice;

        synth.speak(utterance);
    }

    // Interaction Listener
    window.addEventListener('pointerdown', async (event) => {
        if (!isAiMode) return;
        if (event.target.closest('#ui-container')) return; // Ignore UI clicks
        if (event.target.closest('#lang-wrapper')) return; // Ignore Lang Menu

        const hitData = castRay(event, cameraObj, sceneObj);

        if (hitData) {
            const hitMesh = hitData.object;
            console.log("AI Clicked:", hitMesh.name);

            // Show Loading
            loaderAi.classList.remove('hidden');

            // Stop previous speech if user clicks quickly
            synth.cancel();

            // --- PRECISION MARKER LOGIC ---
            // 1. Position marker at exact click point
            targetMarker.position.copy(hitData.point);
            targetMarker.visible = true;

            // 2. Force Render to show marker
            rendererObj.render(sceneObj, cameraObj);

            // 3. Capture Screenshot
            const activeModelMeta = modelMgr.getCurrentModelMetadata();
            const screenshot = canvasElem.toDataURL('image/jpeg', 0.9);

            // 4. Hide marker after capture (optional, specific preference?)
            // Keeping it visible helps user see what they clicked until they click again.
            // But let's hide it when AI is done or leave it? Let's leave it.

            // Call AI (Returns JSON now)
            // Call AI (Returns JSON now)
            let aiData = { part_name: "Scanning...", description: "Please wait." };
            try {
                const rawJson = await geminiSvc.explainMesh(
                    hitMesh.name,
                    activeModelMeta.name,
                    screenshot,
                    currentLanguage
                );
                // Clean markdown code blocks if present
                const cleanJson = rawJson.replace(/```json/g, '').replace(/```/g, '').trim();

                try {
                    aiData = JSON.parse(cleanJson);
                } catch (jsonErr) {
                    console.warn("JSON Parse Failed, falling back to text parsing.", jsonErr);
                    // Fallback: If AI returned plain text, try to extract reasonable title/desc
                    // Assumption: First sentence or short phrase is title, rest is desc.
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
                        // Just use mesh name as title if text is one blob
                        aiData = {
                            part_name: hitMesh.name, // Fallback to clicked mesh name
                            description: cleanJson
                        };
                    }
                }

            } catch (e) {
                console.error("AI Error", e);
                aiData = { part_name: "Error", description: "Could not analyze part." };
            }

            // Hide Loading Spinner
            loaderAi.classList.add('hidden');

            // --- RENDER ANNOTATION ---
            const lineLayer = document.getElementById('line-layer');
            const annoContainer = document.getElementById('annotation-container');

            // Clear previous
            lineLayer.innerHTML = '';
            annoContainer.innerHTML = '';

            // Project 3D Point to 2D Screen
            const p3d = hitData.point.clone();
            p3d.project(cameraObj);

            const x = (p3d.x * 0.5 + 0.5) * canvasElem.clientWidth;
            const y = (-(p3d.y * 0.5) + 0.5) * canvasElem.clientHeight;

            // Define Label Position (Offset to top-right of click)
            const labelX = x + 100; // 100px right
            const labelY = y - 80;  // 80px up

            // Draw SVG Line
            // Path: Click -> Elbow -> Label
            // Simple straight line for now or elbow? User drawing showed a bit of a curve/line.
            // Let's do a simple path: Start(x,y) -> L(labelX, labelY)
            // Or better: Start(x,y) -> (labelX - 10, labelY + height/2)

            const lineHtml = `
                <circle cx="${x}" cy="${y}" r="3" class="connector-dot" />
                <path d="M ${x} ${y} L ${x + 50} ${y - 50} L ${labelX} ${y - 50}" fill="none" class="connector-line" />
            `;
            lineLayer.innerHTML = lineHtml;

            // Draw HTML Label
            const labelDiv = document.createElement('div');
            labelDiv.className = 'annotation-label';
            labelDiv.style.left = `${labelX}px`;
            labelDiv.style.top = `${y - 50}px`; // Match line end Y

            labelDiv.innerHTML = `
                <span class="annotation-title">${aiData.part_name}</span>
                <span class="annotation-desc">${aiData.description}</span>
                <button class="annotation-speak-btn" id="btn-speak-anno">🔊 Listen</button>
            `;
            annoContainer.appendChild(labelDiv);

            // Setup Manual TTS
            const speakBtn = labelDiv.querySelector('#btn-speak-anno');
            if (speakBtn) {
                speakBtn.addEventListener('pointerdown', (e) => {
                    e.stopPropagation(); // Prevent closing
                    const fullText = `${aiData.part_name}. ${aiData.description}`;
                    speakText(fullText, currentLanguage);
                });
            }

            // Fallback for card (optional, maybe hide it?)
            // textAi.innerText = aiData.description; // We can keep using card or hide it.
            // Let's hide the old card content to reduce clutter or keep it as history?
            // User request implies replacement.
            cardAi.classList.add('hidden'); // Hide the big card

            // --- TRIGGER TTS ---
            // Auto-read disabled. Click button to listen.

        } else {
            // Clicked background? Hide marker and annotations
            targetMarker.visible = false;
            rendererObj.render(sceneObj, cameraObj);
            document.getElementById('line-layer').innerHTML = '';
            document.getElementById('annotation-container').innerHTML = '';
            synth.cancel(); // Stop speaking
            // textAi.innerText = ... (Cards hidden now)
        }
    });

    renderLoop();
}

function processHandData(detectionResults) {
    handViz.hide();

    if (detectionResults.multiHandLandmarks && detectionResults.multiHandLandmarks.length > 0) {
        const primaryHand = detectionResults.multiHandLandmarks[0];
        const numHands = detectionResults.multiHandLandmarks.length;
        const currentHandMode = getHandMode();

        const recognizedGesture = detectGesture(primaryHand, numHands);

        // Show mode toggle indicator
        if (recognizedGesture === 'MODE_TOGGLE') {
            const mode = getHandMode();
            const modeText = mode === 'one' ? '✋ One-Handed Mode' : '🙌 Two-Handed Mode';
            updateStatus(modeText);

            // Dynamically update MediaPipe hand detection limit
            setMaxHands(mode === 'one' ? 1 : 2);

            // Visual feedback
            setTimeout(() => updateStatus('Ready'), 2000);
            return; // Don't process further this frame
        }

        // --- POINTING GESTURE: Raycast from index finger to highlight model parts ---
        if (recognizedGesture === 'POINTING') {
            // Get index finger tip position (landmark 8)
            const indexTip = primaryHand[8];

            // Raycast from finger position
            const hitData = castRayFromHand(indexTip.x, indexTip.y, cameraObj, sceneObj);

            if (hitData) {
                const hitMesh = hitData.object;

                // If pointing at a new mesh, update highlighting
                if (pointedMesh !== hitMesh) {
                    // Restore previous mesh material
                    if (pointedMesh && pointedMesh.userData.originalMat) {
                        pointedMesh.material = pointedMesh.userData.originalMat;
                    }

                    // Highlight new mesh
                    pointedMesh = hitMesh;
                    pointedHitData = hitData;

                    // Store original material and apply highlight
                    if (!hitMesh.userData.originalMat) {
                        hitMesh.userData.originalMat = hitMesh.material;
                    }

                    // Create highlight material (cyan glow)
                    const highlightMat = hitMesh.material.clone();
                    highlightMat.emissive = new THREE.Color(0x00f2fe);
                    highlightMat.emissiveIntensity = 0.3;
                    hitMesh.material = highlightMat;

                    updateStatus(`👆 Pointing: ${hitMesh.name || 'Part'}`);
                }
            } else {
                // Not pointing at anything - clear highlight
                if (pointedMesh && pointedMesh.userData.originalMat) {
                    pointedMesh.material = pointedMesh.userData.originalMat;
                    pointedMesh = null;
                    pointedHitData = null;
                    updateStatus('👆 Pointing...');
                }
            }

            // Still update hand visualizer
            handViz.update([primaryHand], 'POINTING');
            return; // Don't process other interactions while pointing
        }

        // --- THUMBS UP: If we have a pointed mesh, trigger AI for it ---
        if (recognizedGesture === 'THUMBS_UP' && pointedMesh && pointedHitData) {
            // Simulate a click event for the AI system
            const btnAi = document.getElementById('btn-ask-gemini');
            if (btnAi && !btnAi.classList.contains('active')) {
                // Store the pointed data for AI to use
                window._pointedMeshForAI = pointedMesh;
                window._pointedHitDataForAI = pointedHitData;
                btnAi.click();

                updateStatus('🤖 Asking AI about pointed part...');

                // Clear pointing after triggering AI
                if (pointedMesh.userData.originalMat) {
                    pointedMesh.material = pointedMesh.userData.originalMat;
                }
                pointedMesh = null;
                pointedHitData = null;
            }

            handViz.update([primaryHand], 'THUMBS_UP');
            return;
        }

        // Clear pointed mesh when doing other gestures
        if (pointedMesh && recognizedGesture !== 'POINTING') {
            if (pointedMesh.userData.originalMat) {
                pointedMesh.material = pointedMesh.userData.originalMat;
            }
            pointedMesh = null;
            pointedHitData = null;
        }

        // Filter hands based on mode - in one-handed mode, only use primary hand
        const handsToProcess = currentHandMode === 'one'
            ? [primaryHand]
            : detectionResults.multiHandLandmarks;

        const wristMarker = primaryHand[0];
        const handPos = new THREE.Vector3(wristMarker.x, wristMarker.y, 0);

        const { changed, mode } = stateTracker.update(handsToProcess, recognizedGesture, handPos, modelMgr);
        if (changed) {
            updateStatus(`State: ${mode}`);
        }

        applyInteraction(stateTracker, handPos, modelMgr, orbitControls, handsToProcess);

        // Only visualize the filtered hands
        handViz.update(handsToProcess, mode);
    }
}

function renderLoop() {
    requestAnimationFrame(renderLoop);
    modelMgr.update();  // Update animations
    orbitControls.update();
    rendererObj.render(sceneObj, cameraObj);
}

window.onload = init;
