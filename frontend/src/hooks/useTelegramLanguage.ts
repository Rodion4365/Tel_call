import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { TelegramWebApp } from "../types/telegram";

/**
 * Хук для автоматической установки языка из Telegram WebApp
 * Приоритет: localStorage -> Telegram language_code -> fallback ('ru')
 */
export const useTelegramLanguage = (webApp: TelegramWebApp | null): void => {
  const { i18n } = useTranslation();

  useEffect(() => {
    // Если язык уже сохранен в localStorage, i18next автоматически его использует
    // через LanguageDetector, поэтому ничего делать не нужно
    const savedLanguage = localStorage.getItem("i18nextLng");

    if (savedLanguage) {
      // eslint-disable-next-line no-console
      console.log("[useTelegramLanguage] Using saved language from localStorage:", savedLanguage);
      return;
    }

    // Если язык не сохранен, пытаемся получить его из Telegram
    if (!webApp?.initDataUnsafe?.user) {
      // eslint-disable-next-line no-console
      console.log("[useTelegramLanguage] No Telegram user data available, using fallback");
      return;
    }

    // Telegram может передавать язык в формате "ru" или "en"
    // Также могут быть варианты типа "ru-RU", "en-US"
    const telegramLanguage = (webApp.initDataUnsafe.user as any).language_code;

    if (!telegramLanguage) {
      // eslint-disable-next-line no-console
      console.log("[useTelegramLanguage] No language_code in Telegram user data");
      return;
    }

    // Нормализуем язык к короткому коду (ru, en)
    const normalizedLanguage = telegramLanguage.toLowerCase().split("-")[0];

    // Проверяем, поддерживается ли язык
    const supportedLanguages = ["ru", "en"];
    const languageToSet = supportedLanguages.includes(normalizedLanguage)
      ? normalizedLanguage
      : "ru"; // fallback

    // eslint-disable-next-line no-console
    console.log("[useTelegramLanguage] Setting language from Telegram:", {
      telegramLanguage,
      normalizedLanguage,
      languageToSet,
    });

    // Устанавливаем язык (это также сохранит его в localStorage)
    i18n.changeLanguage(languageToSet);
  }, [webApp, i18n]);
};
