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
            return found.object;
        }
    }

    return null; // Missed everything
}
