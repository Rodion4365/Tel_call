export interface TelegramWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

export interface TelegramWebApp {
  ready: () => void;
  expand?: () => void;
  initDataUnsafe?: {
    user?: TelegramWebAppUser;
    start_param?: string;
  };
  initData?: string;
}
