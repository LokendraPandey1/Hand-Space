import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { updateStatus } from '../ui/overlay.js';

export const MODELS = [
    // Anatomy
    { name: 'Human Heart', file: 'heart.glb', category: 'Anatomy', icon: '🫀', thumbnail: 'thumbnails/heart.webp' },
    { name: 'Beating Heart', file: 'beating_heart_3D.glb', category: 'Anatomy', icon: '💓', thumbnail: 'thumbnails/beating_heart.webp', animated: true },
    { name: 'Human Lungs', file: 'lungs.glb', category: 'Anatomy', icon: '🫁', thumbnail: 'thumbnails/lungs.webp' },
    { name: 'Human Kidney', file: 'kidney (1).glb', category: 'Anatomy', icon: '🫘', thumbnail: 'thumbnails/kidney.webp' },
    { name: 'Colored Brain', file: 'colored_brain_model.glb', category: 'Anatomy', icon: '🧠', thumbnail: 'thumbnails/brain.webp' },
    { name: 'Detailed Brain', file: 'brain_model_right_-_general_anatomy.glb', category: 'Anatomy', icon: '🧠', thumbnail: 'thumbnails/brain_detailed.webp' },
    { name: 'Human Skeleton', file: 'free_pack_-_human_skeleton.glb', category: 'Anatomy', icon: '🦴', thumbnail: 'thumbnails/skeleton.webp' },
    { name: 'Cross Section Eye', file: 'cross_section_of_eye_-_anatomy.glb', category: 'Anatomy', icon: '👁️', thumbnail: 'thumbnails/eye.webp' },
    { name: 'Anatomical Scan', file: 'anatomical_scan_test.glb', category: 'Anatomy', icon: '🩻', thumbnail: 'thumbnails/scan.webp' },
    { name: 'Full Anatomy Model', file: 'model_huma_anatomic_cos_mdeie.glb', category: 'Anatomy', icon: '🧍', thumbnail: 'thumbnails/anatomy.webp' },

    // Chemistry
    { name: 'Benzene Molecule', file: 'chemistry_benzene.glb', category: 'Chemistry', icon: '⬡', thumbnail: 'thumbnails/benzene.webp' },
    { name: 'H2O Molecule', file: 'h2o_molecule.glb', category: 'Chemistry', icon: '💧', thumbnail: 'thumbnails/h2o.webp' },
    { name: 'H2O Detailed', file: 'h2o_molecule_3d_model.glb', category: 'Chemistry', icon: '🌊', thumbnail: 'thumbnails/h2o_detailed.webp' },
    { name: 'Glucose Molecule', file: 'glucose_molecule.glb', category: 'Chemistry', icon: '🍬', thumbnail: 'thumbnails/glucose.webp' },
    { name: 'CO2 Molecule', file: 'co2.glb', category: 'Chemistry', icon: '💨', thumbnail: 'thumbnails/co2.webp' },
    { name: 'P Orbitals', file: 'p_orbitals_updated.glb', category: 'Chemistry', icon: '⚛️', thumbnail: 'thumbnails/orbitals.webp' },

    // Earth Science
    { name: 'Earth Core', file: 'earth_core_v2.glb', category: 'Earth Science', icon: '🌍', thumbnail: 'thumbnails/earth.webp' },
    { name: 'Volcano', file: 'earth_volcano.glb', category: 'Earth Science', icon: '🌋', thumbnail: 'thumbnails/volcano.webp' },

    // Space
    { name: 'Mars Rover Perseverance', file: 'perseverance_-_nasa_mars_landing_2021.glb', category: 'Space', icon: '🤖', thumbnail: 'thumbnails/rover.webp' },
    { name: 'Hubble Telescope', file: 'hubble_space_telescope.glb', category: 'Space', icon: '🔭', thumbnail: 'thumbnails/hubble.webp' },
    { name: 'James Webb Telescope', file: 'james_webb_space_telescope.glb', category: 'Space', icon: '🛰️', thumbnail: 'thumbnails/jwst.webp' },
    { name: 'Rocket Ship', file: 'gorilla_tag_rocket_ship.glb', category: 'Space', icon: '🚀', thumbnail: 'thumbnails/rocket.webp' },

    // Engineering
    { name: 'Car Engine', file: 'car_engine_19_mb (1).glb', category: 'Engineering', icon: '🚗', thumbnail: 'thumbnails/engine.webp' },
    { name: 'Jet Engine', file: 'jet_engine.glb', category: 'Engineering', icon: '✈️', thumbnail: 'thumbnails/jet.webp' },

    // Default
    { name: 'Default Model', file: 'model.glb', category: 'Basics', icon: '📦', thumbnail: 'thumbnails/default.webp' }
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
        this.baseScale = 1;
        this.currentModelMeta = null;
        this.uploadedModels = [];
        this.mixer = null;
        this.clock = new THREE.Clock();
    }

    /**
     * Update animations - call this in render loop
     */
    update(dtSeconds) {
        if (this.mixer) {
            const delta = dtSeconds != null ? dtSeconds : this.clock.getDelta();
            this.mixer.update(delta);
        }
    }

    /**
     * Fade out the current model
     */
    fadeOut(duration = 500) {
        return new Promise((resolve) => {
            if (!this.activeModel) {
                resolve();
                return;
            }

            const startTime = Date.now();
            const fade = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const opacity = 1 - progress;

                this.activeModel.traverse((node) => {
                    if (node.isMesh && node.material) {
                        const materials = Array.isArray(node.material) ? node.material : [node.material];
                        materials.forEach(mat => {
                            mat.transparent = true;
                            mat.opacity = opacity;
                        });
                    }
                });

                if (progress < 1) {
                    requestAnimationFrame(fade);
                } else {
                    resolve();
                }
            };
            fade();
        });
    }

    /**
     * Fade in the current model
     */
    fadeIn(duration = 500) {
        return new Promise((resolve) => {
            if (!this.activeModel) {
                resolve();
                return;
            }

            // Start with opacity 0
            this.activeModel.traverse((node) => {
                if (node.isMesh && node.material) {
                    const materials = Array.isArray(node.material) ? node.material : [node.material];
                    materials.forEach(mat => {
                        mat.transparent = true;
                        mat.opacity = 0;
                    });
                }
            });

            const startTime = Date.now();
            const fade = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const opacity = progress;

                this.activeModel.traverse((node) => {
                    if (node.isMesh && node.material) {
                        const materials = Array.isArray(node.material) ? node.material : [node.material];
                        materials.forEach(mat => {
                            mat.opacity = opacity;
                            if (opacity >= 1) {
                                mat.transparent = false;
                            }
                        });
                    }
                });

                if (progress < 1) {
                    requestAnimationFrame(fade);
                } else {
                    resolve();
                }
            };
            fade();
        });
    }

    /**
     * Fetch user-uploaded models from the API
     */
    async loadUploadedModels() {
        try {
            const res = await fetch('/api/models');
            if (res.ok) {
                const models = await res.json();
                this.uploadedModels = models.map(m => ({
                    name: m.name,
                    file: m.filename,
                    category: m.category,
                    isUploaded: true
                }));
            }
        } catch (err) {
            console.warn('Could not fetch uploaded models:', err);
        }
    }

    /**
     * Get all models (built-in + uploaded)
     */
    getAvailableModels() {
        return [...MODELS, ...this.uploadedModels];
    }

    reset() {
        if (this.activeModel) {
            this.activeModel.rotation.set(0, 0, 0);
            this.activeModel.position.set(0, 0, 0);
            this.activeModel.scale.setScalar(this.baseScale);
        }
    }

    scale(multiplier) {
        if (this.activeModel) {
            this.activeModel.scale.multiplyScalar(multiplier);
        }
    }

    resetScale() {
        if (this.activeModel) {
            this.activeModel.scale.set(1, 1, 1);
        }
    }

    getTarget() {
        return this.activeModel;
    }

    getCurrentModelMetadata() {
        return this.currentModelMeta || { name: 'Unknown Model', file: 'unknown' };
    }

    load(modelFile, onLoaded = null) {
        // Find meta info - check both built-in and uploaded models
        let meta = MODELS.find(m => m.file === modelFile);

        // If not found in built-in, check uploaded models
        if (!meta) {
            meta = this.uploadedModels.find(m => m.file === modelFile);
        }

        this.currentModelMeta = meta || { name: modelFile, file: modelFile };

        if (this.activeModel) {
            this.sceneRef.remove(this.activeModel);

            this.activeModel.traverse((node) => {
                if (node.isMesh) {
                    node.geometry.dispose();
                    if (node.material) {
                        const materials = Array.isArray(node.material) ? node.material : [node.material];
                        materials.forEach(mat => mat.dispose());
                    }
                }
            });
            this.activeModel = null;
        }

        const gltfLoader = new GLTFLoader();
        gltfLoader.register((parser) => new KHRMaterialsPbrSpecularGlossinessExtension(parser));
        updateStatus(`Loading ${this.currentModelMeta.name}...`);

        // All models (built-in and uploaded) are in the same 'models/' folder
        gltfLoader.load(`models/${modelFile}`, (gltfData) => {
            const loadedScene = gltfData.scene;

            // Handle animations
            if (this.mixer) {
                this.mixer.stopAllAction();
                this.mixer = null;
            }

            if (gltfData.animations && gltfData.animations.length > 0) {
                this.mixer = new THREE.AnimationMixer(loadedScene);
                gltfData.animations.forEach((clip) => {
                    const action = this.mixer.clipAction(clip);
                    action.play();
                });
                console.log(`Playing ${gltfData.animations.length} animation(s)`);
            }

            loadedScene.updateMatrixWorld(true);
            const boundingBox = new THREE.Box3().setFromObject(loadedScene);
            const boxCenter = boundingBox.getCenter(new THREE.Vector3());
            const boxDimensions = boundingBox.getSize(new THREE.Vector3());

            loadedScene.position.set(
                -boxCenter.x,
                -boundingBox.min.y,
                -boxCenter.z
            );

            this.activeModel = new THREE.Group();
            this.activeModel.add(loadedScene);

            const largestDimension = Math.max(boxDimensions.x, boxDimensions.y, boxDimensions.z);
            if (largestDimension > 0) {
                this.baseScale = 2 / largestDimension;
                this.activeModel.scale.setScalar(this.baseScale);
            }

            this.sceneRef.add(this.activeModel);
            console.log(`Loaded ${this.currentModelMeta.name}`);
            updateStatus(this.mixer ? "Ready (Animated)" : "Ready");

            if (onLoaded) onLoaded();
        },
            (progressEvent) => {
                const percentComplete = Math.round((progressEvent.loaded / progressEvent.total) * 100);
                updateStatus(`Loading: ${percentComplete}%`);
            },
            (errorEvent) => {
                console.error("Load error", errorEvent);
                updateStatus(`Error: ${errorEvent.message || 'Failed'}`);
            });
    }
}
