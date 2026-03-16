import { getCurrentGrade, getChaptersForGrade } from '../curriculum/grades.js';

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
        buildModelList(modelListElem, modelMgr);

        // Re-build when grade changes
        window.addEventListener('grade_changed', () => {
            buildModelList(modelListElem, modelMgr);
        });
    }
}

function buildModelList(modelListElem, modelMgr) {
    modelListElem.innerHTML = '';
    const grade = getCurrentGrade();

    if (grade) {
        // Grade selected — show curriculum models grouped by chapter
        const chapters = getChaptersForGrade(grade);
        if (chapters.length === 0) {
            modelListElem.innerHTML = '<div style="padding:12px;color:var(--text-muted);font-size:0.85rem;">No curriculum data for this class yet.</div>';
            return;
        }

        // Add grade header
        const gradeHeader = document.createElement('div');
        gradeHeader.style.cssText = 'padding:10px 12px;font-size:0.8rem;font-weight:600;color:var(--primary-light);text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid var(--border);margin-bottom:4px;';
        const subjectsInGrade = [...new Set(chapters.filter(ch => ch.models.length > 0).map(ch => ch.subject))];
        gradeHeader.textContent = `Class ${grade} — ${subjectsInGrade.join(', ') || 'NCERT Science'}`;
        modelListElem.appendChild(gradeHeader);

        for (const chapter of chapters) {
            // Skip chapters with no models
            if (chapter.models.length === 0) continue;

            const catBlock = document.createElement('div');
            catBlock.className = 'category-block';

            const catHeader = document.createElement('div');
            catHeader.className = 'category-header accordion-header';
            catHeader.innerHTML = `<span>${chapter.icon} ${chapter.name}</span> <span class="arrow">▶</span>`;
            catHeader.style.borderLeft = `3px solid ${chapter.color}`;

            const catContent = document.createElement('div');
            catContent.className = 'category-content hidden';

            catHeader.onclick = () => {
                const isOpen = !catContent.classList.contains('hidden');
                document.querySelectorAll('.category-content').forEach(el => el.classList.add('hidden'));
                document.querySelectorAll('.arrow').forEach(el => el.style.transform = 'rotate(0deg)');
                if (!isOpen) {
                    catContent.classList.remove('hidden');
                    catHeader.querySelector('.arrow').style.transform = 'rotate(90deg)';
                }
            };

            chapter.models.forEach((modelData) => {
                const modelBtn = document.createElement('button');
                modelBtn.className = 'model-btn';
                if (!modelData.available) {
                    modelBtn.innerHTML = `<span style="opacity:0.5;">\u{1F512} ${modelData.name}</span>`;
                    modelBtn.style.opacity = '0.6';
                    modelBtn.style.cursor = 'not-allowed';
                    modelBtn.title = 'Coming soon — model not yet available';
                } else {
                    modelBtn.innerText = `${modelData.icon || ''} ${modelData.name}`;
                    modelBtn.onclick = () => {
                        document.querySelectorAll('.model-btn').forEach(b => b.classList.remove('active'));
                        modelBtn.classList.add('active');
                        modelMgr.load(modelData.file);
                    };
                }
                catContent.appendChild(modelBtn);
            });

            catBlock.appendChild(catHeader);
            catBlock.appendChild(catContent);
            modelListElem.appendChild(catBlock);
        }
    } else {
        // No grade selected — show all models grouped by category (original behavior)
        const availableModels = modelMgr.getAvailableModels();
        const categories = {};
        availableModels.forEach(m => {
            if (!categories[m.category]) categories[m.category] = [];
            categories[m.category].push(m);
        });

        for (const [catName, models] of Object.entries(categories)) {
            const catBlock = document.createElement('div');
            catBlock.className = 'category-block';

            const catHeader = document.createElement('div');
            catHeader.className = 'category-header accordion-header';
            catHeader.innerHTML = `<span>${catName}</span> <span class="arrow">▶</span>`;

            const catContent = document.createElement('div');
            catContent.className = 'category-content hidden';

            catHeader.onclick = () => {
                const isOpen = !catContent.classList.contains('hidden');
                document.querySelectorAll('.category-content').forEach(el => el.classList.add('hidden'));
                document.querySelectorAll('.arrow').forEach(el => el.style.transform = 'rotate(0deg)');
                if (!isOpen) {
                    catContent.classList.remove('hidden');
                    catHeader.querySelector('.arrow').style.transform = 'rotate(90deg)';
                }
            };

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

            catBlock.appendChild(catHeader);
            catBlock.appendChild(catContent);
            modelListElem.appendChild(catBlock);
        }
    }
}
