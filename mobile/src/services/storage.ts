import * as SecureStore from 'expo-secure-store';

const KEYS = {
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  SETTINGS: 'user_settings',
  CURRENT_SESSION: 'current_session_id',
} as const;

export const storage = {
  async getAuthToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.AUTH_TOKEN);
  },

  async setAuthToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(KEYS.AUTH_TOKEN, token);
  },

  async removeAuthToken(): Promise<void> {
    await SecureStore.deleteItemAsync(KEYS.AUTH_TOKEN);
  },

  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.REFRESH_TOKEN);
  },

  async setRefreshToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, token);
  },

  async removeRefreshToken(): Promise<void> {
    await SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN);
  },

  async getSettings(): Promise<Record<string, unknown> | null> {
    const raw = await SecureStore.getItemAsync(KEYS.SETTINGS);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  async setSettings(settings: Record<string, unknown>): Promise<void> {
    await SecureStore.setItemAsync(KEYS.SETTINGS, JSON.stringify(settings));
  },

  async getCurrentSessionId(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.CURRENT_SESSION);
  },

  async setCurrentSessionId(id: string): Promise<void> {
    await SecureStore.setItemAsync(KEYS.CURRENT_SESSION, id);
  },
};
