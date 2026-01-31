import * as THREE from 'three';
import { isPinched, getDistance } from '../hand/gestures.js';

export class InteractionState {
    constructor() {
        this.currentMode = 'IDLE';

        this.prevHandPos = new THREE.Vector3();
        this.filteredHandPos = new THREE.Vector3();

        this.rotationConfig = {
            isActive: false,
            responsiveness: 2.5,
            interpolationRate: 0.25,
            motionThreshold: 0.005,
            accumulatorX: 0,
            accumulatorY: 0
        };

        this.twoHandDistance = 0;
    }

    update(allHandData, gestureType, handPosition, modelMgr) {
        let nextMode = gestureType;

        if (allHandData && allHandData.length === 2) {
            const [hand1, hand2] = allHandData;
            if (isPinched(hand1) && isPinched(hand2)) {
                nextMode = 'TWO_HANDED';
            }
        }

        let modeChanged = false;

        if (this.currentMode !== nextMode) {
            this.currentMode = nextMode;
            modeChanged = true;

            if (this.currentMode === 'ROTATING') {
                this.filteredHandPos.copy(handPosition);
                this.prevHandPos.copy(handPosition);
                this.rotationConfig.isActive = true;
            } else if (this.currentMode === 'TWO_HANDED') {
                const metrics = this._measureHandSeparation(allHandData);
                this.twoHandDistance = metrics.separation;
            } else {
                this.prevHandPos.copy(handPosition);
                this.filteredHandPos.copy(handPosition);
                this.rotationConfig.isActive = false;
            }
        }

        const requiresSmoothing = ['ROTATING', 'PANNING', 'SCALING', 'CAMERA_VERTICAL'].includes(this.currentMode);
        if (requiresSmoothing) {
            const smoothFactor = (this.currentMode === 'PANNING') ? 0.1 : this.rotationConfig.interpolationRate;
            this.filteredHandPos.lerp(handPosition, smoothFactor);
        }

        return { changed: modeChanged, mode: this.currentMode };
    }

    _measureHandSeparation(handArray) {
        const tip1 = handArray[0][8];
        const tip2 = handArray[1][8];
        return { separation: getDistance(tip1, tip2) };
    }

    getDelta(currentPos, allHandData) {
        if (this.currentMode === 'TWO_HANDED') {
            const { separation } = this._measureHandSeparation(allHandData);
            const zoomChange = (separation - this.twoHandDistance) * 5;
            this.twoHandDistance = separation;
            return { zoomDelta: zoomChange, isTwoHanded: true };
        }

        let horizontalDelta = (this.filteredHandPos.x - this.prevHandPos.x) * 10;
        let verticalDelta = (this.prevHandPos.y - this.filteredHandPos.y) * 10;

        if (this.currentMode === 'ROTATING') {
            if (Math.abs(horizontalDelta) < this.rotationConfig.motionThreshold) horizontalDelta = 0;
            if (Math.abs(verticalDelta) < this.rotationConfig.motionThreshold) verticalDelta = 0;
        }

        this.prevHandPos.copy(this.filteredHandPos);

        return { deltaX: horizontalDelta, deltaY: verticalDelta, isTwoHanded: false };
    }
}
