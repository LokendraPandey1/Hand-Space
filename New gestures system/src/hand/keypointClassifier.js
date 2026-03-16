function parseLabels(csvText) {
    return csvText
        .split(/\r?\n/g)
        .map(l => l.trim())
        .filter(Boolean);
}

function toKeypointFeatures(landmarks, { mirrorX = false } = {}) {
    if (!landmarks || landmarks.length < 21) return null;

    const baseX = landmarks[0].x;
    const baseY = landmarks[0].y;

    const rel = [];
    let maxAbs = 0;
    for (let i = 0; i < 21; i++) {
        const xRaw = landmarks[i].x - baseX;
        const x = mirrorX ? -xRaw : xRaw;
        const y = landmarks[i].y - baseY;
        rel.push(x, y);
        const ax = Math.abs(x);
        const ay = Math.abs(y);
        if (ax > maxAbs) maxAbs = ax;
        if (ay > maxAbs) maxAbs = ay;
    }

    if (maxAbs > 0) {
        for (let i = 0; i < rel.length; i++) rel[i] /= maxAbs;
    }
    return rel;
}

function loadScriptOnce(url) {
    const key = `__script__${url}`;
    if (globalThis[key]) return globalThis[key];

    globalThis[key] = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = url;
        s.async = true;
        s.crossOrigin = 'anonymous';
        s.onload = () => resolve();
        s.onerror = () => reject(new Error(`Failed to load script: ${url}`));
        document.head.appendChild(s);
    });

    return globalThis[key];
}

export class KeypointClassifier {
    constructor({
        modelUrl = 'guestures_recognition/keypoint_classifier.tflite',
        labelsUrl = 'guestures_recognition/keypoint_classifier_label.csv',
        cacheBust = false,
        tfjsUrl = 'node_modules/@tensorflow/tfjs/dist/tf.min.js',
        tfliteUrl = 'node_modules/@tensorflow/tfjs-tflite/dist/tf-tflite.min.js'
    } = {}) {
        this.modelUrl = modelUrl;
        this.labelsUrl = labelsUrl;
        this.cacheBust = cacheBust;
        this.tfjsUrl = tfjsUrl;
        this.tfliteUrl = tfliteUrl;
        this.labels = [];
        this.model = null;
        this.ready = false;
        this.loadError = null;
        this.outputSize = null;
        this._warnedSizeMismatch = false;
    }

    async load() {
        if (this.ready || this.loadError) return;

        try {
            const bust = this.cacheBust ? `?v=${Date.now()}` : '';

            if (typeof document !== 'undefined') {
                if (!globalThis.tf) await loadScriptOnce(this.tfjsUrl);
                if (!globalThis.tflite) await loadScriptOnce(this.tfliteUrl);
            }

            const labelsText = await fetch(`${this.labelsUrl}${bust}`, { cache: 'no-store' }).then(r => {
                if (!r.ok) throw new Error(`labels fetch failed (${r.status})`);
                return r.text();
            });
            this.labels = parseLabels(labelsText);

            const tf = globalThis.tf;
            const tflite = globalThis.tflite;
            if (!tf || !tflite) throw new Error('TensorFlow.js / tflite runtime not loaded');
            if (typeof tflite.loadTFLiteModel !== 'function') throw new Error('tflite.loadTFLiteModel not available');

            if (typeof tflite.setWasmPath === 'function') {
                tflite.setWasmPath('/node_modules/@tensorflow/tfjs-tflite/wasm/');
            }

            this.model = await tflite.loadTFLiteModel(`${this.modelUrl}${bust}`);
            this.ready = true;
        } catch (e) {
            this.loadError = e;
            // eslint-disable-next-line no-console
            console.error('[KeypointClassifier] load failed:', e);
        }
    }

    classify(landmarks, { mirrorX = false } = {}) {
        if (!this.ready || !this.model) return null;
        const features = toKeypointFeatures(landmarks, { mirrorX });
        if (!features) return null;

        const tf = globalThis.tf;
        const probs = tf.tidy(() => {
            const input = tf.tensor2d([features], [1, features.length], 'float32');
            const raw = this.model.predict(input);
            const logits = Array.isArray(raw) ? raw[0] : raw;
            const soft = tf.softmax(logits);
            return soft.dataSync();
        });

        this.outputSize = probs.length;
        const usable = Math.min(probs.length, this.labels.length || probs.length);
        if (!this._warnedSizeMismatch && this.labels.length > 0 && probs.length !== this.labels.length) {
            this._warnedSizeMismatch = true;
            // eslint-disable-next-line no-console
            console.warn(`[KeypointClassifier] output size (${probs.length}) != labels (${this.labels.length}). Check model/label match.`);
        }

        let bestIdx = 0;
        let best = probs[0] ?? 0;
        for (let i = 1; i < usable; i++) {
            const v = probs[i];
            if (v > best) {
                best = v;
                bestIdx = i;
            }
        }

        return {
            labelIndex: bestIdx,
            label: this.labels[bestIdx] ?? String(bestIdx),
            confidence: best
        };
    }
}
