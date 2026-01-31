import * as THREE from 'three';

export function initLights(sceneObj) {
    // Increased intensity for proper GLB color rendering
    const baseAmbient = new THREE.AmbientLight(0xffffff, 1.5);
    sceneObj.add(baseAmbient);

    const skyGroundLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
    skyGroundLight.position.set(0, 20, 0);
    sceneObj.add(skyGroundLight);

    const mainDirectional = new THREE.DirectionalLight(0xffffff, 2.0);
    mainDirectional.position.set(2, 5, 2);
    mainDirectional.castShadow = true;
    mainDirectional.shadow.mapSize.width = 1024;
    mainDirectional.shadow.mapSize.height = 1024;
    sceneObj.add(mainDirectional);

    // Add fill light from opposite side
    const fillLight = new THREE.DirectionalLight(0xffffff, 1.0);
    fillLight.position.set(-2, 3, -2);
    sceneObj.add(fillLight);
}
