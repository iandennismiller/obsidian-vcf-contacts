/**
 * Gender value object for contact classification
 * 
 * Supports both modern and legacy formats for backward compatibility.
 * Immutable value object with equality by value.
 * 
 * Modern values: 'unknown', 'male', 'female', 'other'
 * Legacy values: 'M', 'F', 'NB', 'U'
 */

/**
 * Modern gender values
 */
export type GenderValue = 'unknown' | 'male' | 'female' | 'other';

/**
 * Legacy gender values for backward compatibility
 */
export type LegacyGenderValue = 'M' | 'F' | 'NB' | 'U';

/**
 * Gender value object
 * Immutable class representing gender classification
 */
export class Gender {
  private readonly value: GenderValue;
  
  // Static constants for common values
  static readonly UNKNOWN = new Gender('unknown');
  static readonly MALE = new Gender('male');
  static readonly FEMALE = new Gender('female');
  static readonly OTHER = new Gender('other');
  
  /**
   * Private constructor - use factory methods instead
   */
  private constructor(value: GenderValue) {
    this.value = value;
  }
  
  /**
   * Create Gender from modern string value
   * Handles various formats including 'non-binary', 'unspecified', etc.
   * 
   * @param value - Gender value in any supported format
   * @returns Gender instance
   * @throws Error if value is invalid
   */
  static fromString(value: string | null | undefined): Gender {
    if (!value || value.trim() === '') {
      return Gender.UNKNOWN;
    }
    
    // Normalize: lowercase, remove hyphens, underscores, spaces
    const normalized = value.trim().toLowerCase().replace(/[-_\s]/g, '');
    
    switch (normalized) {
      case 'unknown':
      case 'unspecified':
      case 'u':
        return Gender.UNKNOWN;
      case 'male':
      case 'm':
        return Gender.MALE;
      case 'female':
      case 'f':
        return Gender.FEMALE;
      case 'other':
      case 'nonbinary':
      case 'nb':
      case 'n':
        return Gender.OTHER;
      default:
        throw new Error(`Invalid gender value: ${value}`);
    }
  }
  
  /**
   * Create Gender from legacy format
   * 
   * @param legacy - Legacy gender code ('M', 'F', 'NB', 'U', or null)
   * @returns Gender instance
   */
  static fromLegacy(legacy: LegacyGenderValue | null | undefined): Gender {
    if (!legacy) {
      return Gender.UNKNOWN;
    }
    
    switch (legacy) {
      case 'M':
        return Gender.MALE;
      case 'F':
        return Gender.FEMALE;
      case 'NB':
        return Gender.OTHER;
      case 'U':
      default:
        return Gender.UNKNOWN;
    }
  }
  
  /**
   * Get the modern gender value
   * 
   * @returns Gender value string
   */
  getValue(): GenderValue {
    return this.value;
  }
  
  /**
   * Check if gender is unknown
   * 
   * @returns True if gender is unknown
   */
  isUnknown(): boolean {
    return this.value === 'unknown';
  }
  
  /**
   * Check if gender is male
   * 
   * @returns True if gender is male
   */
  isMale(): boolean {
    return this.value === 'male';
  }
  
  /**
   * Check if gender is female
   * 
   * @returns True if gender is female
   */
  isFemale(): boolean {
    return this.value === 'female';
  }
  
  /**
   * Check if gender is other/non-binary
   * 
   * @returns True if gender is other
   */
  isOther(): boolean {
    return this.value === 'other';
  }
  
  /**
   * Convert to legacy format
   * 
   * @returns Legacy gender code
   */
  toLegacyFormat(): LegacyGenderValue {
    switch (this.value) {
      case 'male':
        return 'M';
      case 'female':
        return 'F';
      case 'other':
        return 'NB';
      case 'unknown':
      default:
        return 'U';
    }
  }
  
  /**
   * Check equality with another Gender
   * 
   * @param other - Another Gender instance
   * @returns True if genders are equal
   */
  equals(other: Gender | null | undefined): boolean {
    if (!other) {
      return false;
    }
    return this.value === other.value;
  }
  
  /**
   * String representation
   * 
   * @returns Gender value as string
   */
  toString(): string {
    return this.value;
  }
}
