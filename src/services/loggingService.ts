export interface LogEntry {
  timestamp: Date;
  level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
  message: string;
}

export class LoggingService {
  private logs: LogEntry[] = [];
  private readonly maxSizeBytes = 64 * 1024; // 64KB
  private readonly cleanupSizeBytes = 4 * 1024; // 4KB to discard when limit exceeded
  private currentLogLevel: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' = 'INFO';

  setLogLevel(level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR'): void {
    this.currentLogLevel = level;
  }

  private shouldLog(level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR'): boolean {
    const levels = ['DEBUG', 'INFO', 'WARNING', 'ERROR'];
    const currentLevelIndex = levels.indexOf(this.currentLogLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  log(level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR', message: string): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message
    };
    
    this.logs.push(entry);
    this.enforceMaxSize();
  }

  debug(message: string): void {
    this.log('DEBUG', message);
  }

  info(message: string): void {
    this.log('INFO', message);
  }

  warning(message: string): void {
    this.log('WARNING', message);
  }

  warn(message: string): void {
    this.log('WARNING', message);
  }

  error(message: string): void {
    this.log('ERROR', message);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  getLogsAsString(): string {
    return this.logs.map(entry => 
      `[${entry.timestamp.toISOString()}] ${entry.level}: ${entry.message}`
    ).join('\n');
  }

  clearLogs(): void {
    this.logs = [];
  }

  private enforceMaxSize(): void {
    const currentSize = this.getCurrentSizeBytes();
    
    if (currentSize > this.maxSizeBytes) {
      // Remove the oldest entries until we've freed up cleanupSizeBytes
      let removedSize = 0;
      let removedCount = 0;
      
      while (removedSize < this.cleanupSizeBytes && this.logs.length > removedCount) {
        const entrySize = this.getEntrySize(this.logs[removedCount]);
        removedSize += entrySize;
        removedCount++;
      }
      
      this.logs.splice(0, removedCount);
    }
  }

  private getCurrentSizeBytes(): number {
    return this.logs.reduce((total, entry) => total + this.getEntrySize(entry), 0);
  }

  private getEntrySize(entry: LogEntry): number {
    // Rough estimate: timestamp + level + message + overhead
    return entry.timestamp.toISOString().length + 
           entry.level.length + 
           entry.message.length + 
           20; // overhead for JSON structure
  }
}

// Global logging service instance
export const loggingService = new LoggingService();