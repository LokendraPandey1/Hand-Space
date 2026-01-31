import * as THREE from 'three';

export const PINCH_THRESHOLD = 0.05;

// Hand mode state - 'one' or 'two'
let handMode = 'one';
let lastPeaceTime = 0;
let peaceSignStartTime = 0;
const MODE_TOGGLE_COOLDOWN = 1500; // 1.5 seconds cooldown for mode toggle
const PEACE_HOLD_DURATION = 1500;

export function getHandMode() {
    return handMode;
}

export function setHandMode(mode) {
    handMode = mode;
}

export function getDistance(pt1, pt2) {
    const dx = pt1.x - pt2.x;
    const dy = pt1.y - pt2.y;
    return Math.sqrt(dx * dx + dy * dy);
}

export function isPinched(handMarkers) {
    return getDistance(handMarkers[4], handMarkers[8]) < PINCH_THRESHOLD;
}

/**
 * Check if all fingers are extended (open palm) - used for PANNING
 */
function isOpenPalm(handMarkers) {
    // Check if fingertips are above their respective knuckles (fingers extended)
    const indexExtended = handMarkers[8].y < handMarkers[6].y;
    const middleExtended = handMarkers[12].y < handMarkers[10].y;
    const ringExtended = handMarkers[16].y < handMarkers[14].y;
    const pinkyExtended = handMarkers[20].y < handMarkers[18].y;

    // Thumb extended (away from palm)
    const thumbExtended = Math.abs(handMarkers[4].x - handMarkers[2].x) > 0.05;

    return indexExtended && middleExtended && ringExtended && pinkyExtended && thumbExtended;
}

/**
 * Check if hand is making a fist (all fingers curled)
 */
function isFist(handMarkers) {
    const indexCurled = handMarkers[8].y > handMarkers[6].y;
    const middleCurled = handMarkers[12].y > handMarkers[10].y;
    const ringCurled = handMarkers[16].y > handMarkers[14].y;
    const pinkyCurled = handMarkers[20].y > handMarkers[18].y;

    return indexCurled && middleCurled && ringCurled && pinkyCurled;
}

/**
 * Check for peace sign (index and middle extended, others curled) - MODE TOGGLE
 */
function isPeaceSign(handMarkers) {
    const indexExtended = handMarkers[8].y < handMarkers[6].y;
    const middleExtended = handMarkers[12].y < handMarkers[10].y;
    const ringCurled = handMarkers[16].y > handMarkers[14].y;
    const pinkyCurled = handMarkers[20].y > handMarkers[18].y;

    // Also check fingers are spread apart (V shape)
    const fingersSpread = getDistance(handMarkers[8], handMarkers[12]) > 0.04;

    return indexExtended && middleExtended && ringCurled && pinkyCurled && fingersSpread;
}

/**
 * Check for thumbs up - AI TRIGGER
 */
function isThumbsUp(handMarkers) {
    const thumbUp = handMarkers[4].y < handMarkers[3].y && handMarkers[4].y < handMarkers[2].y;
    const indexCurled = handMarkers[8].y > handMarkers[6].y;
    const middleCurled = handMarkers[12].y > handMarkers[10].y;
    const ringCurled = handMarkers[16].y > handMarkers[14].y;
    const pinkyCurled = handMarkers[20].y > handMarkers[18].y;

    return thumbUp && indexCurled && middleCurled && ringCurled && pinkyCurled;
}

/**
 * Check for pointing gesture (only index extended) - Alternative AI trigger
 */
function isPointing(handMarkers) {
    const indexExtended = handMarkers[8].y < handMarkers[6].y;
    const middleCurled = handMarkers[12].y > handMarkers[10].y;
    const ringCurled = handMarkers[16].y > handMarkers[14].y;
    const pinkyCurled = handMarkers[20].y > handMarkers[18].y;

    return indexExtended && middleCurled && ringCurled && pinkyCurled;
}

export function detectGesture(handMarkers, numHands = 1) {
    const currentTime = Date.now();

    const fingerTips = {
        thumb: handMarkers[4],
        index: handMarkers[8],
        middle: handMarkers[12],
        ring: handMarkers[16],
        pinky: handMarkers[20]
    };

    const separationThreshold = 0.08;

    const gaps = {
        toIndex: getDistance(fingerTips.thumb, fingerTips.index),
        toMiddle: getDistance(fingerTips.thumb, fingerTips.middle),
        toRing: getDistance(fingerTips.thumb, fingerTips.ring),
        toPinky: getDistance(fingerTips.thumb, fingerTips.pinky)
    };

    const isOpen = (gap) => gap > separationThreshold;
    const isClosed = (gap) => gap < PINCH_THRESHOLD;

    // --- HAND MODE FILTER ---
    // If in one-handed mode and multiple hands detected, ignore
    if (handMode === 'one' && numHands > 1) {
        return 'IDLE'; // Ignore extra hands
    }



    // --- PEACE SIGN: Toggle hand mode ---
    if (isPeaceSign(handMarkers)) {
        if (peaceSignStartTime === 0) {
            peaceSignStartTime = currentTime;
        } else if (currentTime - peaceSignStartTime > PEACE_HOLD_DURATION) {
            if (currentTime - lastPeaceTime > MODE_TOGGLE_COOLDOWN) {
                handMode = handMode === 'one' ? 'two' : 'one';
                lastPeaceTime = currentTime;
                console.log(`Hand mode switched to: ${handMode}-handed`);
                peaceSignStartTime = 0; // Reset
                return 'MODE_TOGGLE';
            }
        }
        return 'IDLE'; // Holding...
    } else {
        peaceSignStartTime = 0;
    }



    // Check fist (all fingers including thumb curled) - PANNING
    if (isFist(handMarkers)) {
        return 'PANNING';
    }

    // --- POINTING: Index finger extended (for AI target selection) ---
    if (isPointing(handMarkers)) {
        return 'POINTING';
    }

    // --- PINCH GESTURES ---
    // Index pinch = Rotating
    if (isClosed(gaps.toIndex) && isOpen(gaps.toMiddle) && isOpen(gaps.toRing) && isOpen(gaps.toPinky)) {
        return 'ROTATING';
    }

    // --- COMPARATIVE PINCH LOGIC for Ring/Pinky (handles sympathetic motion) ---
    const ringPinched = isClosed(gaps.toRing);
    const pinkyPinched = isClosed(gaps.toPinky);

    if (isOpen(gaps.toIndex) && isOpen(gaps.toMiddle)) {
        if (ringPinched && pinkyPinched) {
            // Both pinched? Prioritize the tighter pinch
            return (gaps.toRing < gaps.toPinky) ? 'RING_PINCH' : 'SCALING';
        }
        if (ringPinched) return 'RING_PINCH';
        if (pinkyPinched) return 'SCALING';
    }

    return 'IDLE';
}
