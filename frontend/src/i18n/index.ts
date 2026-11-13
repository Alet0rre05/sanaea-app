import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import esAR from './locales/es-AR.json';
import en from './locales/en.json';

void i18n.use(initReactI18next).init({
  resources: {
    'es-AR': { translation: esAR },
    en: { translation: en },
  },
  lng: 'es-AR',
  fallbackLng: 'es-AR',
  interpolation: { escapeValue: false },
});

export default i18n;
