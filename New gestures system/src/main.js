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

const videoElem = document.getElementsByClassName('input_video')[0];
const canvasElem = document.getElementsByClassName('output_canvas')[0];

globalThis.__handspaceModuleLoaded = true;

function orbitCamera(controls, azimuthDelta, polarDelta) {
    const camera = controls?.object;
    const target = controls?.target;
    if (!camera || !target) return;

    const offset = new THREE.Vector3().subVectors(camera.position, target);
    const radius = offset.length();
    if (radius === 0) return;

    let theta = Math.atan2(offset.x, offset.z);
    let phi = Math.acos(THREE.MathUtils.clamp(offset.y / radius, -1, 1));

    theta -= azimuthDelta;
    phi -= polarDelta;

    const eps = 1e-3;
    phi = THREE.MathUtils.clamp(phi, eps, Math.PI - eps);

    offset.x = radius * Math.sin(phi) * Math.sin(theta);
    offset.y = radius * Math.cos(phi);
    offset.z = radius * Math.sin(phi) * Math.cos(theta);

    camera.position.copy(target).add(offset);
    camera.lookAt(target);
}

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

let sceneObj, rendererObj, cameraObj, orbitControls;
let modelMgr, handViz;
let greenBandFilter;
let lastTrackMode = null;
let lastGreenCount = null;
let keypointClassifier;
let lastActionText = '';
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
        initControls(modelMgr, orbitControls);

        modelMgr.load(MODELS[0].file);

        initHandTracker(videoElem, processHandData, { maxFps: 30, width: 640, height: 480, maxNumHands: 1, modelComplexity: 0 });
        renderLoop();
    } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Init failed:', e);
        updateStatus(`Error: ${e?.message || 'Init failed'}`);
    }
}
function processHandData(detectionResults) {
    handViz.hide();

    const filtered = greenBandFilter.filter(detectionResults);
    if (!filtered) {
        const trackMode = 'none';
        const greenCount = 0;
        const nowMs = performance.now();
        const orbitCoasting = orbitActive && (nowMs < (orbitUntilMs + ORBIT_TRACK_LOSS_GRACE_MS));
        const zoomCoasting = zoomActive && (nowMs < (zoomUntilMs + ZOOM_TRACK_LOSS_GRACE_MS));
        const orbitInfo = orbitCoasting ? ' | Orbit: on' : '';
        const zoomInfo = zoomCoasting ? ' | Zoom: on' : '';
        const actionInfo = lastRawAction?.text ? ` | Action: ${lastRawAction.text}` : '';
        const statusText = `State: ${(orbitCoasting || zoomCoasting) ? 'TRACKING' : 'IDLE'} | Track: ${trackMode} | GreenHands: ${greenCount}${actionInfo}${orbitInfo}${zoomInfo}`;
        if (statusText !== lastStatusText) {
            updateStatus(statusText);
            lastStatusText = statusText;
        }
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

        if (isPinchStrong && orbitActive) {
            orbitActive = false;
            orbitPrevPos = null;
            lastOrbitDxDy = null;
            orbitVel.x = 0;
            orbitVel.y = 0;
            orbitAnglesTarget = null;
            orbitAnglesCurrent = null;
        }

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

        if (zoomActive) {
            const center = getStableHandCenter(primaryHand);
            const yView = 0.5 - center.y;
            if (zoomPrevY == null) {
                zoomPrevY = yView;
            } else {
                const dy = yView - zoomPrevY;
                zoomPrevY = yView;

                // Hand up => yView increases => positive dy => zoom in (handled in renderLoop via exp(-zoomDelta))
                const targetVz = Math.abs(dy) > ZOOM_DEADZONE ? (dy * ZOOM_VEL_GAIN) : 0;
                zoomVel = zoomVel + ZOOM_ALPHA * (targetVz - zoomVel);
                zoomVel = THREE.MathUtils.clamp(zoomVel, -ZOOM_MAX_VEL, ZOOM_MAX_VEL);
            }
        }

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

        handViz.update(filtered.multiHandLandmarks);
    }
}

function renderLoop() {
    requestAnimationFrame(renderLoop);

    const nowMs = performance.now();
    const dt = lastRenderMs ? Math.min(0.05, (nowMs - lastRenderMs) / 1000) : 0;
    lastRenderMs = nowMs;

    if (dt > 0) {
        const decay = Math.exp(-dt * 14);
        orbitVel.x *= decay;
        orbitVel.y *= decay;
        zoomVel *= decay;
        if (Math.abs(orbitVel.x) < ORBIT_VEL_EPS) orbitVel.x = 0;
        if (Math.abs(orbitVel.y) < ORBIT_VEL_EPS) orbitVel.y = 0;
        if (Math.abs(zoomVel) < ZOOM_VEL_EPS) zoomVel = 0;

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
        if (zoomActive && Math.abs(zoomVel) > 1e-4) {
            zoomCamera(orbitControls, zoomVel * dt * ZOOM_SPEED_MULT, { minDistance: ZOOM_MIN_DISTANCE, maxDistance: ZOOM_MAX_DISTANCE });
        }
    }

    if (dt > 0) modelMgr?.update?.(dt);
    orbitControls.update();
    rendererObj.render(sceneObj, cameraObj);
}

window.addEventListener('error', (ev) => {
    // eslint-disable-next-line no-console
    console.error('Runtime error:', ev?.error || ev);
    updateStatus(`Error: ${ev?.message || 'Runtime error'}`);
});

window.addEventListener('unhandledrejection', (ev) => {
    // eslint-disable-next-line no-console
    console.error('Unhandled rejection:', ev?.reason || ev);
    const msg = (ev?.reason && (ev.reason.message || String(ev.reason))) || 'Unhandled promise rejection';
    updateStatus(`Error: ${msg}`);
});

window.onload = init;


