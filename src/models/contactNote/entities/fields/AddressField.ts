/**
 * Address field implementation
 * 
 * Represents a postal address with structured components.
 * Supports various address formats and validation.
 */

import { ContactField, ValidationResult, FrontmatterEntry } from './ContactField';

/**
 * Address components interface
 */
export interface AddressComponents {
  street?: string;
  city?: string;
  state?: string;
  postal?: string;
  country?: string;
}

/**
 * Address field for contact postal addresses
 */
export class AddressField extends ContactField {
  private components: AddressComponents;
  
  /**
   * Create an AddressField
   * 
   * @param label - Field label (e.g., "HOME", "WORK")
   * @param value - Full address string
   * @param components - Optional structured components
   */
  constructor(label: string, value: string, components?: AddressComponents) {
    super(label, value);
    this.components = components || this.parseComponents(value);
  }
  
  /**
   * Create AddressField from frontmatter
   * 
   * @param key - Frontmatter key (e.g., "ADR.HOME")
   * @param value - Address string or structured object
   * @returns AddressField instance
   */
  static fromFrontmatter(key: string, value: string | AddressComponents): AddressField {
    // Extract label from key: ADR.HOME.PRIMARY -> HOME.PRIMARY
    const parts = key.split('.');
    const label = parts.length > 1 ? parts.slice(1).join('.') : 'DEFAULT';
    
    if (typeof value === 'string') {
      return new AddressField(label, value);
    } else {
      // Structured address object
      const addressString = AddressField.componentsToString(value);
      return new AddressField(label, addressString, value);
    }
  }
  
  /**
   * Create AddressField from markdown line
   * 
   * @param line - Markdown line (e.g., "- Home: 123 Main St, City, State 12345")
   * @returns AddressField instance or null if parsing fails
   */
  static fromMarkdown(line: string): AddressField | null {
    // Parse markdown format: "- Label: address"
    const match = line.trim().match(/^-\s*([^:]+):\s*(.+)$/);
    if (!match) {
      return null;
    }
    
    const label = match[1].trim();
    const address = match[2].trim();
    
    return new AddressField(label, address);
  }
  
  /**
   * Convert components to string
   * 
   * @param components - Address components
   * @returns Formatted address string
   */
  private static componentsToString(components: AddressComponents): string {
    const parts: string[] = [];
    
    if (components.street) parts.push(components.street);
    if (components.city) parts.push(components.city);
    if (components.state) parts.push(components.state);
    if (components.postal) parts.push(components.postal);
    if (components.country) parts.push(components.country);
    
    return parts.join(', ');
  }
  
  /**
   * Parse address components from string
   * 
   * @param address - Address string
   * @returns Parsed components
   */
  private parseComponents(address: string): AddressComponents {
    // Simple parsing - split by comma
    const parts = address.split(',').map(p => p.trim());
    
    const components: AddressComponents = {};
    
    if (parts.length >= 1) components.street = parts[0];
    if (parts.length >= 2) components.city = parts[1];
    if (parts.length >= 3) {
      // Try to parse "State Postal" format
      const statePostal = parts[2].match(/^(.+?)\s+(\d{5}(?:-\d{4})?)$/);
      if (statePostal) {
        components.state = statePostal[1];
        components.postal = statePostal[2];
      } else {
        components.state = parts[2];
      }
    }
    if (parts.length >= 4) components.postal = parts[3];
    if (parts.length >= 5) components.country = parts[4];
    
    return components;
  }
  
  /**
   * Get field type
   * 
   * @returns "ADR"
   */
  getType(): string {
    return 'ADR';
  }
  
  /**
   * Validate address
   * 
   * @returns Validation result
   */
  validate(): ValidationResult {
    const errors: string[] = [];
    
    if (!this.value || this.value.trim() === '') {
      errors.push('Address cannot be empty');
      return { isValid: false, errors };
    }
    
    // Address should have some meaningful content
    if (this.value.trim().length < 3) {
      errors.push('Address is too short');
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
      key: `ADR.${this.label}`,
      value: this.value
    };
  }
  
  /**
   * Convert to structured frontmatter format
   * 
   * @returns Frontmatter entry with structured components
   */
  toStructuredFrontmatter(): FrontmatterEntry {
    return {
      key: `ADR.${this.label}`,
      value: this.components
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
   * Get address components
   * 
   * @returns Address components
   */
  getComponents(): AddressComponents {
    return { ...this.components };
  }
  
  /**
   * Get street address
   * 
   * @returns Street address or undefined
   */
  getStreet(): string | undefined {
    return this.components.street;
  }
  
  /**
   * Get city
   * 
   * @returns City or undefined
   */
  getCity(): string | undefined {
    return this.components.city;
  }
  
  /**
   * Get state
   * 
   * @returns State or undefined
   */
  getState(): string | undefined {
    return this.components.state;
  }
  
  /**
   * Get postal code
   * 
   * @returns Postal code or undefined
   */
  getPostal(): string | undefined {
    return this.components.postal;
  }
  
  /**
   * Get country
   * 
   * @returns Country or undefined
   */
  getCountry(): string | undefined {
    return this.components.country;
  }
  
  /**
   * Check if this is a US address
   * 
   * @returns True if appears to be US address
   */
  isUSAddress(): boolean {
    // Check for US postal code pattern (5 digits or 5+4)
    if (this.components.postal && /^\d{5}(?:-\d{4})?$/.test(this.components.postal)) {
      return true;
    }
    
    // Check if country is explicitly US
    if (this.components.country) {
      const country = this.components.country.toUpperCase();
      return country === 'US' || 
             country === 'USA' || 
             country === 'UNITED STATES' ||
             country === 'UNITED STATES OF AMERICA';
    }
    
    return false;
  }
  
  /**
   * Format address in single line
   * 
   * @returns Formatted address string
   */
  formatSingleLine(): string {
    return this.value;
  }
  
  /**
   * Format address in multi-line format
   * 
   * @returns Formatted address with line breaks
   */
  formatMultiLine(): string {
    const lines: string[] = [];
    
    if (this.components.street) lines.push(this.components.street);
    
    const cityStateLine: string[] = [];
    if (this.components.city) cityStateLine.push(this.components.city);
    if (this.components.state && this.components.postal) {
      cityStateLine.push(`${this.components.state} ${this.components.postal}`);
    } else if (this.components.state) {
      cityStateLine.push(this.components.state);
    } else if (this.components.postal) {
      cityStateLine.push(this.components.postal);
    }
    
    if (cityStateLine.length > 0) {
      lines.push(cityStateLine.join(', '));
    }
    
    if (this.components.country) lines.push(this.components.country);
    
    return lines.join('\n');
  }
}
