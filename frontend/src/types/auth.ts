export interface AuthUser {
  id: number;
  telegram_user_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
}

export interface AuthResponse {
  expires_in: number;
  user: AuthUser;
  access_token: string;
  token_type: string;
}
