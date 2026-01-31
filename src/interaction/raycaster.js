import * as THREE from 'three';

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

/**
 * Casts a ray from camera through mouse position and returns the first mesh hit.
 * @param {MouseEvent} event - The pointer event
 * @param {THREE.Camera} camera - The active camera
 * @param {THREE.Scene} scene - The active scene
 * @returns {THREE.Mesh|null} The clicked mesh or null
 */
export function castRay(event, camera, scene) {
    // 1. Convert pixel coordinates to Normalized Device Coordinates (-1 to +1)
    // Formula: (x / width) * 2 - 1
    const rect = event.target.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    mouse.x = (x / rect.width) * 2 - 1;
    mouse.y = -(y / rect.height) * 2 + 1;

    // 2. Update the picking ray
    raycaster.setFromCamera(mouse, camera);

    // 3. intersectObjects(objects, recursive)
    // We want to check all children of the scene
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
        // Filter: We only want Meshes, not lines or helpers
        const found = intersects.find(hit => hit.object.isMesh && hit.object.visible);

        if (found) {
            console.log("🎯 Raycast Hit:", found.object.name);
            return found; // Return the full intersection object (contains .point, .object, etc.)
        }
    }

    return null; // Missed everything
}

/**
 * Casts a ray from camera through hand tracking coordinates.
 * MediaPipe gives coordinates in 0-1 range (normalized), where x is mirrored.
 * @param {number} handX - X from MediaPipe (0-1, mirrored)
 * @param {number} handY - Y from MediaPipe (0-1)
 * @param {THREE.Camera} camera - The active camera
 * @param {THREE.Scene} scene - The active scene
 * @returns {Object|null} The hit intersection or null
 */
export function castRayFromHand(handX, handY, camera, scene) {
    // MediaPipe coordinates: 
    // - x: 0 = left of video, 1 = right of video (but camera is mirrored!)
    // - y: 0 = top of video, 1 = bottom of video
    // We need to convert to NDC (-1 to +1) where:
    // - x: -1 = left, +1 = right
    // - y: -1 = bottom, +1 = top

    // Since camera is mirrored, we flip x
    mouse.x = (1 - handX) * 2 - 1;  // Flip and convert to -1 to +1
    mouse.y = -(handY * 2 - 1);      // Convert to +1 (top) to -1 (bottom)

    // Update the picking ray
    raycaster.setFromCamera(mouse, camera);

    // Find intersections
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
        // Filter: We only want Meshes, not lines/helpers/lights
        const found = intersects.find(hit => hit.object.isMesh && hit.object.visible);

        if (found) {
            return found;
        }
    }

    return null;
}
