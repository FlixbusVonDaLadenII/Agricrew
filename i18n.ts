import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import your translation files
import en from './locales/en.json';
import de from './locales/de.json';

i18next
    .use(initReactI18next)
    .init({
        compatibilityJSON: 'v4', // <-- This line is changed
        resources: {
            en: {
                translation: en,
            },
            de: {
                translation: de,
            },
        },
        lng: 'en', // Default language
        fallbackLng: 'en', // Fallback language if a translation is missing
        interpolation: {
            escapeValue: false, // React already protects from XSS
        },
    });

export default i18next;