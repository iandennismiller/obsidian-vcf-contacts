/**
 * @fileoverview Logger service for the VCF Contacts plugin
 * 
 * Provides centralized logging with configurable log levels.
 * 
 * @module Logger
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';

const LOG_LEVELS: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARNING: 2,
  ERROR: 3
};

class Logger {
  private currentLevel: LogLevel = 'INFO';

  /**
   * Set the current log level
   */
  setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  /**
   * Get the current log level
   */
  getLevel(): LogLevel {
    return this.currentLevel;
  }

  /**
   * Check if a message at the given level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.currentLevel];
  }

  /**
   * Log a debug message
   */
  debug(...args: any[]): void {
    if (this.shouldLog('DEBUG')) {
      console.log('[DEBUG]', ...args);
    }
  }

  /**
   * Log an info message
   */
  info(...args: any[]): void {
    if (this.shouldLog('INFO')) {
      console.log('[INFO]', ...args);
    }
  }

  /**
   * Log a warning message
   */
  warning(...args: any[]): void {
    if (this.shouldLog('WARNING')) {
      console.warn('[WARNING]', ...args);
    }
  }

  /**
   * Log an error message
   */
  error(...args: any[]): void {
    if (this.shouldLog('ERROR')) {
      console.error('[ERROR]', ...args);
    }
  }
}

// Export singleton instance
export const logger = new Logger();
