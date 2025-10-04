/**
 * ContactSection - Markdown section for contact field information
 * 
 * Extends MarkdownSection to provide contact field-specific functionality
 * including parsing field lists and converting to markdown format.
 */

import { MarkdownSection } from './MarkdownSection';
import { ContactField } from '../fields/ContactField';
import { EmailField } from '../fields/EmailField';
import { TelephoneField } from '../fields/TelephoneField';
import { AddressField } from '../fields/AddressField';
import { UrlField } from '../fields/UrlField';

/**
 * Grouped contact fields by type
 */
export interface ContactFieldGroup {
  type: string;
  label: string;
  fields: ContactField[];
}

/**
 * Validation result for Contact section
 */
export interface ContactValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * ContactSection represents the ## Contact section in contact notes
 * containing lists of contact fields (emails, phones, addresses, URLs).
 */
export class ContactSection extends MarkdownSection {
  private fields: ContactField[];

  private constructor(name: string, level: number, content: string, fields: ContactField[]) {
    super(name, level, content);
    this.fields = fields;
  }

  /**
   * Create ContactSection from markdown content
   */
  static fromMarkdown(content: string, sectionName: string = 'Contact', level: number = 2): ContactSection {
    const section = new ContactSection(sectionName, level, content, []);
    section.fields = section.parse();
    return section;
  }

  /**
   * Create ContactSection from contact fields
   */
  static fromFields(fields: ContactField[], sectionName: string = 'Contact', level: number = 2): ContactSection {
    // Generate content first
    const content = ContactSection.generateContentFromFields(fields);
    return new ContactSection(sectionName, level, content, fields);
  }

  /**
   * Create empty ContactSection
   */
  static empty(sectionName: string = 'Contact', level: number = 2): ContactSection {
    return new ContactSection(sectionName, level, '', []);
  }

  /**
   * Parse section content into ContactField entities
   */
  parse(): ContactField[] {
    const fields: ContactField[] = [];
    const lines = this.content.trim().split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('-')) {
        continue;
      }

      try {
        // Try to parse as different field types
        const field = this.parseFieldLine(trimmed);
        if (field) {
          fields.push(field);
        }
      } catch (error) {
        // Skip invalid field lines
        continue;
      }
    }

    return fields;
  }

  /**
   * Parse a single field line
   */
  private parseFieldLine(line: string): ContactField | null {
    // Try email
    const email = EmailField.fromMarkdown(line);
    if (email) return email;

    // Try telephone
    const tel = TelephoneField.fromMarkdown(line);
    if (tel) return tel;

    // Try address
    const addr = AddressField.fromMarkdown(line);
    if (addr) return addr;

    // Try URL
    const url = UrlField.fromMarkdown(line);
    if (url) return url;

    return null;
  }

  /**
   * Validate section structure
   */
  validate(): ContactValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if section has content
    if (this.isEmpty() && this.fields.length > 0) {
      errors.push('Section has fields but no content');
    }

    // Validate each field
    for (const field of this.fields) {
      const validation = field.validate();
      if (!validation.isValid) {
        errors.push(...validation.errors.map(e => `Field validation (${field.getType()}): ${e}`));
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get all fields in the section
   */
  getFields(): ContactField[] {
    return [...this.fields];
  }

  /**
   * Get fields by type
   */
  getFieldsByType(type: string): ContactField[] {
    return this.fields.filter(field => field.getType() === type);
  }

  /**
   * Get email fields
   */
  getEmails(): EmailField[] {
    return this.getFieldsByType('EMAIL') as EmailField[];
  }

  /**
   * Get telephone fields
   */
  getTelephones(): TelephoneField[] {
    return this.getFieldsByType('TEL') as TelephoneField[];
  }

  /**
   * Get address fields
   */
  getAddresses(): AddressField[] {
    return this.getFieldsByType('ADR') as AddressField[];
  }

  /**
   * Get URL fields
   */
  getUrls(): UrlField[] {
    return this.getFieldsByType('URL') as UrlField[];
  }

  /**
   * Get fields grouped by type
   */
  getGroupedFields(): ContactFieldGroup[] {
    const groups: ContactFieldGroup[] = [];
    
    const emails = this.getEmails();
    if (emails.length > 0) {
      groups.push({ type: 'EMAIL', label: 'Email', fields: emails });
    }

    const telephones = this.getTelephones();
    if (telephones.length > 0) {
      groups.push({ type: 'TEL', label: 'Telephone', fields: telephones });
    }

    const addresses = this.getAddresses();
    if (addresses.length > 0) {
      groups.push({ type: 'ADR', label: 'Address', fields: addresses });
    }

    const urls = this.getUrls();
    if (urls.length > 0) {
      groups.push({ type: 'URL', label: 'URL', fields: urls });
    }

    return groups;
  }

  /**
   * Add a field (returns new section)
   */
  addField(field: ContactField): ContactSection {
    const newFields = [...this.fields, field];
    return ContactSection.fromFields(newFields, this.name, this.level);
  }

  /**
   * Remove a field (returns new section)
   */
  removeField(field: ContactField): ContactSection {
    const newFields = this.fields.filter(f => !f.equals(field));
    return ContactSection.fromFields(newFields, this.name, this.level);
  }

  /**
   * Generate content from fields (static helper)
   */
  private static generateContentFromFields(fields: ContactField[]): string {
    if (fields.length === 0) {
      return '';
    }

    const lines: string[] = [];
    
    // Organize fields by type in standard order
    const emails = fields.filter(f => f.getType() === 'EMAIL') as EmailField[];
    const telephones = fields.filter(f => f.getType() === 'TEL') as TelephoneField[];
    const addresses = fields.filter(f => f.getType() === 'ADR') as AddressField[];
    const urls = fields.filter(f => f.getType() === 'URL') as UrlField[];

    // Add emails
    for (const email of emails) {
      lines.push(email.toMarkdown());
    }

    // Add telephones
    for (const tel of telephones) {
      lines.push(tel.toMarkdown());
    }

    // Add addresses
    for (const addr of addresses) {
      lines.push(addr.toMarkdown());
    }

    // Add URLs
    for (const url of urls) {
      lines.push(url.toMarkdown());
    }

    return lines.join('\n');
  }

  /**
   * Generate content from fields
   * Fields are organized by type in the order: EMAIL, TEL, ADR, URL
   */
  private generateContent(): string {
    return ContactSection.generateContentFromFields(this.fields);
  }

  /**
   * Convert to markdown format
   */
  toMarkdown(): string {
    const heading = '#'.repeat(this.level) + ` ${this.name}`;
    if (this.fields.length === 0) {
      return `${heading}\n`;
    }
    const content = this.generateContent();
    return `${heading}\n${content}`;
  }
}
