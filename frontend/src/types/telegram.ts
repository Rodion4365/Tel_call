export interface TelegramWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

export interface TelegramThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
  header_bg_color?: string;
  accent_text_color?: string;
  section_bg_color?: string;
  section_header_text_color?: string;
  subtitle_text_color?: string;
  destructive_text_color?: string;
}

export type TelegramColorScheme = "light" | "dark";

export interface TelegramWebApp {
  version?: string;
  isVersionAtLeast?: (version: string) => boolean;
  ready: () => void;
  expand?: () => void;
  BackButton?: {
    onClick?: (callback: () => void) => void;
    offClick?: (callback: () => void) => void;
    show?: () => void;
    hide?: () => void;
  };
  initDataUnsafe?: {
    user?: TelegramWebAppUser;
    start_param?: string;
  };
  initData?: string;
  openTelegramLink?: (url: string) => void;
  colorScheme?: TelegramColorScheme;
  themeParams?: TelegramThemeParams;
  onEvent?: (eventType: string, callback: () => void) => void;
  offEvent?: (eventType: string, callback: () => void) => void;
}
