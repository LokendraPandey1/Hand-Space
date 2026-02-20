
// Real Authentication communicating with Node.js Backend

const KEY_USER = 'handspace_current_user';
const KEY_TOKEN = 'handspace_auth_token';
const API_URL = 'http://localhost:5000/api/auth'; // Absolute URL for Live Server support

export const Auth = {
    // Register a new user
    signup: async (name, email, password, role = 'student') => {
        try {
            const res = await fetch(`${API_URL}/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password, role })
            });

            // Handle non-JSON response
            const contentType = res.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                return { success: false, message: 'Backend not reachable. Run: node server/server.js' };
            }

            const data = await res.json();

            if (!res.ok) {
                return { success: false, message: data.msg || 'Signup failed' };
            }

            // Save session
            localStorage.setItem(KEY_TOKEN, data.token);
            localStorage.setItem(KEY_USER, JSON.stringify(data.user));

            return { success: true };
        } catch (err) {
            console.error(err);
            return { success: false, message: 'Server connection error: ' + err.message };
        }
    },

    // Login existing user
    login: async (email, password) => {
        try {
            const res = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            // Handle non-JSON response
            const contentType = res.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                return { success: false, message: 'Backend not reachable. Is the server running on port 5000?' };
            }

            const data = await res.json();

            if (!res.ok) {
                return { success: false, message: data.msg || 'Login failed' };
            }

            // Save session
            localStorage.setItem(KEY_TOKEN, data.token);
            localStorage.setItem(KEY_USER, JSON.stringify(data.user));

            return { success: true };
        } catch (err) {
            console.error(err);
            return { success: false, message: 'Server connection error: ' + err.message };
        }
    },

    // Logout
    logout: () => {
        localStorage.removeItem(KEY_USER);
        localStorage.removeItem(KEY_TOKEN);
        window.location.href = 'login.html';
    },

    // Get current logged in user
    getUser: () => {
        return JSON.parse(localStorage.getItem(KEY_USER));
    },

    // Get Auth Token
    getToken: () => {
        return localStorage.getItem(KEY_TOKEN);
    },

    // Require Auth (Redirect if not logged in)
    requireAuth: () => {
        const user = JSON.parse(localStorage.getItem(KEY_USER));
        if (!user) {
            window.location.href = 'login.html';
        }
    },

    // Get user role
    getRole: () => {
        const user = JSON.parse(localStorage.getItem(KEY_USER));
        return user?.role || 'student';
    },

    // Check if user is a teacher
    isTeacher: () => {
        const user = JSON.parse(localStorage.getItem(KEY_USER));
        return user?.role === 'teacher';
    },

    // Check if user is a university/school account
    isUniversity: () => {
        const user = JSON.parse(localStorage.getItem(KEY_USER));
        return user?.role === 'university';
    },

    // Check if logged in
    isLoggedIn: () => {
        return !!localStorage.getItem(KEY_TOKEN);
    },

    // Get auth token for API requests
    getToken: () => {
        return localStorage.getItem(KEY_TOKEN);
    }
};
