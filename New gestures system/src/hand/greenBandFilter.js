import { GreenFrameSampler } from './greenBand.js';
import { computeHandCenterPx, getImageSize } from './handGeometry.js';
import { LockOnHandTracker } from './lockTracker.js';

export class GreenBandHandFilter {
    constructor({
        greenLockMs = 1000,
        lockDistancePx = 160,
        targetWidth = 480,
        imageFilter = 'brightness(1.15) contrast(1.1) saturate(1.2)',
        detectOptions = {
            sampleRadiusPx: 10,
            minHitsPerFinger: 2,
            minGreenSamplesPerLandmark: 1,
            sampleStep: 1
        }
    } = {}) {
        this.sampler = new GreenFrameSampler({ targetWidth, imageFilter });
        this.lockTracker = new LockOnHandTracker({ greenLockMs, lockDistancePx });
        this.detectOptions = detectOptions;
        this.debug = (typeof localStorage !== 'undefined') && localStorage.getItem('greenBandDebug') === '1';
        this._lastDebugLogMs = 0;
    }

    filter(results) {
        const hands = results?.multiHandLandmarks;
        if (!hands || hands.length === 0) return null;

        if (!this.sampler.update(results.image)) return null;

        const { width, height } = getImageSize(results.image);
        const handednessArr = results.multiHandedness || [];
        const nowMs = performance.now();

        const candidates = hands.map((lm, index) => {
            const handedness = handednessArr[index]?.label || handednessArr[index]?.[0]?.label || null;
            const centerPx = computeHandCenterPx(lm, width, height);
            const hasGreen = this.sampler.handHasGreenBand(lm, this.detectOptions);
            return { index, handedness, centerPx, hasGreen };
        });

        if (this.debug && (nowMs - this._lastDebugLogMs) > 750) {
            this._lastDebugLogMs = nowMs;
            const summary = candidates.map(c => `${c.index}:${c.handedness || '?'}:${c.hasGreen ? 'green' : 'no'}`).join(' | ');
            // eslint-disable-next-line no-console
            console.log(`[GreenBand] ${summary}`);
        }

        const chosenIndex = this.lockTracker.select(candidates, nowMs);
        if (chosenIndex == null) return null;

        const chosenLm = hands[chosenIndex];
        const chosenHandedness = handednessArr[chosenIndex] ? [handednessArr[chosenIndex]] : [];
        const chosenMeta = candidates[chosenIndex];
        const greenCount = candidates.reduce((n, c) => n + (c.hasGreen ? 1 : 0), 0);
        const trackMode = chosenMeta?.hasGreen ? 'green' : 'locked';

        return {
            ...results,
            multiHandLandmarks: [chosenLm],
            multiHandedness: chosenHandedness,
            __greenBand: { trackMode, greenCount }
        };
    }
}
