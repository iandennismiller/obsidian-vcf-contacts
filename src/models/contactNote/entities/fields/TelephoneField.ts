/**
 * Telephone field implementation
 * 
 * Represents a telephone number field with validation.
 * Supports various phone number formats including international.
 */

import { ContactField, ValidationResult, FrontmatterEntry } from './ContactField';

/**
 * Telephone field for contact phone numbers
 */
export class TelephoneField extends ContactField {
  /**
   * Create TelephoneField from frontmatter
   * 
   * @param key - Frontmatter key (e.g., "TEL.CELL")
   * @param value - Phone number
   * @returns TelephoneField instance
   */
  static fromFrontmatter(key: string, value: string): TelephoneField {
    // Extract label from key: TEL.CELL.PRIMARY -> CELL.PRIMARY
    const parts = key.split('.');
    const label = parts.length > 1 ? parts.slice(1).join('.') : 'DEFAULT';
    return new TelephoneField(label, value);
  }
  
  /**
   * Create TelephoneField from markdown line
   * 
   * @param line - Markdown line (e.g., "- Cell: +1-555-123-4567")
   * @returns TelephoneField instance or null if parsing fails
   */
  static fromMarkdown(line: string): TelephoneField | null {
    // Parse markdown format: "- Label: phone-number"
    const match = line.trim().match(/^-\s*([^:]+):\s*(.+)$/);
    if (!match) {
      return null;
    }
    
    const label = match[1].trim();
    const phone = match[2].trim();
    
    // Verify it looks like a phone number (has digits)
    if (!TelephoneField.hasDigits(phone)) {
      return null;
    }
    
    return new TelephoneField(label, phone);
  }
  
  /**
   * Check if value contains digits
   * 
   * @param value - Value to check
   * @returns True if contains digits
   */
  private static hasDigits(value: string): boolean {
    return /\d/.test(value);
  }
  
  /**
   * Get field type
   * 
   * @returns "TEL"
   */
  getType(): string {
    return 'TEL';
  }
  
  /**
   * Validate phone number value (static method for validation without instance)
   * 
   * @param value - Phone number to validate
   * @returns True if valid phone number format
   */
  static validateValue(value: string): boolean {
    if (!value || value.trim() === '') {
      return false;
    }
    
    // Must contain at least some digits
    if (!/\d/.test(value)) {
      return false;
    }
    
    // Must have at least 3 digits (minimum viable phone number)
    const digitCount = (value.match(/\d/g) || []).length;
    if (digitCount < 3) {
      return false;
    }
    
    // Allow common phone number characters: digits, spaces, dashes, parentheses, plus, dots
    if (!/^[\d\s\-().\+]+$/.test(value)) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Validate phone number format
   * Allows various formats including international
   * 
   * @returns Validation result
   */
  validate(): ValidationResult {
    const errors: string[] = [];
    
    if (!this.value || this.value.trim() === '') {
      errors.push('Phone number cannot be empty');
      return { isValid: false, errors };
    }
    
    // Must contain at least some digits
    if (!/\d/.test(this.value)) {
      errors.push('Phone number must contain digits');
      return { isValid: false, errors };
    }
    
    // Must have at least 3 digits (minimum viable phone number)
    const digitCount = (this.value.match(/\d/g) || []).length;
    if (digitCount < 3) {
      errors.push('Phone number must have at least 3 digits');
      return { isValid: false, errors };
    }
    
    // Allow common phone number characters: digits, spaces, dashes, parentheses, plus, dots
    if (!/^[\d\s\-().\+]+$/.test(this.value)) {
      errors.push('Phone number contains invalid characters');
      return { isValid: false, errors };
    }
    
    return { isValid: true, errors: [] };
  }
  
  /**
   * Convert to frontmatter format
   * 
   * @returns Frontmatter entry
   */
  toFrontmatter(): FrontmatterEntry {
    return {
      key: `TEL.${this.label}`,
      value: this.value
    };
  }
  
  /**
   * Convert to markdown format
   * 
   * @returns Markdown string
   */
  toMarkdown(): string {
    return `- ${this.label}: ${this.value}`;
  }
  
  /**
   * Get cleaned phone number (digits only)
   * 
   * @returns Phone number with only digits
   */
  getCleanedNumber(): string {
    return this.value.replace(/\D/g, '');
  }
  
  /**
   * Check if this is a mobile/cell number
   * 
   * @returns True if label indicates mobile/cell
   */
  isMobile(): boolean {
    const label = this.label.toUpperCase();
    return label.includes('MOBILE') || 
           label.includes('CELL') || 
           label.includes('CELLULAR');
  }
  
  /**
   * Check if this is an international number
   * 
   * @returns True if number starts with +
   */
  isInternational(): boolean {
    return this.value.trim().startsWith('+');
  }
  
  /**
   * Format phone number
   * 
   * @param style - Format style ('us', 'international', 'e164')
   * @returns Formatted phone number
   */
  format(style: 'us' | 'international' | 'e164' = 'us'): string {
    const cleaned = this.getCleanedNumber();
    
    switch (style) {
      case 'e164':
        // E.164 format: +1234567890
        return `+${cleaned}`;
        
      case 'international':
        // International format: +1 234 567 8900
        if (cleaned.length >= 10) {
          const country = cleaned.substring(0, cleaned.length - 10);
          const area = cleaned.substring(cleaned.length - 10, cleaned.length - 7);
          const prefix = cleaned.substring(cleaned.length - 7, cleaned.length - 4);
          const line = cleaned.substring(cleaned.length - 4);
          return `+${country} ${area} ${prefix} ${line}`.trim();
        }
        return this.value;
        
      case 'us':
      default:
        // US format: (234) 567-8900
        if (cleaned.length === 10) {
          return `(${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6)}`;
        } else if (cleaned.length === 11) {
          // Assume country code 1
          return `+${cleaned.substring(0, 1)} (${cleaned.substring(1, 4)}) ${cleaned.substring(4, 7)}-${cleaned.substring(7)}`;
        }
        return this.value;
    }
  }
}
