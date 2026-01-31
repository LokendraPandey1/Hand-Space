
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
            ${userSection}
        </div>
    </nav>
    `;

    document.body.insertAdjacentHTML('afterbegin', navHtml);

    // Attach Logout Handler
    if (user) {
        const logoutBtn = document.getElementById('nav-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                Auth.logout();
            });
        }
    }
}
