import * as THREE from 'three';

export class ObjectSelector {
    constructor(camera, canvas) {
        this.camera = camera;
        this.canvas = canvas;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
    }

    /**
     * Casts a ray from mouse coordinates to find intersected objects.
     * @param {MouseEvent} event 
     * @param {THREE.Object3D} targetObject 
     * @returns {THREE.Intersection|null}
     */
    select(event, targetObject) {
        if (!targetObject) return null;

        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        const intersects = this.raycaster.intersectObject(targetObject, true);

        if (intersects.length > 0) {
            return intersects[0];
        }
        return null;
    }
}
