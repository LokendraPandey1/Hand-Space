import * as THREE from 'three';

export function initScene(canvasElem) {
    const sceneObj = new THREE.Scene();
    sceneObj.background = new THREE.Color(0x6b6b6b);

    const webglRenderer = new THREE.WebGLRenderer({
        canvas: canvasElem,
        antialias: true,
        preserveDrawingBuffer: true // Required for screenshots
    });
    webglRenderer.setSize(window.innerWidth, window.innerHeight);
    webglRenderer.shadowMap.enabled = true;
    webglRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Fix for proper color rendering of GLB models
    webglRenderer.outputColorSpace = THREE.SRGBColorSpace;
    webglRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    webglRenderer.toneMappingExposure = 1.0;

    window.addEventListener('resize', () => {
        webglRenderer.setSize(window.innerWidth, window.innerHeight);
    });

    return { scene: sceneObj, renderer: webglRenderer };
}
