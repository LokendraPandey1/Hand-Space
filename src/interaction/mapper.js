import * as THREE from 'three';

// Track gesture state for one-shot actions
let lastGestureTime = 0;
const GESTURE_COOLDOWN = 1000; // 1 second cooldown for one-shot gestures

export function applyInteraction(stateObj, handPos, modelMgr, cameraControls, multiHandData) {
    const activeModel = modelMgr.getTarget();
    const currentTime = Date.now();

    // One-shot gestures (with cooldown)
    if (stateObj.currentMode === 'THUMBS_UP' && currentTime - lastGestureTime > GESTURE_COOLDOWN) {
        // Show AI card (trigger AI explanation)
        const btnAi = document.getElementById('btn-ask-gemini');
        if (btnAi) btnAi.click();
        lastGestureTime = currentTime;
        return;
    }

    if (stateObj.currentMode === 'RING_PINCH' && currentTime - lastGestureTime > GESTURE_COOLDOWN) {
        // Toggle model variant (e.g., Heart Static <-> Animated)
        const btnVariant = document.getElementById('btn-toggle-variant');
        if (btnVariant && !btnVariant.disabled && !btnVariant.classList.contains('hidden')) {
            btnVariant.click();
            lastGestureTime = currentTime;
        }
        return;
    }

    // Continuous gestures
    if (stateObj.currentMode === 'TWO_HANDED') {
        const { zoomDelta } = stateObj.getDelta(handPos, multiHandData);

        const zoomRate = 2.0;
        if (Math.abs(zoomDelta) > 0.001) {
            const movement = new THREE.Vector3(0, 0, -zoomDelta * zoomRate);
            movement.applyQuaternion(cameraControls.object.quaternion);
            cameraControls.object.position.add(movement);

            // Update zoom label
            const zoomLabel = document.getElementById('zoom-label');
            if (zoomLabel) {
                // Calculate zoom based on camera distance from origin
                const distance = cameraControls.object.position.length();
                const baseDistance = 5; // Default camera distance
                const zoomPercent = Math.round((baseDistance / distance) * 100);
                zoomLabel.textContent = `Zoom: ${zoomPercent}%`;
            }
        }

        cameraControls.update();


    } else if (stateObj.currentMode !== 'IDLE' && stateObj.currentMode !== 'FIST' &&
        stateObj.currentMode !== 'MODE_TOGGLE' && activeModel) {
        const { deltaX, deltaY } = stateObj.getDelta(handPos);

        if (stateObj.currentMode === 'ROTATING') {
            const rotationRate = 1.2;

            if (deltaX !== 0) {
                activeModel.rotation.y += deltaX * rotationRate;
            }

            if (deltaY !== 0) {
                activeModel.rotation.x += deltaY * rotationRate;

                const clampAngle = 1.4;
                activeModel.rotation.x = Math.max(-clampAngle, Math.min(clampAngle, activeModel.rotation.x));
            }

            activeModel.rotation.z = 0;

        } else if (stateObj.currentMode === 'PANNING') {
            const panSpeed = 2.5;
            activeModel.position.x -= deltaX * panSpeed;
            activeModel.position.y += deltaY * panSpeed;
        } else if (stateObj.currentMode === 'SCALING') {
            const scaleMultiplier = 1 + (deltaY * 0.8);
            modelMgr.scale(Math.max(0.1, scaleMultiplier));
        }
    }
}

