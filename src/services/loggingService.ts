// Lightweight loggingService: log level filtering, wraps console.log only
import { onSettingsChange } from "src/context/sharedSettingsContext";
import { ContactsPluginSettings } from "src/settings/settings.d";
export type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';

let currentLogLevel: LogLevel = 'INFO';
let unsubscribeSettingsChange: (() => void) | null = null;

const logLevelPriority: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARNING: 2,
  ERROR: 3,
};

function setLogLevel(level: LogLevel) {
  currentLogLevel = level;
}

function getLogLevel(): LogLevel {
  return currentLogLevel;
}

function log(level: LogLevel, ...args: any[]) {
  if (logLevelPriority[level] >= logLevelPriority[currentLogLevel]) {
    // eslint-disable-next-line no-console
    console.log(`[${level}]`, ...args);
  }
}

function initialize(logLevel: LogLevel, loadedMsg?: string) {
  setLogLevel(logLevel);
  if (loadedMsg) {
    log('INFO', loadedMsg);
  }
  // Subscribe to settings changes to update log level
  if (unsubscribeSettingsChange) {
    unsubscribeSettingsChange();
  }
  unsubscribeSettingsChange = onSettingsChange((settings: ContactsPluginSettings) => {
    if (settings.logLevel) setLogLevel(settings.logLevel);
  });
}

function cleanup() {
  if (unsubscribeSettingsChange) {
    unsubscribeSettingsChange();
    unsubscribeSettingsChange = null;
  }
}

export const loggingService = {
  setLogLevel,
  getLogLevel,
  log,
  debug: (...args: any[]) => log('DEBUG', ...args),
  info: (...args: any[]) => log('INFO', ...args),
  warning: (...args: any[]) => log('WARNING', ...args),
  warn: (...args: any[]) => log('WARNING', ...args),
  error: (...args: any[]) => log('ERROR', ...args),
  initialize,
  cleanup,
};