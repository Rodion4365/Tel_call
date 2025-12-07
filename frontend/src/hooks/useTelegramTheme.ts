import { useEffect, useCallback } from "react";
import type { TelegramWebApp, TelegramThemeParams } from "../types/telegram";

/**
 * Применяет параметры темы Telegram к CSS переменным приложения
 */
const applyThemeParams = (themeParams: TelegramThemeParams): void => {
  const root = document.documentElement;

  // Основные цвета
  if (themeParams.bg_color) {
    root.style.setProperty("--tg-bg", themeParams.bg_color);
    root.style.setProperty("--bg-color", themeParams.bg_color);
  }

  if (themeParams.text_color) {
    root.style.setProperty("--tg-text", themeParams.text_color);
    root.style.setProperty("--text-primary", themeParams.text_color);
  }

  if (themeParams.hint_color) {
    root.style.setProperty("--tg-hint", themeParams.hint_color);
    root.style.setProperty("--text-muted", themeParams.hint_color);
  }

  // Цвета кнопок
  if (themeParams.button_color) {
    root.style.setProperty("--tg-button", themeParams.button_color);
  }

  if (themeParams.button_text_color) {
    root.style.setProperty("--tg-button-text", themeParams.button_text_color);
  }

  // Вторичные цвета
  if (themeParams.secondary_bg_color) {
    root.style.setProperty("--tg-bg-secondary", themeParams.secondary_bg_color);
    root.style.setProperty("--panel", themeParams.secondary_bg_color);
  }

  if (themeParams.section_bg_color) {
    root.style.setProperty("--tg-section-bg", themeParams.section_bg_color);
  }

  if (themeParams.header_bg_color) {
    root.style.setProperty("--tg-header-bg", themeParams.header_bg_color);
  }

  // Акцентные цвета
  if (themeParams.link_color) {
    root.style.setProperty("--tg-link", themeParams.link_color);
  }

  if (themeParams.accent_text_color) {
    root.style.setProperty("--tg-accent", themeParams.accent_text_color);
  }

  if (themeParams.subtitle_text_color) {
    root.style.setProperty("--tg-subtitle", themeParams.subtitle_text_color);
  }

  if (themeParams.destructive_text_color) {
    root.style.setProperty("--tg-destructive", themeParams.destructive_text_color);
  }

  // Автоматически вычисляемые цвета
  // Цвет границ (более светлый/темный в зависимости от темы)
  if (themeParams.hint_color) {
    root.style.setProperty("--border", themeParams.hint_color + "40"); // 25% opacity
  }
};

/**
 * Хук для управления темой Telegram в приложении.
 * Автоматически применяет тему при монтировании и реагирует на изменения темы.
 */
export const useTelegramTheme = (webApp: TelegramWebApp | null): void => {
  const handleThemeChanged = useCallback(() => {
    if (!webApp?.themeParams) {
      return;
    }

    // eslint-disable-next-line no-console
    console.log("[useTelegramTheme] Theme changed, applying new theme params", webApp.themeParams);
    applyThemeParams(webApp.themeParams);
  }, [webApp]);

  // Применить тему при монтировании и при изменении webApp
  useEffect(() => {
    if (!webApp?.themeParams) {
      return;
    }

    // eslint-disable-next-line no-console
    console.log("[useTelegramTheme] Initializing theme", {
      colorScheme: webApp.colorScheme,
      themeParams: webApp.themeParams,
    });

    applyThemeParams(webApp.themeParams);
  }, [webApp]);

  // Подписаться на событие изменения темы
  useEffect(() => {
    if (!webApp?.onEvent || !webApp?.offEvent) {
      return;
    }

    // eslint-disable-next-line no-console
    console.log("[useTelegramTheme] Subscribing to themeChanged event");

    webApp.onEvent("themeChanged", handleThemeChanged);

    return () => {
      // eslint-disable-next-line no-console
      console.log("[useTelegramTheme] Unsubscribing from themeChanged event");
      webApp.offEvent?.("themeChanged", handleThemeChanged);
    };
  }, [handleThemeChanged, webApp]);
};
