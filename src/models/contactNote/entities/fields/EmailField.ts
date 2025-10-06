/**
 * Email field implementation
 * 
 * Represents an email address field with validation.
 * Supports RFC 5322 email format validation.
 */

import { ContactField, ValidationResult, FrontmatterEntry } from './ContactField';

/**
 * Email field for contact email addresses
 */
export class EmailField extends ContactField {
  /**
   * Create EmailField from frontmatter
   * 
   * @param key - Frontmatter key (e.g., "EMAIL.WORK")
   * @param value - Email address
   * @returns EmailField instance
   */
  static fromFrontmatter(key: string, value: string): EmailField {
    // Extract label from key: EMAIL.WORK.PRIMARY -> WORK.PRIMARY
    const parts = key.split('.');
    const label = parts.length > 1 ? parts.slice(1).join('.') : 'DEFAULT';
    return new EmailField(label, value);
  }
  
  /**
   * Create EmailField from markdown line
   * 
   * @param line - Markdown line (e.g., "- Work: email@example.com")
   * @returns EmailField instance or null if parsing fails
   */
  static fromMarkdown(line: string): EmailField | null {
    // Parse markdown format: "- Label: email@example.com"
    const match = line.trim().match(/^-\s*([^:]+):\s*(.+)$/);
    if (!match) {
      return null;
    }
    
    const label = match[1].trim();
    const email = match[2].trim();
    
    // Verify it's actually an email
    if (!EmailField.isEmailFormat(email)) {
      return null;
    }
    
    return new EmailField(label, email);
  }
  
  /**
   * Check if value looks like an email
   * 
   * @param value - Value to check
   * @returns True if it looks like an email
   */
  private static isEmailFormat(value: string): boolean {
    return value.includes('@') && value.includes('.');
  }
  
  /**
   * Get field type
   * 
   * @returns "EMAIL"
   */
  getType(): string {
    return 'EMAIL';
  }
  
  /**
   * Validate email value (static method for validation without instance)
   * 
   * @param value - Email address to validate
   * @returns True if valid email format
   */
  static validateValue(value: string): boolean {
    if (!value || value.trim() === '') {
      return false;
    }
    
    // RFC 5322 simplified email regex
    const emailPattern = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    
    return emailPattern.test(value);
  }
  
  /**
   * Validate email format
   * Uses RFC 5322 simplified regex
   * 
   * @returns Validation result
   */
  validate(): ValidationResult {
    const errors: string[] = [];
    
    if (!this.value || this.value.trim() === '') {
      errors.push('Email address cannot be empty');
      return { isValid: false, errors };
    }
    
    if (!EmailField.validateValue(this.value)) {
      errors.push('Invalid email format');
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
      key: `EMAIL.${this.label}`,
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
   * Get email domain
   * 
   * @returns Domain part of email
   */
  getDomain(): string {
    const atIndex = this.value.lastIndexOf('@');
    if (atIndex === -1) {
      return '';
    }
    return this.value.substring(atIndex + 1);
  }
  
  /**
   * Get local part of email
   * 
   * @returns Local part (before @)
   */
  getLocalPart(): string {
    const atIndex = this.value.indexOf('@');
    if (atIndex === -1) {
      return this.value;
    }
    return this.value.substring(0, atIndex);
  }
  
  /**
   * Check if this is a work email
   * 
   * @returns True if label is "WORK" (case-insensitive)
   */
  isWorkEmail(): boolean {
    return this.label.toUpperCase() === 'WORK';
  }
}
