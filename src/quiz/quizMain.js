import * as THREE from 'three';
import { initScene } from '../scene/scene.js';
import { initCamera } from '../scene/camera.js';
import { initLights } from '../scene/lighting.js';
import { ModelManager, MODELS } from '../models/modelLoader.js';
import { castRay } from '../interaction/raycaster.js';

// Setup Basic 3D Scene (No Hand Tracking for Quiz to keep it simple/mouse focused for now)
const canvasElem = document.getElementsByClassName('output_canvas')[0];
let sceneObj, rendererObj, cameraObj, orbitControls;
let modelMgr;

// Quiz State
let currentQuestion = null;
let score = 0;
let totalQuestions = 0;
let isQuizActive = false;

// UI Elements
const uiQuestion = document.getElementById('quiz-question');
const uiStatus = document.getElementById('quiz-status');
const btnStart = document.getElementById('btn-start-quiz');
const uiScore = document.getElementById('quiz-score');
const uiControls = document.getElementById('quiz-controls');

// --- INITIALIZATION ---
function init() {
    ({ scene: sceneObj, renderer: rendererObj } = initScene(canvasElem));
    ({ camera: cameraObj, controls: orbitControls } = initCamera(rendererObj));
    sceneObj.add(cameraObj);
    initLights(sceneObj);

    // Add a floor plane
    const planeGeo = new THREE.PlaneGeometry(20, 20);
    const planeMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 });
    const plane = new THREE.Mesh(planeGeo, planeMat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -1;
    sceneObj.add(plane);

    modelMgr = new ModelManager(sceneObj);

    // Load a default model for the quiz (e.g. Heart)
    const quizModel = MODELS.find(m => m.name.includes('Heart')) || MODELS[0];
    modelMgr.load(quizModel.file);

    renderLoop();
}

// --- GAMEPLAY LOGIC ---
const QUESTIONS = [
    { targetPart: 'ventricle', question: "Find a Ventricle (Left or Right)" },
    { targetPart: 'atrium', question: "Find an Atrium" },
    { targetPart: 'aorta', question: "Click on the Aorta" }
    // Note: This relies on mesh names containing these strings. 
    // Real implementation needs precise mesh mapping.
];

function startQuiz() {
    isQuizActive = true;
    score = 0;
    totalQuestions = 0;
    uiScore.innerText = `Score: 0`;
    uiScore.classList.remove('hidden');
    uiControls.classList.add('hidden'); // Hide start button

    nextQuestion();
}

function nextQuestion() {
    // Pick random target (mockup logic)
    // In a real app, we'd iterate through a list or verify mesh names first.
    // For prototype, let's ask user to click ANY part and tell them what they clicked.
    // Or simpler: "Click on the LARGEST part"

    currentQuestion = {
        text: "Select any part to identify it!",
        target: "any"
    };

    uiQuestion.innerText = `❓ Challenge Mode`;
    uiStatus.innerText = "Click on parts to gain points!";
}

// Global Click Listener
window.addEventListener('pointerdown', (event) => {
    if (!isQuizActive) return;
    if (event.target.closest('#quiz-overlay')) return;

    // Use shared raycaster
    const hitData = castRay(event, cameraObj, sceneObj);

    if (hitData) {
        const meshName = hitData.object.name;
        console.log("Quiz Click:", meshName);

        // Correct! (For this simple prototype, clicking anything is points)
        score += 10;
        uiScore.innerText = `Score: ${score}`;

        // Flash Green
        const oldMat = hitData.object.material;
        hitData.object.material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });

        uiQuestion.innerText = `✅ Found: ${meshName}`;
        uiStatus.innerText = "Great job! Keep going.";

        setTimeout(() => {
            hitData.object.material = oldMat;
        }, 500);

    } else {
        // Miss
        uiStatus.innerText = "Missed! Try clicking directly on the model.";
    }
});

btnStart.onclick = startQuiz;

// --- RENDER LOOP ---
function renderLoop() {
    requestAnimationFrame(renderLoop);
    orbitControls.update();
    rendererObj.render(sceneObj, cameraObj);
}

// Start
init();
