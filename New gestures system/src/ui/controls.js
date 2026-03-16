export function initControls(modelMgr, cameraControls) {
    const scaleUpBtn = document.getElementById('btn-scale-up');
    const scaleDownBtn = document.getElementById('btn-scale-down');
    const resetBtn = document.getElementById('btn-reset');
    const modelListElem = document.getElementById('model-list');

    if (scaleUpBtn) {
        scaleUpBtn.onclick = () => modelMgr.scale(1.1);
    }
    if (scaleDownBtn) {
        scaleDownBtn.onclick = () => modelMgr.scale(0.9);
    }
    if (resetBtn) {
        resetBtn.onclick = () => {
            modelMgr.reset();
            if (cameraControls) cameraControls.reset();
        };
    }

    if (modelListElem) {
        modelListElem.innerHTML = '';
        const availableModels = modelMgr.getAvailableModels();

        availableModels.forEach((modelData, idx) => {
            const modelBtn = document.createElement('button');
            modelBtn.className = 'model-btn';
            modelBtn.innerText = modelData.name;
            modelBtn.onclick = () => {
                document.querySelectorAll('.model-btn').forEach(b => b.classList.remove('active'));
                modelBtn.classList.add('active');
                modelMgr.load(modelData.file);
            };
            if (idx === 0) modelBtn.classList.add('active');
            modelListElem.appendChild(modelBtn);
        });
    }
}
