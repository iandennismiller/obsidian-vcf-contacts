/**
 * Revision value object for tracking contact modifications
 * 
 * Immutable timestamp value object for REV field in vCard format.
 * Supports ISO 8601 format timestamps.
 */

/**
 * Revision value object for contact modification tracking
 */
export class Revision {
  private readonly timestamp: Date;
  
  /**
   * Private constructor - use factory methods instead
   * 
   * @param timestamp - Date object
   */
  private constructor(timestamp: Date) {
    this.timestamp = new Date(timestamp.getTime()); // Defensive copy
  }
  
  /**
   * Create Revision with current timestamp
   * 
   * @returns Revision instance with current time
   */
  static now(): Revision {
    return new Revision(new Date());
  }
  
  /**
   * Create Revision from ISO 8601 string
   * 
   * @param dateString - ISO 8601 formatted date string
   * @returns Revision instance
   * @throws Error if date string is invalid
   */
  static fromString(dateString: string): Revision {
    if (!dateString || dateString.trim() === '') {
      throw new Error('Revision date string cannot be empty');
    }
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date string: ${dateString}`);
    }
    
    return new Revision(date);
  }
  
  /**
   * Create Revision from Unix timestamp (milliseconds)
   * 
   * @param timestamp - Unix timestamp in milliseconds
   * @returns Revision instance
   * @throws Error if timestamp is invalid
   */
  static fromTimestamp(timestamp: number): Revision {
    if (typeof timestamp !== 'number' || isNaN(timestamp)) {
      throw new Error('Invalid timestamp: must be a number');
    }
    
    if (timestamp < 0) {
      throw new Error('Invalid timestamp: must be non-negative');
    }
    
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid timestamp: ${timestamp}`);
    }
    
    return new Revision(date);
  }
  
  /**
   * Create Revision from Date object
   * 
   * @param date - Date object
   * @returns Revision instance
   * @throws Error if date is invalid
   */
  static fromDate(date: Date): Revision {
    if (!(date instanceof Date)) {
      throw new Error('Invalid date: must be a Date object');
    }
    
    if (isNaN(date.getTime())) {
      throw new Error('Invalid date: Date object is invalid');
    }
    
    return new Revision(date);
  }
  
  /**
   * Get the timestamp as Date object
   * Returns a defensive copy to maintain immutability
   * 
   * @returns Date object (defensive copy)
   */
  getTimestamp(): Date {
    return new Date(this.timestamp.getTime());
  }
  
  /**
   * Convert to ISO 8601 string format
   * 
   * @returns ISO 8601 formatted string
   */
  toISOString(): string {
    return this.timestamp.toISOString();
  }
  
  /**
   * Check if this revision is newer than another
   * 
   * @param other - Another Revision instance
   * @returns True if this revision is newer
   */
  isNewerThan(other: Revision): boolean {
    return this.timestamp.getTime() > other.timestamp.getTime();
  }
  
  /**
   * Check if this revision is older than another
   * 
   * @param other - Another Revision instance
   * @returns True if this revision is older
   */
  isOlderThan(other: Revision): boolean {
    return this.timestamp.getTime() < other.timestamp.getTime();
  }
  
  /**
   * Check equality with another Revision
   * 
   * @param other - Another Revision instance
   * @returns True if timestamps are equal
   */
  equals(other: Revision | null | undefined): boolean {
    if (!other) {
      return false;
    }
    return this.timestamp.getTime() === other.timestamp.getTime();
  }
  
  /**
   * Get time difference in milliseconds
   * 
   * @param other - Another Revision instance
   * @returns Time difference in milliseconds (positive if this is newer)
   */
  diff(other: Revision): number {
    return this.timestamp.getTime() - other.timestamp.getTime();
  }
  
  /**
   * String representation (ISO 8601 format)
   * 
   * @returns ISO 8601 formatted string
   */
  toString(): string {
    return this.toISOString();
  }
  
  /**
   * Format for frontmatter (ISO 8601)
   * 
   * @returns ISO 8601 formatted string suitable for frontmatter
   */
  toFrontmatterValue(): string {
    return this.toISOString();
  }
  
  /**
   * Format for display
   * 
   * @returns Human-readable formatted string
   */
  toDisplayString(): string {
    return this.timestamp.toLocaleString();
  }
  
  /**
   * Get Unix timestamp in milliseconds
   * 
   * @returns Unix timestamp
   */
  toMilliseconds(): number {
    return this.timestamp.getTime();
  }
}
