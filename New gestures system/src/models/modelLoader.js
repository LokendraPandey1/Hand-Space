import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { updateStatus } from '../ui/overlay.js';

export const MODELS = [
    { name: 'Default Model', file: 'model.glb' },
    { name: 'Human Skeleton', file: 'free_pack_-_human_skeleton.glb' },
    { name: 'Human Heart', file: 'heart.glb' },
    { name: 'Beating Heart', file: 'beating_heart_3d.glb' },
    { name: 'Human Brain', file: 'colored_brain_model.glb' },
    { name: 'Human Lungs', file: 'lungs.glb' },
    { name: 'Full Anatomy', file: 'model_huma_anatomic_cos_mdeie.glb' },
    { name: 'Anatomical Scan', file: 'anatomical_scan_test.glb' },
    { name: 'Jet Engine', file: 'jet_engine.glb' },
    { name: 'Rocket Ship', file: 'gorilla_tag_rocket_ship.glb' },
    { name: 'Robotic Arm', file: 'black_honey_-_robotic_arm.glb' },
    { name: 'NASA Curiosity Rover', file: 'nasa_curiosity_clean.glb' },
    { name: 'Exploding Skull', file: 'visible_interactive_human_-_exploding_skull.glb' },
    { name: 'Animated Astronaut (Loop)', file: 'animated_astronaut_character_in_space_suit_loop.glb' },
    { name: 'Animated T-Rex Run (Loop)', file: 'animated_tyrannosaurus_rex_dinosaur_running_loop.glb' }
];

// Registers the legacy spec/gloss workflow so GLTFLoader doesn't warn about the extension.
class KHRMaterialsPbrSpecularGlossinessExtension {
    constructor(parser) {
        this.parser = parser;
        this.name = 'KHR_materials_pbrSpecularGlossiness';
    }

    getMaterialType() {
        return THREE.MeshPhysicalMaterial;
    }

    extendMaterialParams(materialIndex, materialParams) {
        const parser = this.parser;
        const matDef = parser.json.materials?.[materialIndex];
        const ext = matDef?.extensions?.KHR_materials_pbrSpecularGlossiness;
        if (!ext) return;

        const diffuseFactor = Array.isArray(ext.diffuseFactor) ? ext.diffuseFactor : [1, 1, 1, 1];
        materialParams.color = new THREE.Color().fromArray(diffuseFactor);
        materialParams.opacity = typeof diffuseFactor[3] === 'number' ? diffuseFactor[3] : 1;
        materialParams.transparent = materialParams.opacity < 1;

        // Approximate conversion to metal/rough.
        materialParams.metalness = 0.0;
        if (typeof ext.glossinessFactor === 'number') {
            materialParams.roughness = Math.min(1, Math.max(0, 1 - ext.glossinessFactor));
        }

        const pending = [];
        if (ext.diffuseTexture?.index != null) {
            pending.push(
                parser.getDependency('texture', ext.diffuseTexture.index).then((tex) => {
                    if (!tex) return;
                    tex.colorSpace = THREE.SRGBColorSpace;
                    tex.needsUpdate = true;
                    materialParams.map = tex;
                })
            );
        }

        if (pending.length) return Promise.all(pending);
    }
}

export class ModelManager {
    constructor(sceneRef) {
        this.sceneRef = sceneRef;
        this.activeModel = null;
        this.mixer = null;
        this.actions = [];
        this.baseScale = 1;
        this.basePosition = new THREE.Vector3(0, 1, 0);
        this.currentModelName = '3D Model';
    }

    getCurrentModelName() {
        return this.currentModelName;
    }

    reset() {
        if (this.activeModel) {
            this.activeModel.rotation.set(0, 2, 0);
            this.activeModel.position.copy(this.basePosition);
            this.activeModel.scale.setScalar(this.baseScale);
        }
    }

    scale(multiplier) {
        if (this.activeModel) {
            this.activeModel.scale.multiplyScalar(multiplier);
        }
    }

    getTarget() {
        return this.activeModel;
    }

    getAvailableModels() {
        return MODELS;
    }

    update(dtSeconds) {
        if (!dtSeconds || dtSeconds <= 0) return;
        if (this.mixer) this.mixer.update(dtSeconds);
    }

    load(modelFile) {
        const modelInfo = MODELS.find((m) => m.file === modelFile);
        this.currentModelName = modelInfo ? modelInfo.name : '3D Model';

        if (this.activeModel) {
            this.sceneRef.remove(this.activeModel);

            this.activeModel.traverse((node) => {
                if (node.isMesh) {
                    node.geometry.dispose();
                    if (node.material) {
                        const materials = Array.isArray(node.material) ? node.material : [node.material];
                        materials.forEach((mat) => mat.dispose());
                    }
                }
            });
            this.activeModel = null;
        }

        if (this.mixer) {
            this.mixer.stopAllAction();
            this.mixer = null;
            this.actions = [];
        }

        const gltfLoader = new GLTFLoader();
        gltfLoader.register((parser) => new KHRMaterialsPbrSpecularGlossinessExtension(parser));
        updateStatus(`Loading ${modelFile}...`);

        gltfLoader.load(
            `models/${modelFile}`,
            (gltfData) => {
                const loadedScene = gltfData.scene;

                loadedScene.updateMatrixWorld(true);
                const boundingBox = new THREE.Box3().setFromObject(loadedScene);
                const boxCenter = boundingBox.getCenter(new THREE.Vector3());
                const boxDimensions = boundingBox.getSize(new THREE.Vector3());

                this.activeModel = new THREE.Group();
                this.activeModel.add(loadedScene);
                this.activeModel.position.set(-boxCenter.x, -boundingBox.min.y, -boxCenter.z);
                this.basePosition.copy(this.activeModel.position);

                const largestDimension = Math.max(boxDimensions.x, boxDimensions.y, boxDimensions.z);
                if (largestDimension > 0) {
                    this.baseScale = 2 / largestDimension;
                    this.activeModel.scale.setScalar(this.baseScale);
                }

                if (Array.isArray(gltfData.animations) && gltfData.animations.length > 0) {
                    this.mixer = new THREE.AnimationMixer(loadedScene);
                    this.actions = gltfData.animations.map((clip) => {
                        const action = this.mixer.clipAction(clip);
                        action.play();
                        return action;
                    });
                }

                this.sceneRef.add(this.activeModel);
                console.log(`Loaded ${modelFile}`);
                updateStatus('Ready');
            },
            (progressEvent) => {
                const total = progressEvent.total || 0;
                if (total > 0) {
                    const percentComplete = Math.round((progressEvent.loaded / total) * 100);
                    updateStatus(`Loading: ${percentComplete}%`);
                } else {
                    updateStatus(`Loading: ${Math.round(progressEvent.loaded / 1024)} KB`);
                }
            },
            (errorEvent) => {
                console.error('Load error', errorEvent);
                updateStatus(`Error: ${errorEvent.message || 'Failed'}`);
            }
        );
    }
}
