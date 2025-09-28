// Stub implementation for compatibility - all logging removed
export const loggingService = {
  setLogLevel: () => {},
  getLogLevel: () => 'INFO' as const,
  log: () => {},
  debug: () => {},
  info: () => {},
  warning: () => {},
  warn: () => {},
  error: () => {},
  initialize: () => {},
  cleanup: () => {},
};

export type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';