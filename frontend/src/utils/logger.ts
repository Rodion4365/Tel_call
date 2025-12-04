/**
 * Logging utility that respects environment settings.
 * In development, logs are enabled. In production, they can be controlled
 * via the VITE_ENABLE_LOGS environment variable.
 */

const isDevelopment = import.meta.env.DEV;
const isLoggingEnabled = isDevelopment || import.meta.env.VITE_ENABLE_LOGS === 'true';

export const logger = {
  log(...args: unknown[]): void {
    if (isLoggingEnabled) {
      console.log(...args);
    }
  },

  warn(...args: unknown[]): void {
    if (isLoggingEnabled) {
      console.warn(...args);
    }
  },

  error(...args: unknown[]): void {
    // Always log errors, even in production
    console.error(...args);
  },

  info(...args: unknown[]): void {
    if (isLoggingEnabled) {
      console.info(...args);
    }
  },

  debug(...args: unknown[]): void {
    if (isLoggingEnabled) {
      console.debug(...args);
    }
  },
};
