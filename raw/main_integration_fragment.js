// --- PASTE THIS AT THE TOP OF src/main.js ---
import { GeminiService } from './ai/geminiService.js';
import { castRay } from './interaction/raycaster.js';

// --- PASTE THIS INSIDE function init() ---

// 1. Initialize AI Service
const geminiSvc = new GeminiService();
let isAiMode = false;

// 2. UI Elements
const btnAi = document.getElementById('btn-ask-gemini');
const cardAi = document.getElementById('gemini-card');
const textAi = document.getElementById('gemini-response-text');
const loaderAi = document.getElementById('ai-spinner');
const btnClose = document.getElementById('btn-close-card');

// 3. Button Handlers
btnAi.onclick = () => {
    isAiMode = !isAiMode; // Toggle mode
    btnAi.style.background = isAiMode ? 'rgba(0, 242, 254, 0.4)' : ''; // Visual active state

    if (isAiMode) {
        cardAi.classList.remove('hidden');
        textAi.innerText = "Tap any part of the model to learn about it!";
    } else {
        cardAi.classList.add('hidden');
    }
};

btnClose.onclick = () => {
    isAiMode = false;
    cardAi.classList.add('hidden');
    btnAi.style.background = '';
};

// 4. The Interaction Loop
window.addEventListener('pointerdown', async (event) => {
    // Only interact if AI Mode is active AND we didn't click the UI itself
    if (!isAiMode) return;
    if (event.target.closest('#ui-container')) return;

    // Raycast Logic (Teammate 2)
    const hitMesh = castRay(event, cameraObj, sceneObj);

    if (hitMesh) {
        // UI: Show Loading (Teammate 3)
        textAi.innerText = `Analyzing ${hitMesh.name}...`;
        loaderAi.classList.remove('hidden');

        // Highlight (Optional Teammate 2 visual)
        // hitMesh.material.emissive.setHex(0x00ffff);

        // API Call (Teammate 1)
        const explanation = await geminiSvc.explainMesh(hitMesh.name, "3D Model");

        // UI: Show Result (Teammate 3)
        loaderAi.classList.add('hidden');
        textAi.innerText = explanation;
    }
});
