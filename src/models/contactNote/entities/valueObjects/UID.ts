/**
 * UID (Unique Identifier) value object
 * 
 * Validates and normalizes contact unique identifiers.
 * Supports multiple UID formats including UUID and URN formats.
 * Immutable value object with validation.
 */

import { randomUUID } from 'crypto';

/**
 * UID value object for contact unique identification
 */
export class UID {
  private readonly value: string;
  
  /**
   * Private constructor - use factory methods instead
   * 
   * @param value - The UID value (must be valid)
   */
  private constructor(value: string) {
    this.value = value;
  }
  
  /**
   * Generate a new random UID
   * 
   * @returns New UID instance with generated UUID
   */
  static generate(): UID {
    const uuid = randomUUID();
    return new UID(uuid);
  }
  
  /**
   * Create UID from string value
   * Handles various formats: plain UUID, urn:uuid:, [[wikilink]], etc.
   * 
   * @param value - UID string in any supported format
   * @returns UID instance
   * @throws Error if value is invalid
   */
  static fromString(value: string | null | undefined): UID {
    if (!value || value.trim() === '') {
      throw new Error('UID cannot be empty');
    }
    
    let normalized = value.trim();
    
    // Remove URN prefix if present: urn:uuid:xxxxx -> xxxxx
    if (normalized.startsWith('urn:uuid:')) {
      normalized = normalized.substring(9);
    }
    
    // Remove wikilink brackets if present: [[xxxxx]] -> xxxxx
    if (normalized.startsWith('[[') && normalized.endsWith(']]')) {
      normalized = normalized.substring(2, normalized.length - 2).trim();
    }
    
    // Validate the final value
    if (!UID.validate(normalized)) {
      throw new Error(`Invalid UID format: ${value}`);
    }
    
    return new UID(normalized);
  }
  
  /**
   * Create UID from UUID string
   * 
   * @param uuid - UUID string
   * @returns UID instance
   * @throws Error if UUID is invalid
   */
  static fromUUID(uuid: string): UID {
    if (!UID.isUUIDFormat(uuid)) {
      throw new Error(`Invalid UUID format: ${uuid}`);
    }
    return new UID(uuid);
  }
  
  /**
   * Create UID from URN format
   * 
   * @param urn - URN string (e.g., "urn:uuid:xxxxx")
   * @returns UID instance
   * @throws Error if URN is invalid
   */
  static fromURN(urn: string): UID {
    if (!urn.startsWith('urn:uuid:')) {
      throw new Error(`Invalid URN format: ${urn}`);
    }
    
    const uuid = urn.substring(9);
    if (!UID.isUUIDFormat(uuid)) {
      throw new Error(`Invalid UUID in URN: ${urn}`);
    }
    
    return new UID(uuid);
  }
  
  /**
   * Validate UID format
   * 
   * @param value - Value to validate
   * @returns True if valid UID format
   */
  static validate(value: string): boolean {
    if (!value || value.trim() === '') {
      return false;
    }
    
    const trimmed = value.trim();
    
    // Check if it's a UUID format
    if (UID.isUUIDFormat(trimmed)) {
      return true;
    }
    
    // Allow other valid UID formats (alphanumeric with dashes, at least 3 chars)
    // This matches the existing UIDOperations.isValidUID() logic
    return /^[a-zA-Z0-9\-_.]{3,}$/.test(trimmed);
  }
  
  /**
   * Check if value is in UUID format
   * 
   * @param value - Value to check
   * @returns True if valid UUID format
   */
  private static isUUIDFormat(value: string): boolean {
    // UUID format: 8-4-4-4-12 hex digits
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  }
  
  /**
   * Get the UID value
   * 
   * @returns UID string value
   */
  getValue(): string {
    return this.value;
  }
  
  /**
   * Convert to URN format
   * 
   * @returns URN string (e.g., "urn:uuid:xxxxx")
   */
  toURN(): string {
    return `urn:uuid:${this.value}`;
  }
  
  /**
   * Get UUID part only (same as getValue for most cases)
   * 
   * @returns UUID string
   */
  toUUID(): string {
    return this.value;
  }
  
  /**
   * Check if this is a valid UID
   * 
   * @returns True if valid
   */
  isValid(): boolean {
    return UID.validate(this.value);
  }
  
  /**
   * Check if this UID is in UUID format
   * 
   * @returns True if UUID format
   */
  isUUID(): boolean {
    return UID.isUUIDFormat(this.value);
  }
  
  /**
   * Check equality with another UID
   * 
   * @param other - Another UID instance
   * @returns True if UIDs are equal
   */
  equals(other: UID | null | undefined): boolean {
    if (!other) {
      return false;
    }
    return this.value === other.value;
  }
  
  /**
   * String representation
   * 
   * @returns UID value as string
   */
  toString(): string {
    return this.value;
  }
}
