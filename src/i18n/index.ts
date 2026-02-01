import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import locale YAML files
// Vite handles YAML imports via ?raw and we parse them
import enYaml from '../locales/en.yaml?raw';
import { parse } from 'yaml';

const resources = {
  en: { translation: parse(enYaml) },
};

// Detect user's preferred language
function detectLanguage(): string {
  // Check localStorage first
  const stored = localStorage.getItem('mirror-language');
  if (stored && stored in resources) {
    return stored;
  }

  // Fall back to browser/system language
  const browserLang = navigator.language.split('-')[0];
  if (browserLang && browserLang in resources) {
    return browserLang;
  }

  return 'en';
}

i18n.use(initReactI18next).init({
  resources,
  lng: detectLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false, // React already escapes
  },
});

export function setLanguage(lang: string) {
  localStorage.setItem('mirror-language', lang);
  i18n.changeLanguage(lang);
}

export function getAvailableLanguages() {
  return Object.keys(resources);
}

export default i18n;
