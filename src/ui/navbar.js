
import { Auth } from '../auth/auth.js';

export function initNavbar(activePage) {
    const user = Auth.getUser();

    let userSection = '';
    if (user) {
        const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        userSection = `
            <div class="nav-divider"></div>
            <div class="nav-user">
                <span class="streak-badge" title="Daily Streak">
                    \u{1F525} <span id="nav-streak">3</span>
                </span>
                <a href="profile.html" class="nav-avatar" title="${user.name}">${initials}</a>
                <button id="nav-logout" class="btn-logout">Logout</button>
            </div>
        `;
    } else {
        userSection = `
            <div class="nav-divider"></div>
            <a href="login.html" class="btn-primary btn-sm">Log In</a>
        `;
    }

    // Grade selector
    let gradeSelectorHtml = '';
    if (!Auth.isUniversity()) {
        if (user && Auth.isTeacher()) {
            const classes = [];
            const grades = ['5', '6', '7', '8', '9'];
            const sections = ['A', 'B', 'C'];
            grades.forEach(g => sections.forEach(s => classes.push(`${g}${s}`)));

            const currentClass = localStorage.getItem('handspace_class') || '5A';
            const options = classes.map(c =>
                `<option value="${c}" ${c === currentClass ? 'selected' : ''}>Class ${c}</option>`
            ).join('');

            gradeSelectorHtml = `
                <select id="nav-class-select" class="nav-grade-select">
                    ${options}
                </select>
            `;
        } else {
            const grades = ['5', '6', '7', '8', '9'];
            const currentGrade = localStorage.getItem('handspace_grade') || '';

            const options = [
                `<option value="" ${!currentGrade ? 'selected' : ''}>Select Class</option>`,
                ...grades.map(g =>
                    `<option value="${g}" ${g === currentGrade ? 'selected' : ''}>Class ${g}</option>`
                ),
                `<option value="other" ${currentGrade === 'other' ? 'selected' : ''}>Other</option>`
            ].join('');

            gradeSelectorHtml = `
                <select id="nav-grade-select" class="nav-grade-select">
                    ${options}
                </select>
            `;
        }
    }

    // Apply Global Preferences
    function applyPreferences() {
        const prefs = JSON.parse(localStorage.getItem('handspace_prefs') || '{}');
        const body = document.body;

        if (prefs.theme === 'light') {
            body.classList.add('light-mode');
        } else {
            body.classList.remove('light-mode');
        }

        const themeBtn = document.getElementById('btn-theme-toggle');
        if (themeBtn) {
            themeBtn.textContent = prefs.theme === 'light' ? '\u2600\uFE0F' : '\u{1F319}';
            themeBtn.title = prefs.theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode';
        }

        if (prefs.highContrast) body.classList.add('high-contrast');
        else body.classList.remove('high-contrast');

        if (prefs.largeText) body.classList.add('large-text');
        else body.classList.remove('large-text');

        if (prefs.reduceMotion) body.classList.add('reduce-motion');
        else body.classList.remove('reduce-motion');

        const guide = document.getElementById('gesture-guide');
        if (guide) {
            if (prefs.gestureGuide === false) {
                guide.classList.add('hidden');
                guide.style.display = 'none';
            } else {
                guide.classList.remove('hidden');
                guide.style.display = '';
            }
        }
    }

    applyPreferences();

    window.addEventListener('storage', (e) => {
        if (e.key === 'handspace_prefs') {
            applyPreferences();
        }
    });

    window.addEventListener('prefs_updated', () => {
        applyPreferences();
    });

    const currentPrefs = JSON.parse(localStorage.getItem('handspace_prefs') || '{}');
    const isLight = currentPrefs.theme === 'light';
    const themeIcon = isLight ? '\u2600\uFE0F' : '\u{1F319}';
    const themeTitle = isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode';

    const navHtml = `
    <nav class="navbar">
        <a href="home.html" class="nav-brand">
            <span class="nav-brand-icon">\u270B</span>
            <span>HandSpace</span>
        </a>
        <div class="nav-links">
            <a href="home.html" class="nav-link ${activePage === 'home' ? 'active' : ''}">Home</a>
            <a href="dashboard.html" class="nav-link ${activePage === 'dashboard' ? 'active' : ''}">Dashboard</a>
            <a href="library.html" class="nav-link ${activePage === 'library' ? 'active' : ''}">Library</a>
            <a href="index.html" class="nav-link ${activePage === 'viewer' ? 'active' : ''}">3D Viewer</a>
            <a href="quiz.html" class="nav-link ${activePage === 'quiz' ? 'active' : ''}">Quiz</a>
        </div>
        <div class="nav-right">
            <button id="btn-theme-toggle" class="btn-theme-toggle" title="${themeTitle}">${themeIcon}</button>
            ${gradeSelectorHtml}
            ${userSection}
        </div>
    </nav>
    `;

    document.body.insertAdjacentHTML('afterbegin', navHtml);

    // Theme Toggle Handler
    const themeToggleBtn = document.getElementById('btn-theme-toggle');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const prefs = JSON.parse(localStorage.getItem('handspace_prefs') || '{}');
            prefs.theme = prefs.theme === 'light' ? 'dark' : 'light';
            localStorage.setItem('handspace_prefs', JSON.stringify(prefs));
            applyPreferences();
            window.dispatchEvent(new Event('prefs_updated'));
        });
    }

    // Attach Handlers
    if (user) {
        const logoutBtn = document.getElementById('nav-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                Auth.logout();
            });
        }

        const classSelect = document.getElementById('nav-class-select');
        if (classSelect) {
            classSelect.addEventListener('change', (e) => {
                const newClass = e.target.value;
                localStorage.setItem('handspace_class', newClass);
                window.dispatchEvent(new Event('class_changed'));
                window.location.reload();
            });
        }
    }

    const gradeSelect = document.getElementById('nav-grade-select');
    if (gradeSelect) {
        gradeSelect.addEventListener('change', (e) => {
            const newGrade = e.target.value;
            localStorage.setItem('handspace_grade', newGrade);
            window.dispatchEvent(new Event('grade_changed'));
            window.location.reload();
        });
    }
}
