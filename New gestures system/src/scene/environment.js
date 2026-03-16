import * as THREE from "three";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

export function createEnvironment({ scene, assetManager }) {
  let enabled = true;
  let envTexture = null;
  const renderer = assetManager?.renderer;

  async function ensureLoaded({ hdrUrl }) {
    if (envTexture) {
      apply();
      return;
    }

    // HDRI path is user-supplied (assets/hdr). If it’s missing, fall back to a
    // procedural environment so the viewer still looks good out of the box.
    try {
      envTexture = await loadHdrEnvironment({ hdrUrl });
    } catch (err) {
      console.warn(
        "HDR environment failed to load, falling back to RoomEnvironment.",
        err
      );
      envTexture = buildRoomEnvironment();
    }

    apply();
  }

  function apply() {
    if (!enabled) {
      scene.environment = null;
      return;
    }
    scene.environment = envTexture;
  }

  function toggle() {
    enabled = !enabled;
    apply();
    return enabled;
  }

  async function loadHdrEnvironment({ hdrUrl }) {
    const loader = new RGBELoader();
    const hdr = await loader.loadAsync(hdrUrl);

    // HDR data is linear; do not mark it as sRGB.
    if ("colorSpace" in hdr) hdr.colorSpace = THREE.LinearSRGBColorSpace;
    hdr.mapping = THREE.EquirectangularReflectionMapping;

    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();

    const { texture } = pmrem.fromEquirectangular(hdr);
    // PMREM output is linear data.
    if ("colorSpace" in texture) texture.colorSpace = THREE.LinearSRGBColorSpace;
    hdr.dispose();
    pmrem.dispose();

    return assetManager?.trackPmremTexture?.(texture) ?? texture;
  }

  function buildRoomEnvironment() {
    // RoomEnvironment returns a scene; PMREM turns it into an envMap texture.
    const envScene = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const { texture } = pmrem.fromScene(envScene, 0.04);
    if ("colorSpace" in texture) texture.colorSpace = THREE.LinearSRGBColorSpace;
    pmrem.dispose();
    return assetManager?.trackPmremTexture?.(texture) ?? texture;
  }

  return {
    ensureLoaded,
    toggle,
    get enabled() {
      return enabled;
    }
  };
}


