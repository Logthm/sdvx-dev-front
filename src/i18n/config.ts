import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import zhCN from './locales/zh-CN.json';
import zhTW from './locales/zh-TW.json';
import ja from './locales/ja.json';
import en from './locales/en.json';

const ZH_MAP: Record<string, string> = {
  zh: 'zh-CN',
  'zh-Hans': 'zh-CN',
  'zh-Hant': 'zh-TW',
};

const resources = {
  'zh-CN': { translation: zhCN },
  'zh-TW': { translation: zhTW },
  ja: { translation: ja },
  en: { translation: en },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'zh-CN',
    supportedLngs: ['zh-CN', 'zh-TW', 'ja', 'en'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      convertDetectedLanguage: (lng: string) => ZH_MAP[lng] || lng,
    },
  });

export default i18n;

// Sync <html lang> with current language
function syncLang(lng: string) {
  document.documentElement.lang = lng;
}
syncLang(i18n.language);
i18n.on('languageChanged', syncLang);
