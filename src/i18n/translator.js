/**
 * i18n Translator Module
 * Handles loading and applying translations across the UI
 */

const STORAGE_KEY = 'handspace_lang';

class Translator {
    constructor() {
        this.locale = localStorage.getItem(STORAGE_KEY) || 'English';
        this.translations = {};
        this.loaded = false;
    }

    /**
     * Map language name to locale code
     */
    getLocaleCode(language) {
        const map = {
            'English': 'en',
            'Hindi': 'hi',
            'Telugu': 'te',
            'Tamil': 'ta',
            'Bengali': 'bn',
            'Marathi': 'mr',
            'Gujarati': 'gu'
        };
        return map[language] || 'en';
    }

    /**
     * Load translations for the current locale
     */
    async load(language = null) {
        if (language) {
            this.locale = language;
            localStorage.setItem(STORAGE_KEY, language);
        }

        const code = this.getLocaleCode(this.locale);

        try {
            const response = await fetch(`/locales/${code}.json`);
            if (!response.ok) {
                console.warn(`Failed to load locale: ${code}`);
                return false;
            }
            this.translations = await response.json();
            this.loaded = true;
            return true;
        } catch (err) {
            console.error('Translation load error:', err);
            return false;
        }
    }

    /**
     * Get a translation by key path (e.g., 'gestureGuide.title')
     */
    t(keyPath, fallback = '') {
        const keys = keyPath.split('.');
        let value = this.translations;

        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return fallback || keyPath;
            }
        }

        return value || fallback || keyPath;
    }

    /**
     * Apply translations to all elements with data-i18n attribute
     */
    apply() {
        const elements = document.querySelectorAll('[data-i18n]');

        elements.forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = this.t(key);

            // Check if it's an input placeholder
            if (el.hasAttribute('data-i18n-placeholder')) {
                el.placeholder = translation;
            } else if (el.hasAttribute('data-i18n-title')) {
                el.title = translation;
            } else {
                el.textContent = translation;
            }
        });
    }

    /**
     * Get current language
     */
    getLanguage() {
        return this.locale;
    }
}

// Export singleton instance
export const translator = new Translator();
