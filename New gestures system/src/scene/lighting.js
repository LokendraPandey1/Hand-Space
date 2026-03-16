import * as THREE from 'three';

export function initLights(sceneObj) {
    const baseAmbient = new THREE.AmbientLight(0xffffff, 0.5);
    sceneObj.add(baseAmbient);

    const skyGroundLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    skyGroundLight.position.set(0, 20, 0);
    sceneObj.add(skyGroundLight);

    const mainDirectional = new THREE.DirectionalLight(0xffffff, 0.8);
    mainDirectional.position.set(2, 5, 2);
    mainDirectional.castShadow = false;
    sceneObj.add(mainDirectional);
}
