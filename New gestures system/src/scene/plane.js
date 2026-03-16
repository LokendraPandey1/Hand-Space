import * as THREE from 'three';

export function initPlane(sceneObj) {
    const groundContainer = new THREE.Group();
    sceneObj.add(groundContainer);

    const perspectiveGrid = new THREE.GridHelper(30, 60, 0xaaaaaa, 0xaaaaaa);
    perspectiveGrid.material.opacity = 0.4;
    perspectiveGrid.material.transparent = true;
    groundContainer.add(perspectiveGrid);
}
