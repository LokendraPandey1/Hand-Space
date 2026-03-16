import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function initCamera(rendererObj) {
    const perspectiveCam = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
    perspectiveCam.position.set(0, 2.5, 3);

    const orbitCtrl = new OrbitControls(perspectiveCam, rendererObj.domElement);
    orbitCtrl.enableDamping = true;
    orbitCtrl.dampingFactor = 0.05;
    orbitCtrl.target.set(0, 0.8, 0);

    window.addEventListener('resize', () => {
        perspectiveCam.aspect = window.innerWidth / window.innerHeight;
        perspectiveCam.updateProjectionMatrix();
    });

    return { camera: perspectiveCam, controls: orbitCtrl };
}
