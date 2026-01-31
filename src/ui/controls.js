export function initControls(modelMgr, cameraControls) {
    const scaleUpBtn = document.getElementById('btn-scale-up');
    const scaleDownBtn = document.getElementById('btn-scale-down');
    const resetBtn = document.getElementById('btn-reset');
    const modelListElem = document.getElementById('model-list');
    const zoomLabel = document.getElementById('zoom-label');

    // Track zoom percentage
    let zoomPercent = 100;

    function updateZoomLabel() {
        if (zoomLabel) {
            zoomLabel.textContent = `Zoom: ${Math.round(zoomPercent)}%`;
        }
    }

    if (scaleUpBtn) {
        scaleUpBtn.onclick = () => {
            modelMgr.scale(1.1);
            zoomPercent *= 1.1;
            updateZoomLabel();
        };
    }
    if (scaleDownBtn) {
        scaleDownBtn.onclick = () => {
            modelMgr.scale(0.9);
            zoomPercent *= 0.9;
            updateZoomLabel();
        };
    }
    if (resetBtn) {
        resetBtn.onclick = () => {
            modelMgr.reset();
            if (cameraControls) cameraControls.reset();
            zoomPercent = 100;
            updateZoomLabel();
        };
    }

    if (modelListElem) {
        modelListElem.innerHTML = '';
        const availableModels = modelMgr.getAvailableModels();

        // Group by Category
        const categories = {};
        availableModels.forEach(m => {
            if (!categories[m.category]) categories[m.category] = [];
            categories[m.category].push(m);
        });

        // Render Groups (Accordion Style)
        for (const [catName, models] of Object.entries(categories)) {
            // Container for this category
            const catBlock = document.createElement('div');
            catBlock.className = 'category-block';

            // Header (Clickable)
            const catHeader = document.createElement('div');
            catHeader.className = 'category-header accordion-header';
            catHeader.innerHTML = `<span>${catName}</span> <span class="arrow">▶</span>`;

            // Content (Hidden list of models)
            const catContent = document.createElement('div');
            catContent.className = 'category-content hidden'; // Start hidden

            // Toggle Logic
            catHeader.onclick = () => {
                const isOpen = !catContent.classList.contains('hidden');

                // Auto-close others
                document.querySelectorAll('.category-content').forEach(el => el.classList.add('hidden'));
                document.querySelectorAll('.arrow').forEach(el => el.style.transform = 'rotate(0deg)');

                if (!isOpen) {
                    catContent.classList.remove('hidden');
                    catHeader.querySelector('.arrow').style.transform = 'rotate(90deg)';
                }
            };

            // Models
            models.forEach((modelData) => {
                const modelBtn = document.createElement('button');
                modelBtn.className = 'model-btn';
                modelBtn.innerText = modelData.name;
                modelBtn.onclick = () => {
                    document.querySelectorAll('.model-btn').forEach(b => b.classList.remove('active'));
                    modelBtn.classList.add('active');
                    modelMgr.load(modelData.file);
                };
                if (modelData.name === 'Default Model') modelBtn.classList.add('active');

                catContent.appendChild(modelBtn);
            });

            // Append parts
            catBlock.appendChild(catHeader);
            catBlock.appendChild(catContent);
            modelListElem.appendChild(catBlock);
        }
    }
}
