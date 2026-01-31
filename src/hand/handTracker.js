let handDetectorRef = null;

export function initHandTracker(videoElem, resultHandler) {
    const handDetector = new Hands({
        locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
    });

    handDetector.setOptions({
        maxNumHands: 1, // Default to one-handed mode
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    handDetector.onResults(resultHandler);
    handDetectorRef = handDetector;

    const cam = new Camera(videoElem, {
        onFrame: async () => await handDetector.send({ image: videoElem }),
        width: 640,
        height: 480
    });

    cam.start()
        .then(() => {
            console.log("Camera started successfully");
        })
        .catch((err) => {
            console.error("Camera Access Error:", err);

            // Helpful user alert
            let msg = "Camera access failed.";
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                msg = "🚫 Camera Access Denied.\n\nPlease click the 'Lock' icon 🔒 in your address bar, Allow Camera access, and Reload the page.";
            } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                msg = "📷 No Camera Found.\n\nPlease connect a webcam to use this app.";
            } else {
                msg = `⚠️ Camera Error: ${err.message}`;
            }
            alert(msg);
        });
}

/**
 * Dynamically set the number of hands to detect
 * @param {number} numHands - 1 or 2
 */
export function setMaxHands(numHands) {
    if (handDetectorRef) {
        handDetectorRef.setOptions({ maxNumHands: numHands });
        console.log(`Hand detection set to: ${numHands} hand(s)`);
    }
}
