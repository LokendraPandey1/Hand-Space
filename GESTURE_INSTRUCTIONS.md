# HandSpace Gesture Controls

## Overview
HandSpace uses hand tracking to manipulate 3D models and control the camera. Use different finger pinch gestures to activate various controls.

---

## Single-Hand Gestures

### 🔄 Rotate Model (Index Finger Pinch)
**How to use:**
- Pinch your **thumb** and **index finger** together
- Keep other fingers extended
- Move your hand left/right to rotate the model horizontally
- Move your hand up/down to rotate the model vertically

**What it does:**
- Orbits the model around its center
- Vertical rotation is clamped to prevent flipping

---

### ✊ Pan Model (Fist Gesture)
**How to use:**
- Curl your **four fingers** (Index, Middle, Ring, Pinky) into a fist
- Thumb position does not matter
- Move your hand in any direction

**What it does:**
- Moves the model left, right, up, or down
- Follows your hand movement for intuitive positioning

---

### 📏 Scale Model (Pinky Finger Pinch)
**How to use:**
- Pinch your **thumb** and **pinky finger** together
- Keep other fingers extended
- Move your hand up to enlarge the model
- Move your hand down to shrink the model

**What it does:**
- Increases or decreases model size
- Maintains proportions

---

### 🔄 Toggle Model Variant (Ring Finger Pinch)
**How to use:**
- Pinch your **thumb** and **ring finger** together
- Release to trigger
- Wait for the fade transition

**What it does:**
- Switches between different versions of the model (e.g., Static vs. Animated)
- Applies a smooth fade effect during the switch

---
### ✌️ Toggle Hand Mode (Peace Sign)
**How to use:**
- Hold up your **Index** and **Middle** fingers (Peace Sign)
- **Hold for 2 seconds**
- Ensure other fingers are curled

**What it does:**
- Toggles between **One-Handed** and **Two-Handed** integration
- Useful to lock interaction to a single hand or enable two-hand features like Zooming

---

## Two-Hand Gestures

### 🔍 Zoom Camera (Two-Hand Pinch)
**How to use:**
- Pinch **thumb** and **index finger** on **both hands**
- Move hands apart to zoom in (move camera closer)
- Move hands together to zoom out (move camera farther)

**What it does:**
- Moves the camera forward or backward along its view direction
- Provides smooth zoom control

---

## Tips

- **Keep unused fingers extended** - This helps the system distinguish between different gestures
- **Smooth movements** - The system includes smoothing to reduce jitter, so move deliberately
- **One gesture at a time** - Release one gesture before starting another for best results
- **Lighting matters** - Ensure good lighting for accurate hand tracking

---

## Gesture Priority

If multiple gestures are detected simultaneously, the system follows this priority:
1. Two-hand pinch (zoom)
2. Single-hand gestures (rotate, pan, scale, camera vertical)
3. Idle (no gesture)
