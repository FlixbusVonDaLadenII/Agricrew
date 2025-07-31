import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import your translation files
import en from './locales/en.json';
import de from './locales/de.json';

const LANGUAGE_KEY = 'user-language';

const languageDetector = {
    type: 'languageDetector' as const, // Add 'as const' to satisfy the type
    async: true,
    detect: async (callback: (lng: string) => void) => {
        try {
            const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
            const fallbackLng = 'en';
            callback(savedLanguage || fallbackLng);
        } catch (error) {
            console.error('Error loading language from AsyncStorage:', error);
            callback('en'); // Fallback to English on error
        }
    },
    init: () => {},
    cacheUserLanguage: async (lng: string) => {
        try {
            await AsyncStorage.setItem(LANGUAGE_KEY, lng);
        } catch (error) {
            console.error('Error saving language to AsyncStorage:', error);
        }
    },
};

i18next
    .use(languageDetector)
    .use(initReactI18next)
    .init({
        compatibilityJSON: 'v4',
        resources: {
            en: {
                translation: en,
            },
            de: {
                translation: de,
            },
        },
        // lng: 'en', // languageDetector will handle this
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false, // React already protects from XSS
        },
        react: {
            useSuspense: false, // Recommended for React Native
        }
    });

export default i18next;