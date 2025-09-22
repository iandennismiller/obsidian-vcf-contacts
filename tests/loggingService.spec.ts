import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loggingService } from 'src/services/loggingService';

describe('LoggingService', () => {
  beforeEach(() => {
    loggingService.clearLogs();
  });

  afterEach(() => {
    loggingService.clearLogs();
  });

  it('should log messages with correct level and timestamp', () => {
    loggingService.info('Test info message');
    loggingService.warn('Test warning message');
    loggingService.error('Test error message');

    const logs = loggingService.getLogs();
    expect(logs).toHaveLength(3);
    
    expect(logs[0].level).toBe('INFO');
    expect(logs[0].message).toBe('Test info message');
    expect(logs[0].timestamp).toBeInstanceOf(Date);
    
    expect(logs[1].level).toBe('WARN');
    expect(logs[1].message).toBe('Test warning message');
    
    expect(logs[2].level).toBe('ERROR');
    expect(logs[2].message).toBe('Test error message');
  });

  it('should format logs as string correctly', () => {
    loggingService.info('First message');
    loggingService.error('Second message');

    const logString = loggingService.getLogsAsString();
    expect(logString).toContain('INFO: First message');
    expect(logString).toContain('ERROR: Second message');
    expect(logString.split('\n')).toHaveLength(2);
  });

  it('should clear logs when requested', () => {
    loggingService.info('Test message');
    expect(loggingService.getLogs()).toHaveLength(1);
    
    loggingService.clearLogs();
    expect(loggingService.getLogs()).toHaveLength(0);
  });

  it('should enforce maximum size by removing old entries', () => {
    // Fill up the buffer beyond 64KB
    const longMessage = 'x'.repeat(1000); // 1KB message
    
    // Add enough entries to exceed 64KB
    for (let i = 0; i < 70; i++) {
      loggingService.info(`${longMessage} - entry ${i}`);
    }

    const logs = loggingService.getLogs();
    
    // Should have fewer than 70 entries due to cleanup
    expect(logs.length).toBeLessThan(70);
    
    // First entries should be removed, so the first remaining entry
    // should not be "entry 0"
    expect(logs[0].message).not.toContain('entry 0');
  });

  it('should return empty string for empty logs', () => {
    expect(loggingService.getLogsAsString()).toBe('');
  });
});