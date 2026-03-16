function sqr(n) {
    return n * n;
}

function distSq(a, b) {
    return sqr(a.x - b.x) + sqr(a.y - b.y);
}

export class LockOnHandTracker {
    constructor({ greenLockMs = 2000, lockDistancePx = 160 } = {}) {
        this.greenLockMs = greenLockMs;
        this.lockDistancePx = lockDistancePx;

        this.locked = false;
        this.lockedHandedness = null;
        this.lastGreenMs = 0;
        this.lastCenterPx = { x: 0, y: 0 };
    }

    reset() {
        this.locked = false;
        this.lockedHandedness = null;
        this.lastGreenMs = 0;
    }

    select(candidates, nowMs) {
        if (!candidates || candidates.length === 0) {
            this._expireIfNeeded(nowMs);
            return null;
        }

        const greenCandidates = candidates.filter(c => c.hasGreen);
        if (greenCandidates.length > 0) {
            const chosen = this._chooseBestGreen(greenCandidates);
            this.locked = true;
            this.lockedHandedness = chosen.handedness;
            this.lastGreenMs = nowMs;
            this.lastCenterPx = chosen.centerPx;
            return chosen.index;
        }

        if (!this.locked) return null;
        if (nowMs - this.lastGreenMs > this.greenLockMs) {
            this.reset();
            return null;
        }

        const maxDistSq = sqr(this.lockDistancePx);
        let best = null;
        let bestDist = Infinity;

        for (const c of candidates) {
            if (this.lockedHandedness && c.handedness && c.handedness !== this.lockedHandedness) continue;
            const d = distSq(c.centerPx, this.lastCenterPx);
            if (d <= maxDistSq && d < bestDist) {
                best = c;
                bestDist = d;
            }
        }

        if (best) {
            this.lastCenterPx = best.centerPx;
            return best.index;
        }

        return null;
    }

    _chooseBestGreen(greenCandidates) {
        if (!this.locked) return greenCandidates[0];

        let best = null;
        let bestDist = Infinity;
        for (const c of greenCandidates) {
            if (this.lockedHandedness && c.handedness && c.handedness !== this.lockedHandedness) continue;
            const d = distSq(c.centerPx, this.lastCenterPx);
            if (d < bestDist) {
                best = c;
                bestDist = d;
            }
        }
        return best || greenCandidates[0];
    }

    _expireIfNeeded(nowMs) {
        if (this.locked && nowMs - this.lastGreenMs > this.greenLockMs) {
            this.reset();
        }
    }
}

