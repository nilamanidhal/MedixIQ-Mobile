// src/components/LanguageSelector.jsx
import React from 'react';
import { useTranslation } from 'react-i18next';

const LANGUAGES = [
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'hi', label: 'हिंदी', flag: '🇮🇳' },
    { code: 'or', label: 'ଓଡ଼ିଆ', flag: '🇮🇳' },
];

const LanguageSelector = ({ onClose }) => {
    const { i18n, t } = useTranslation();

    const changeLanguage = (code) => {
        i18n.changeLanguage(code);
        localStorage.setItem('medixiq_language', code);
        onClose?.();
    };

    return (
        <div className="bg-white rounded-3xl shadow-2xl p-5 w-full max-w-sm mx-auto">
            <h3 className="text-lg font-bold text-slate-800 mb-4 text-center">
                {t('language.select')}
            </h3>
            <div className="space-y-3">
                {LANGUAGES.map(lang => (
                    <button
                        key={lang.code}
                        onClick={() => changeLanguage(lang.code)}
                        className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${
                            i18n.language === lang.code
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-slate-100 hover:border-slate-200'
                        }`}
                    >
                        <span className="text-2xl">{lang.flag}</span>
                        <span className={`font-bold text-base ${
                            i18n.language === lang.code
                                ? 'text-blue-700'
                                : 'text-slate-700'
                        }`}>
                            {lang.label}
                        </span>
                        {i18n.language === lang.code && (
                            <span className="ml-auto text-blue-500 font-bold">✓</span>
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default LanguageSelector;