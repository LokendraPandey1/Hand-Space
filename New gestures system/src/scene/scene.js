import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

export function initScene(canvasElem) {
    const sceneObj = new THREE.Scene();
    sceneObj.background = new THREE.Color(0x6b6b6b);

    const webglRenderer = new THREE.WebGLRenderer({
        canvas: canvasElem,
        antialias: false,
        alpha: false,
        powerPreference: 'high-performance'
    });
    webglRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    webglRenderer.setSize(window.innerWidth, window.innerHeight);
    webglRenderer.shadowMap.enabled = false;
    webglRenderer.outputColorSpace = THREE.SRGBColorSpace;
    webglRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    webglRenderer.toneMappingExposure = 1.0;

    // Image-based lighting via HDR environment map (src/hdr/enviroment.hdr)
    try {
        const hdrUrl = new URL('../hdr/enviroment.hdr', import.meta.url);
        const pmremGenerator = new THREE.PMREMGenerator(webglRenderer);
        pmremGenerator.compileEquirectangularShader();

        new RGBELoader()
            .setDataType(THREE.HalfFloatType)
            .load(
                hdrUrl.href,
                (hdrEquirect) => {
                    const envMap = pmremGenerator.fromEquirectangular(hdrEquirect).texture;
                    hdrEquirect.dispose();
                    pmremGenerator.dispose();

                    sceneObj.environment = envMap;
                    sceneObj.background = envMap;
                },
                undefined,
                (err) => {
                    // eslint-disable-next-line no-console
                    console.error('HDR load failed:', err);
                    pmremGenerator.dispose();
                }
            );
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('HDR setup failed:', err);
    }

    window.addEventListener('resize', () => {
        webglRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
        webglRenderer.setSize(window.innerWidth, window.innerHeight);
    });

    return { scene: sceneObj, renderer: webglRenderer };
}
