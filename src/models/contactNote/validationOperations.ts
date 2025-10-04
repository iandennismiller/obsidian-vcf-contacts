/**
 * Validation operations for contact data
 */

import { ContactData } from './contactData';

/**
 * Validation operations that work with ContactData
 */
export class ValidationOperations {
  private contactData: ContactData;

  constructor(contactData: ContactData) {
    this.contactData = contactData;
  }

  /**
   * Validate contact has required fields
   */
  async validateRequiredFields(): Promise<{
    isValid: boolean;
    issues: string[];
  }> {
    const frontmatter = await this.contactData.getFrontmatter();
    const issues: string[] = [];
    
    if (!frontmatter) {
      issues.push('no-frontmatter');
      return { isValid: false, issues };
    }
    
    const hasUID = frontmatter.UID && frontmatter.UID.trim() !== '';
    const hasFN = frontmatter.FN && frontmatter.FN.trim() !== '';
    
    if (!frontmatter.UID) {
      issues.push('missing-uid');
    } else if (frontmatter.UID.trim() === '') {
      issues.push('empty-uid');
    }
    
    if (!frontmatter.FN) {
      issues.push('missing-name');
    }
    
    const isValid = hasUID && hasFN;
    return { isValid, issues };
  }

  /**
   * Validate email format
   */
  validateEmail(email: string): boolean {
    if (!email || typeof email !== 'string') return true; // Empty is valid
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone number format
   */
  validatePhoneNumber(phone: string): boolean {
    if (!phone || typeof phone !== 'string') return true; // Empty is valid
    // Allow various phone formats but reject obviously invalid ones
    const phoneRegex = /^[\+]?[\s\-\(\)0-9]{7,}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  }

  /**
   * Validate date format
   */
  validateDate(dateStr: string): boolean {
    if (!dateStr || typeof dateStr !== 'string') return true; // Empty is valid
    
    // Try various date formats
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  }

  /**
   * Sanitize user input to prevent XSS
   */
  sanitizeInput(input: string): string {
    if (!input || typeof input !== 'string') return '';
    
    // Basic XSS prevention - remove script tags and dangerous content
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, 'removed:')
      .replace(/on\w+\s*=/gi, 'removed=')
      .replace(/alert\s*\(/gi, 'removed(');
  }

  /**
   * Validate URL format
   */
  validateURL(url: string): boolean {
    if (!url || typeof url !== 'string') return true; // Empty is valid
    // Basic URL validation - must start with http:// or https://
    return /^https?:\/\/.+/.test(url);
  }

  /**
   * Identify invalid contact fields in frontmatter
   * Returns list of invalid field keys with their values
   */
  async identifyInvalidFrontmatterFields(): Promise<{
    invalidFields: Array<{ key: string; value: string; reason: string }>;
    errors: string[];
  }> {
    const invalidFields: Array<{ key: string; value: string; reason: string }> = [];
    const errors: string[] = [];

    try {
      const frontmatter = await this.contactData.getFrontmatter();
      if (!frontmatter) {
        return { invalidFields, errors };
      }

      // Check each frontmatter key
      for (const key of Object.keys(frontmatter)) {
        const value = frontmatter[key];
        
        // Skip non-string values or empty values
        if (!value || typeof value !== 'string') {
          continue;
        }

        // Check EMAIL fields
        if (key.startsWith('EMAIL')) {
          if (!this.validateEmail(value)) {
            invalidFields.push({ 
              key, 
              value, 
              reason: 'Invalid email format (must contain @ and domain)' 
            });
          }
        }
        // Check TEL fields
        else if (key.startsWith('TEL')) {
          if (!this.validatePhoneNumber(value)) {
            invalidFields.push({ 
              key, 
              value, 
              reason: 'Invalid phone format (must contain digits)' 
            });
          }
        }
        // Check URL fields
        else if (key.startsWith('URL')) {
          if (!this.validateURL(value)) {
            invalidFields.push({ 
              key, 
              value, 
              reason: 'Invalid URL format (must start with http:// or https://)' 
            });
          }
        }
      }

    } catch (error: any) {
      errors.push(`Error identifying invalid fields: ${error.message}`);
    }

    return { invalidFields, errors };
  }

  /**
   * Remove specified fields from frontmatter
   * Used after user confirmation
   */
  async removeFieldsFromFrontmatter(keysToRemove: string[]): Promise<{
    removed: string[];
    errors: string[];
  }> {
    const removed: string[] = [];
    const errors: string[] = [];

    try {
      const frontmatter = await this.contactData.getFrontmatter();
      if (!frontmatter) {
        return { removed, errors };
      }

      // Remove specified fields
      for (const key of keysToRemove) {
        if (key in frontmatter) {
          delete frontmatter[key];
          removed.push(key);
        }
      }

      // Save the updated frontmatter if any fields were removed
      if (removed.length > 0) {
        await this.saveFrontmatterDirect(frontmatter);
      }

    } catch (error: any) {
      errors.push(`Error removing fields: ${error.message}`);
    }

    return { removed, errors };
  }

  /**
   * Save frontmatter directly by reconstructing the file content
   * This is a helper method for removeInvalidFrontmatterFields
   */
  private async saveFrontmatterDirect(frontmatter: Record<string, any>): Promise<void> {
    // Import yaml library for stringification
    const { stringify: stringifyYaml } = await import('yaml');
    
    const content = await this.contactData.getContent();
    
    // Use yaml library to stringify frontmatter
    let frontmatterYaml = stringifyYaml(frontmatter);
    
    // Ensure frontmatter YAML ends with a newline
    if (!frontmatterYaml.endsWith('\n')) {
      frontmatterYaml += '\n';
    }
    
    const hasExistingFrontmatter = content.startsWith('---\n');
    let newContent: string;
    
    if (hasExistingFrontmatter) {
      const endIndex = content.indexOf('---\n', 4);
      if (endIndex !== -1) {
        newContent = `---\n${frontmatterYaml}---\n${content.substring(endIndex + 4)}`;
      } else {
        newContent = `---\n${frontmatterYaml}---\n${content}`;
      }
    } else {
      newContent = `---\n${frontmatterYaml}---\n${content}`;
    }
    
    await this.contactData.updateContent(newContent);
  }
}
