import * as THREE from "three";

export function applyDefaultLights({ scene }) {
  const hemi = new THREE.HemisphereLight(0xd7e7ff, 0x1a202c, 0.55);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3.5, 5.2, 2.8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 30;
  key.shadow.camera.left = -6;
  key.shadow.camera.right = 6;
  key.shadow.camera.top = 6;
  key.shadow.camera.bottom = -6;
  key.shadow.bias = -0.00008;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xb7e2ff, 0.7);
  fill.position.set(-4.5, 2.6, -2.2);
  scene.add(fill);

  return { hemi, key, fill };
}

