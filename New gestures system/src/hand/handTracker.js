export function initHandTracker(videoElem, resultHandler, {
    maxFps = 30,
    width = 640,
    height = 480,
    maxNumHands = 1,
    modelComplexity = 0,
    minDetectionConfidence = 0.55,
    minTrackingConfidence = 0.55
} = {}) {
    if (typeof Hands === 'undefined' || typeof Camera === 'undefined') {
        throw new Error('MediaPipe Hands scripts not loaded (Hands/Camera missing). Run `npm install` and ensure index.html loads MediaPipe from node_modules.');
    }

    const handDetector = new Hands({
        locateFile: (f) => `node_modules/@mediapipe/hands/${f}`
    });

    handDetector.setOptions({
        maxNumHands,
        modelComplexity,
        minDetectionConfidence,
        minTrackingConfidence
    });

    handDetector.onResults(resultHandler);

    let lastSendMs = 0;
    const minIntervalMs = maxFps > 0 ? (1000 / maxFps) : 0;

    const cam = new Camera(videoElem, {
        onFrame: async () => {
            if (minIntervalMs > 0) {
                const now = performance.now();
                if ((now - lastSendMs) < minIntervalMs) return;
                lastSendMs = now;
            }
            await handDetector.send({ image: videoElem });
        },
        width,
        height
    });

    cam.start();
}
