
import { Auth } from '../auth/auth.js';

export function initNavbar(activePage) {
    const user = Auth.getUser();

    let userSection = '';
    if (user) {
        userSection = `
            <a href="profile.html" class="nav-link ${activePage === 'profile' ? 'active' : ''}" style="display:flex; align-items:center; gap:8px;">
                👤 ${user.name.split(' ')[0]}
            </a>
            <a href="#" id="nav-logout" class="nav-link" style="color:#ff6b6b;">Logout</a>
        `;
    } else {
        userSection = `
            <a href="login.html" class="nav-link">Log In</a>
        `;
    }

    // Class Selector for Teachers
    let classSelectorHtml = '';
    if (user && Auth.isTeacher()) {
        const classes = [];
        const grades = ['5', '6', '7', '8', '9'];
        const sections = ['A', 'B', 'C'];

        grades.forEach(g => sections.forEach(s => classes.push(`${g}${s}`)));

        const currentClass = localStorage.getItem('handspace_class') || '5A';

        const options = classes.map(c =>
            `<option value="${c}" ${c === currentClass ? 'selected' : ''}>Class ${c}</option>`
        ).join('');

        classSelectorHtml = `
            <select id="nav-class-select" class="nav-class-select">
                ${options}
            </select>
            <div style="width: 1px; height: 20px; background: rgba(255,255,255,0.2); margin: 0 10px;"></div>
        `;
    }

    // Apply Global Preferences
    function applyPreferences() {
        const prefs = JSON.parse(localStorage.getItem('handspace_prefs') || '{}');
        const body = document.body;

        // Accessibility Classes
        if (prefs.highContrast) body.classList.add('high-contrast');
        else body.classList.remove('high-contrast');

        if (prefs.largeText) body.classList.add('large-text');
        else body.classList.remove('large-text');

        if (prefs.reduceMotion) body.classList.add('reduce-motion');
        else body.classList.remove('reduce-motion');

        // Gesture Guide Visibility (for index.html)
        const guide = document.getElementById('gesture-guide');
        if (guide) {
            if (prefs.gestureGuide === false) {
                guide.classList.add('hidden');
                guide.style.display = 'none'; // Force hide
            } else {
                guide.classList.remove('hidden');
                guide.style.display = ''; // Restore default
            }
        }
    }

    applyPreferences(); // Run immediately

    // Listen for preference changes from other tabs/pages
    window.addEventListener('storage', (e) => {
        if (e.key === 'handspace_prefs') {
            applyPreferences();
        }
    });

    // Custom event listener for same-page updates (from settings page)
    window.addEventListener('prefs_updated', () => {
        applyPreferences();
    });

    const navHtml = `
    <nav class="main-navbar">
        <a href="${user ? 'dashboard.html' : 'index.html'}" class="nav-brand">
            <span>✋ HandSpace</span>
        </a>
        <div class="nav-links">
            <a href="dashboard.html" class="nav-link ${activePage === 'dashboard' ? 'active' : ''}">🏠 Dashboard</a>
            <a href="library.html" class="nav-link ${activePage === 'library' ? 'active' : ''}">📚 Library</a>
            <a href="index.html" class="nav-link ${activePage === 'viewer' ? 'active' : ''}">🧊 3D Viewer</a>
            <a href="quiz.html" class="nav-link ${activePage === 'quiz' ? 'active' : ''}">✅ Quiz</a>
            <div style="width: 1px; height: 20px; background: rgba(255,255,255,0.2); margin: 0 10px;"></div>
            ${classSelectorHtml}
            ${userSection}
        </div>
    </nav>
    `;

    document.body.insertAdjacentHTML('afterbegin', navHtml);

    // Attach Handlers
    if (user) {
        // Logout
        const logoutBtn = document.getElementById('nav-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                Auth.logout();
            });
        }

        // Class Selector
        const classSelect = document.getElementById('nav-class-select');
        if (classSelect) {
            classSelect.addEventListener('change', (e) => {
                const newClass = e.target.value;
                localStorage.setItem('handspace_class', newClass);
                // Dispatch event for other components to listen
                window.dispatchEvent(new Event('class_changed'));
            });
        }
    }
}
