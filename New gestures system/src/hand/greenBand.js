import { clampInt } from './handGeometry.js';

export const GREEN_THRESHOLDS_DEFAULT = Object.freeze({
    hMin: 30,
    hMax: 95,
    sMin: 70,
    vMin: 40
});

const FINGERS = Object.freeze([
    [2, 3],
    [5, 6, 7],
    [9, 10, 11],
    [13, 14, 15],
    [17, 18, 19]
]);

function rgbToHsv255(r, g, b) {
    const rf = r / 255;
    const gf = g / 255;
    const bf = b / 255;

    const max = Math.max(rf, gf, bf);
    const min = Math.min(rf, gf, bf);
    const delta = max - min;

    let h = 0;
    if (delta !== 0) {
        if (max === rf) h = ((gf - bf) / delta) % 6;
        else if (max === gf) h = (bf - rf) / delta + 2;
        else h = (rf - gf) / delta + 4;
        h *= 60;
        if (h < 0) h += 360;
    }

    const s = max === 0 ? 0 : (delta / max);
    const v = max;

    return { h, s: s * 255, v: v * 255 };
}

function isGreenRgb(r, g, b, t) {
    const { h, s, v } = rgbToHsv255(r, g, b);
    const hsvOk = h >= t.hMin && h <= t.hMax && s >= t.sMin && v >= t.vMin;
    const greenDominant = g >= r + 15 && (g + 10) >= b;
    return hsvOk && greenDominant;
}

export class GreenFrameSampler {
    constructor({
        thresholds = GREEN_THRESHOLDS_DEFAULT,
        targetWidth = 320,
        imageFilter = 'brightness(1.15) contrast(1.1) saturate(1.2)'
    } = {}) {
        this.thresholds = thresholds;
        this.targetWidth = targetWidth;
        this.imageFilter = imageFilter;

        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.imageData = null;
        this.width = 0;
        this.height = 0;
    }

    update(sourceImage) {
        if (!this.ctx) return false;

        const srcW = (typeof sourceImage?.videoWidth === 'number') ? sourceImage.videoWidth : sourceImage?.width;
        const srcH = (typeof sourceImage?.videoHeight === 'number') ? sourceImage.videoHeight : sourceImage?.height;
        if (!srcW || !srcH) return false;

        const scale = Math.min(1, this.targetWidth / srcW);
        const w = Math.max(1, (srcW * scale) | 0);
        const h = Math.max(1, (srcH * scale) | 0);

        if (this.canvas.width !== w) this.canvas.width = w;
        if (this.canvas.height !== h) this.canvas.height = h;

        const prevFilter = this.ctx.filter;
        this.ctx.filter = this.imageFilter || 'none';
        this.ctx.drawImage(sourceImage, 0, 0, w, h);
        this.ctx.filter = prevFilter;
        this.imageData = this.ctx.getImageData(0, 0, w, h);
        this.width = w;
        this.height = h;
        return true;
    }

    handHasGreenBand(landmarks, {
        sampleRadiusPx = 6,
        minHitsPerFinger = 2,
        minGreenSamplesPerLandmark = 3,
        sampleStep = 2
    } = {}) {
        if (!this.imageData || !landmarks || landmarks.length < 21) return false;

        const data = this.imageData.data;
        const w = this.width;
        const h = this.height;
        const t = this.thresholds;

        const r = Math.max(1, sampleRadiusPx | 0);
        const step = Math.max(1, sampleStep | 0);
        const minSamples = Math.max(1, minGreenSamplesPerLandmark | 0);

        for (const finger of FINGERS) {
            let hits = 0;
            for (let i = 0; i < finger.length; i++) {
                const idx = finger[i];
                const lm = landmarks[idx];
                const cx = clampInt(lm.x * w, 0, w - 1);
                const cy = clampInt(lm.y * h, 0, h - 1);

                const x0 = clampInt(cx - r, 0, w - 1);
                const x1 = clampInt(cx + r, 0, w - 1);
                const y0 = clampInt(cy - r, 0, h - 1);
                const y1 = clampInt(cy + r, 0, h - 1);

                let greenSamples = 0;
                for (let yy = y0; yy <= y1; yy += step) {
                    const row = yy * w * 4;
                    for (let xx = x0; xx <= x1; xx += step) {
                        const p = row + xx * 4;
                        const rr = data[p];
                        const gg = data[p + 1];
                        const bb = data[p + 2];
                        if (isGreenRgb(rr, gg, bb, t)) {
                            greenSamples++;
                            if (greenSamples >= minSamples) break;
                        }
                    }
                    if (greenSamples >= minSamples) break;
                }

                if (greenSamples >= minSamples) {
                    hits++;
                    if (hits >= minHitsPerFinger) return true;
                }
            }
        }

        return false;
    }
}
