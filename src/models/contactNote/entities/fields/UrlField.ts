/**
 * URL field implementation
 * 
 * Represents a URL/website field with validation.
 * Supports various URL formats and protocols.
 */

import { ContactField, ValidationResult, FrontmatterEntry } from './ContactField';

/**
 * URL field for contact websites and links
 */
export class UrlField extends ContactField {
  /**
   * Create UrlField from frontmatter
   * 
   * @param key - Frontmatter key (e.g., "URL.WEBSITE")
   * @param value - URL string
   * @returns UrlField instance
   */
  static fromFrontmatter(key: string, value: string): UrlField {
    // Extract label from key: URL.WEBSITE.PRIMARY -> WEBSITE.PRIMARY
    const parts = key.split('.');
    const label = parts.length > 1 ? parts.slice(1).join('.') : 'DEFAULT';
    return new UrlField(label, value);
  }
  
  /**
   * Create UrlField from markdown line
   * 
   * @param line - Markdown line (e.g., "- Website: https://example.com")
   * @returns UrlField instance or null if parsing fails
   */
  static fromMarkdown(line: string): UrlField | null {
    // Parse markdown format: "- Label: url"
    const match = line.trim().match(/^-\s*([^:]+):\s*(.+)$/);
    if (!match) {
      return null;
    }
    
    const label = match[1].trim();
    const url = match[2].trim();
    
    // Basic check for URL-like pattern
    if (!UrlField.looksLikeUrl(url)) {
      return null;
    }
    
    return new UrlField(label, url);
  }
  
  /**
   * Check if value looks like a URL
   * 
   * @param value - Value to check
   * @returns True if looks like URL
   */
  private static looksLikeUrl(value: string): boolean {
    // Check for common URL patterns
    return /^(https?:\/\/|www\.|[a-zA-Z0-9-]+\.[a-zA-Z]{2,})/.test(value);
  }
  
  /**
   * Get field type
   * 
   * @returns "URL"
   */
  getType(): string {
    return 'URL';
  }
  
  /**
   * Validate URL format
   * 
   * @returns Validation result
   */
  validate(): ValidationResult {
    const errors: string[] = [];
    
    if (!this.value || this.value.trim() === '') {
      errors.push('URL cannot be empty');
      return { isValid: false, errors };
    }
    
    // Try to parse as URL
    try {
      // Add protocol if missing for validation
      const urlToValidate = this.hasProtocol() ? this.value : `https://${this.value}`;
      const url = new URL(urlToValidate);
      
      // Check for valid hostname
      if (!url.hostname || url.hostname === '') {
        errors.push('URL must have a valid hostname');
        return { isValid: false, errors };
      }
      
      return { isValid: true, errors: [] };
    } catch (error) {
      errors.push('Invalid URL format');
      return { isValid: false, errors };
    }
  }
  
  /**
   * Convert to frontmatter format
   * 
   * @returns Frontmatter entry
   */
  toFrontmatter(): FrontmatterEntry {
    return {
      key: `URL.${this.label}`,
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
   * Check if URL has protocol
   * 
   * @returns True if URL starts with protocol
   */
  hasProtocol(): boolean {
    return /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(this.value);
  }
  
  /**
   * Get protocol
   * 
   * @returns Protocol (e.g., "https", "http") or undefined
   */
  getProtocol(): string | undefined {
    if (!this.hasProtocol()) {
      return undefined;
    }
    
    const match = this.value.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//);
    return match ? match[1] : undefined;
  }
  
  /**
   * Get hostname/domain
   * 
   * @returns Hostname or undefined if invalid
   */
  getHostname(): string | undefined {
    try {
      const urlToValidate = this.hasProtocol() ? this.value : `https://${this.value}`;
      const url = new URL(urlToValidate);
      return url.hostname;
    } catch {
      return undefined;
    }
  }
  
  /**
   * Get path
   * 
   * @returns URL path or undefined
   */
  getPath(): string | undefined {
    try {
      const urlToValidate = this.hasProtocol() ? this.value : `https://${this.value}`;
      const url = new URL(urlToValidate);
      return url.pathname !== '/' ? url.pathname : undefined;
    } catch {
      return undefined;
    }
  }
  
  /**
   * Check if this is an HTTPS URL
   * 
   * @returns True if HTTPS
   */
  isSecure(): boolean {
    const protocol = this.getProtocol();
    return protocol === 'https';
  }
  
  /**
   * Get full URL with protocol
   * 
   * @param defaultProtocol - Protocol to use if missing (default: "https")
   * @returns Full URL with protocol
   */
  getFullUrl(defaultProtocol: string = 'https'): string {
    if (this.hasProtocol()) {
      return this.value;
    }
    return `${defaultProtocol}://${this.value}`;
  }
  
  /**
   * Get URL without protocol
   * 
   * @returns URL without protocol
   */
  getWithoutProtocol(): string {
    if (!this.hasProtocol()) {
      return this.value;
    }
    
    return this.value.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '');
  }
  
  /**
   * Check if this is a social media URL
   * 
   * @returns True if appears to be social media
   */
  isSocialMedia(): boolean {
    const hostname = this.getHostname();
    if (!hostname) return false;
    
    const socialDomains = [
      'facebook.com', 'twitter.com', 'x.com', 'linkedin.com', 
      'instagram.com', 'github.com', 'youtube.com', 'tiktok.com',
      'pinterest.com', 'snapchat.com', 'reddit.com'
    ];
    
    return socialDomains.some(domain => 
      hostname === domain || hostname.endsWith(`.${domain}`)
    );
  }
}
