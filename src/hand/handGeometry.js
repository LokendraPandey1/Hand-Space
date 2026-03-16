export function getImageSize(image) {
    if (!image) return { width: 0, height: 0 };
    if (typeof image.videoWidth === 'number' && typeof image.videoHeight === 'number') {
        return { width: image.videoWidth, height: image.videoHeight };
    }
    return { width: image.width || 0, height: image.height || 0 };
}

export function clampInt(value, min, max) {
    if (value < min) return min;
    if (value > max) return max;
    return value | 0;
}

export function computeHandCenterPx(landmarks, width, height) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (let i = 0; i < landmarks.length; i++) {
        const lm = landmarks[i];
        const x = lm.x * width;
        const y = lm.y * height;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
    }

    if (!Number.isFinite(minX)) return { x: 0, y: 0 };
    return { x: (minX + maxX) * 0.5, y: (minY + maxY) * 0.5 };
}
