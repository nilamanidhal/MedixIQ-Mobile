import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import hi from './locales/hi.json';
import or from './locales/or.json';

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            en: { translation: en },
            hi: { translation: hi },
            or: { translation: or }
        },
        fallbackLng: 'en',        // Default English
        interpolation: {
            escapeValue: false    // React already escapes
        },
        detection: {
            // Pehle localStorage dekho, phir browser language
            order: ['localStorage', 'navigator'],
            caches: ['localStorage'],
            lookupLocalStorage: 'medixiq_language'
        }
    });

export default i18n;