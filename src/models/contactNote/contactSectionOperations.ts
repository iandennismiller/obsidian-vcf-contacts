/**
 * Contact Section operations that work directly with ContactData
 * for parsing and generating the ## Contact section in markdown.
 * 
 * This module provides bidirectional sync between frontmatter contact fields
 * (EMAIL, TEL, ADR, URL, etc.) and a human-readable Contact section in markdown.
 */

import { ContactData } from './contactData';
import { ContactsPluginSettings } from 'src/plugin/settings';

/**
 * Represents a parsed contact field from the Contact section
 */
export interface ParsedContactField {
  /** Field type (EMAIL, TEL, ADR, URL) */
  fieldType: string;
  /** Field subtype/label (HOME, WORK, CELL, etc.) or numeric index */
  fieldLabel: string;
  /** Field value */
  value: string;
  /** For structured fields like ADR, the component (STREET, LOCALITY, etc.) */
  component?: string;
}

/**
 * Represents a grouped set of contact fields for display
 */
export interface ContactFieldGroup {
  /** Field type (EMAIL, TEL, ADR, URL) */
  fieldType: string;
  /** Display icon/emoji for the field type */
  icon: string;
  /** Display name for the field type */
  displayName: string;
  /** Individual fields in this group */
  fields: Array<{
    label: string;
    value: string;
    isMultiLine?: boolean;
  }>;
}

/**
 * Template for parsing and formatting contact fields
 */
export interface FuzzyTemplate {
  /** Field type this template applies to */
  fieldType: string;
  /** Template string for display (e.g., "{TYPE}: {VALUE}") */
  displayTemplate: string;
  /** Regex pattern for parsing */
  parsePattern: RegExp;
  /** Icon/emoji for visual indication */
  icon?: string;
  /** Display name */
  displayName?: string;
}

/**
 * Contact Section operations that work directly with ContactData
 * to minimize data access overhead and improve cache locality.
 */
export class ContactSectionOperations {
  private contactData: ContactData;
  private settings: ContactsPluginSettings;
  
  // Default templates for common field types
  private static readonly DEFAULT_TEMPLATES: Record<string, FuzzyTemplate> = {
    EMAIL: {
      fieldType: 'EMAIL',
      displayTemplate: '- {TYPE}: {VALUE}',
      parsePattern: /^-\s*([^:]+):\s*(.+)$/,
      icon: '📧',
      displayName: 'Email'
    },
    TEL: {
      fieldType: 'TEL',
      displayTemplate: '- {TYPE}: {VALUE}',
      parsePattern: /^-\s*([^:]+):\s*(.+)$/,
      icon: '📞',
      displayName: 'Phone'
    },
    URL: {
      fieldType: 'URL',
      displayTemplate: '- {TYPE}: {VALUE}',
      parsePattern: /^-\s*([^:]+):\s*(.+)$/,
      icon: '🌐',
      displayName: 'Website'
    },
    ADR: {
      fieldType: 'ADR',
      displayTemplate: '{STREET}\n{LOCALITY}, {REGION} {POSTAL}\n{COUNTRY}',
      parsePattern: /^(.+)$/,
      icon: '🏠',
      displayName: 'Address'
    }
  };

  constructor(contactData: ContactData, settings: ContactsPluginSettings) {
    this.contactData = contactData;
    this.settings = settings;
  }

  /**
   * Format a field label for display
   * - Removes numeric index prefix (e.g., "1:WORK" -> "WORK")
   * - Converts to title case (e.g., "WORK" -> "Work")
   */
  private formatFieldLabel(label: string): string {
    // Remove numeric index prefix if present (e.g., "1:WORK" -> "WORK")
    const withoutIndex = label.replace(/^\d+:/, '');
    
    // Convert to title case
    return withoutIndex.charAt(0).toUpperCase() + withoutIndex.slice(1).toLowerCase();
  }

  // === Contact Section Parsing ===

  /**
   * Parse Contact section from markdown content
   * Returns parsed contact fields that can be synced to frontmatter
   */
  async parseContactSection(): Promise<ParsedContactField[]> {
    const content = await this.contactData.getContent();
    const fields: ParsedContactField[] = [];

    // Find the Contact section - case-insensitive and depth-agnostic
    // Matches any heading level (##, ###, ####, etc.) with "Contact" in any case
    const contactSectionMatch = content.match(/(^|\n)(#{2,})\s*contact\s*\n([\s\S]*?)(?=\n#{2,}\s|\n\n(?:#|$)|\n$)/i);
    if (!contactSectionMatch) {
      console.debug(`[ContactSectionOperations] No Contact section found in content`);
      return fields;
    }

    const contactContent = contactSectionMatch[3];
    console.debug(`[ContactSectionOperations] Found Contact section content: ${contactContent.substring(0, 200)}`);
    
    const lines = contactContent.split('\n');
    let currentFieldType: string | null = null;
    let currentLabel: string | null = null;
    let addressBuffer: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Check for field type headers (e.g., "📧 Email", "Email", etc.)
      // Only match known field type names to avoid false positives
      const headerMatch = line.match(/^(?:[\p{Emoji}\uFE0F]+\s*)?(Email|Emails|Phone|Phones|Address|Addresses|Website|Websites|URL)s?$/ui);
      if (headerMatch) {
        // Flush any pending address
        if (currentFieldType === 'ADR' && addressBuffer.length > 0) {
          this.parseAddressBuffer(addressBuffer, currentLabel || '1', fields);
          addressBuffer = [];
        }

        const headerText = headerMatch[1].toUpperCase();
        // Map common names to field types
        if (headerText === 'EMAIL' || headerText === 'EMAILS') {
          currentFieldType = 'EMAIL';
        } else if (headerText === 'PHONE' || headerText === 'PHONES') {
          currentFieldType = 'TEL';
        } else if (headerText === 'ADDRESS' || headerText === 'ADDRESSES') {
          currentFieldType = 'ADR';
        } else if (headerText === 'WEBSITE' || headerText === 'WEBSITES' || headerText === 'URL') {
          currentFieldType = 'URL';
        } else {
          currentFieldType = null;
        }
        continue;
      }

      // Parse field lines based on current type
      if (currentFieldType && currentFieldType !== 'ADR') {
        // Parse simple fields (EMAIL, TEL, URL)
        // Try new format first: "Label value" (no dash, no colon)
        const newFormatMatch = line.match(/^([A-Za-z]+)\s+(.+)$/);
        if (newFormatMatch) {
          const [, label, value] = newFormatMatch;
          fields.push({
            fieldType: currentFieldType,
            fieldLabel: label.trim(),
            value: value.trim()
          });
        } else {
          // Try old format: "- Label: Value"
          const oldFormatMatch = line.match(/^-\s*([^:]+):\s*(.+)$/);
          if (oldFormatMatch) {
            const [, label, value] = oldFormatMatch;
            fields.push({
              fieldType: currentFieldType,
              fieldLabel: label.trim(),
              value: value.trim()
            });
          } else {
            // Try without label (just "- value")
            const simpleMatch = line.match(/^-\s*(.+)$/);
            if (simpleMatch) {
              // Use numeric index for unlabeled fields
              const existingCount = fields.filter(f => f.fieldType === currentFieldType).length;
              fields.push({
                fieldType: currentFieldType,
                fieldLabel: String(existingCount + 1),
                value: simpleMatch[1].trim()
              });
            }
          }
        }
      } else if (currentFieldType === 'ADR') {
        // Buffer address lines for multi-line parsing
        if (line.startsWith('(') || line.match(/^\w+:/)) {
          // Flush previous address
          if (addressBuffer.length > 0) {
            this.parseAddressBuffer(addressBuffer, currentLabel || '1', fields);
            addressBuffer = [];
          }
          // Extract label if present
          const labelMatch = line.match(/^\(([^)]+)\)/);
          if (labelMatch) {
            currentLabel = labelMatch[1];
          }
          // Don't add label line to buffer
          continue;
        } else {
          addressBuffer.push(line);
        }
      }
    }

    // Flush any remaining address
    if (currentFieldType === 'ADR' && addressBuffer.length > 0) {
      this.parseAddressBuffer(addressBuffer, currentLabel || '1', fields);
    }

    console.debug(`[ContactSectionOperations] Parsed ${fields.length} contact fields`);
    return fields;
  }

  /**
   * Parse buffered address lines into structured address components
   */
  private parseAddressBuffer(lines: string[], label: string, fields: ParsedContactField[]): void {
    if (lines.length === 0) return;

    // Address parsing logic:
    // - First line is always STREET
    // - If 2 lines: second line is city/state/zip
    // - If 3+ lines: second line is city/state/zip, last line is country
    
    if (lines.length >= 1) {
      fields.push({
        fieldType: 'ADR',
        fieldLabel: label,
        component: 'STREET',
        value: lines[0]
      });
    }
    
    if (lines.length >= 2) {
      // Determine which line contains city/state/zip
      // If 3+ lines, it's the middle line (lines[1])
      // If 2 lines, it's the last line (lines[1])
      const cityLineIndex = lines.length >= 3 ? 1 : lines.length - 1;
      const cityLine = lines[cityLineIndex];
      
      // Parse "City, State ZIP" format
      const cityMatch = cityLine.match(/^([^,]+),?\s*([A-Z]{2})?\s*(\d{5}(?:-\d{4})?)?$/);
      if (cityMatch) {
        const [, locality, region, postal] = cityMatch;
        if (locality) {
          fields.push({
            fieldType: 'ADR',
            fieldLabel: label,
            component: 'LOCALITY',
            value: locality.trim()
          });
        }
        if (region) {
          fields.push({
            fieldType: 'ADR',
            fieldLabel: label,
            component: 'REGION',
            value: region.trim()
          });
        }
        if (postal) {
          fields.push({
            fieldType: 'ADR',
            fieldLabel: label,
            component: 'POSTAL',
            value: postal.trim()
          });
        }
      } else {
        // Fallback: treat as locality
        fields.push({
          fieldType: 'ADR',
          fieldLabel: label,
          component: 'LOCALITY',
          value: cityLine
        });
      }
    }
    
    if (lines.length >= 3) {
      fields.push({
        fieldType: 'ADR',
        fieldLabel: label,
        component: 'COUNTRY',
        value: lines[lines.length - 1]
      });
    }
  }

  // === Contact Section Generation ===

  /**
   * Generate Contact section markdown from frontmatter fields using template
   * Returns the markdown content for the Contact section
   */
  async generateContactSection(): Promise<string> {
    const frontmatter = await this.contactData.getFrontmatter();
    if (!frontmatter) return '';

    const template = this.settings.contactSectionTemplate || '';
    if (!template) return '';

    return this.renderTemplate(template, frontmatter);
  }

  /**
   * Render template string with frontmatter data
   */
  private renderTemplate(template: string, frontmatter: Record<string, any>): string {
    let output = template;

    // Group fields by type
    const fieldsByType: Record<string, Array<{label: string, value: string, components?: Record<string, string>}>> = {
      EMAIL: [],
      TEL: [],
      ADR: [],
      URL: []
    };

    // Parse frontmatter into field groups
    for (const [key, value] of Object.entries(frontmatter)) {
      const match = key.match(/^(EMAIL|TEL|ADR|URL)\[([^\]]+)\](?:\.(.+))?$/);
      if (!match) continue;

      const [, fieldType, label, component] = match;
      
      if (fieldType === 'ADR') {
        // Handle address components
        let field = fieldsByType[fieldType].find(f => f.label === label);
        if (!field) {
          field = { label, value: '', components: {} };
          fieldsByType[fieldType].push(field);
        }
        if (component && field.components) {
          field.components[component] = String(value);
        }
      } else {
        // Handle simple fields
        fieldsByType[fieldType].push({
          label: this.formatFieldLabel(label),
          value: String(value)
        });
      }
    }

    // Process each field type section (with or without hyphen for newline suppression)
    for (const fieldType of ['EMAIL', 'TEL', 'ADR', 'URL']) {
      // Match both {{#FIELDTYPE}} and {{#FIELDTYPE-}} (with hyphen for newline suppression)
      const sectionRegex = new RegExp(`{{#${fieldType}(-?)}}([\\s\\S]*?){{/${fieldType}\\1}}`, 'g');
      
      output = output.replace(sectionRegex, (match, hyphen, sectionContent) => {
        const fields = fieldsByType[fieldType];
        
        // If no fields and hyphen is present, check if followed by newline and suppress it
        if (fields.length === 0) {
          // If hyphen suffix is used and the closing tag is followed by a newline, 
          // the entire match including the newline should be removed
          if (hyphen === '-') {
            // The replacement returns empty string, and the regex match already 
            // consumed up to the closing tag. We need to check what follows.
            return '';
          }
          return '';
        }

        // Process FIRST or ALL blocks within the section
        let result = sectionContent;
        
        // Handle {{#FIRST}}...{{/FIRST}} and {{#FIRST-}}...{{/FIRST-}}
        const firstRegex = /{{#FIRST(-?)}}([\s\S]*?){{\/FIRST\1}}/g;
        result = result.replace(firstRegex, (_match: string, hyphen: string, blockContent: string) => {
          if (fields.length === 0) return '';
          return this.renderFieldBlock(blockContent, fields[0], fieldType);
        });

        // Handle {{#ALL}}...{{/ALL}} and {{#ALL-}}...{{/ALL-}}
        const allRegex = /{{#ALL(-?)}}([\s\S]*?){{\/ALL\1}}/g;
        result = result.replace(allRegex, (_match: string, hyphen: string, blockContent: string) => {
          return fields.map(field => this.renderFieldBlock(blockContent, field, fieldType)).join('\n');
        });

        return result;
      });
    }

    // Handle newline suppression: when a tag with hyphen is followed by newline, remove the newline
    // This catches cases where {{/TAG-}}\n should become {{/TAG-}} (newline removed)
    output = output.replace(/{{\/(?:EMAIL|TEL|ADR|URL|FIRST|ALL)-}}\n/g, (match) => {
      // Remove the newline after the closing tag with hyphen
      return match.slice(0, -1);
    });

    // Remove any remaining template tags
    output = output.replace(/{{[^}]+}}/g, '');
    
    return output.trim();
  }

  /**
   * Render a single field block with template variables
   */
  private renderFieldBlock(
    template: string, 
    field: {label: string, value: string, components?: Record<string, string>},
    fieldType: string
  ): string {
    let result = template;

    // Replace common variables
    result = result.replace(/{{LABEL}}/g, field.label);
    result = result.replace(/{{VALUE}}/g, field.value);

    // Replace address-specific variables
    if (fieldType === 'ADR' && field.components) {
      result = result.replace(/{{STREET}}/g, field.components.STREET || '');
      result = result.replace(/{{LOCALITY}}/g, field.components.LOCALITY || '');
      result = result.replace(/{{REGION}}/g, field.components.REGION || '');
      result = result.replace(/{{POSTAL}}/g, field.components.POSTAL || '');
      result = result.replace(/{{COUNTRY}}/g, field.components.COUNTRY || '');
    }

    return result;
  }

  /**
   * Group frontmatter contact fields by type for organized display
   */
  private groupContactFields(frontmatter: Record<string, any>): ContactFieldGroup[] {
    const groups: Map<string, ContactFieldGroup> = new Map();

    // Use configured field order from settings
    const fieldOrder = this.settings.contactTemplateFieldOrder || ['EMAIL', 'TEL', 'ADR', 'URL'];

    for (const [key, value] of Object.entries(frontmatter)) {
      // Parse field type and label from key (e.g., "EMAIL[HOME]", "ADR[HOME].STREET")
      const match = key.match(/^(EMAIL|TEL|ADR|URL)\[([^\]]+)\](?:\.(.+))?$/);
      if (!match) continue;

      const [, fieldType, label, component] = match;
      const template = ContactSectionOperations.DEFAULT_TEMPLATES[fieldType];
      if (!template) continue;

      // Get or create group using configured icons and display names
      if (!groups.has(fieldType)) {
        groups.set(fieldType, {
          fieldType,
          icon: this.settings.contactTemplateIcons[fieldType] || template.icon || '',
          displayName: this.settings.contactTemplateDisplayNames[fieldType] || template.displayName || fieldType,
          fields: []
        });
      }

      const group = groups.get(fieldType)!;

      if (fieldType === 'ADR') {
        // Handle structured address fields
        this.addAddressField(group, label, component, value);
      } else {
        // Handle simple fields
        group.fields.push({
          label,
          value: String(value)
        });
      }
    }

    // Return groups in preferred order
    return fieldOrder
      .map(type => groups.get(type))
      .filter((g): g is ContactFieldGroup => g !== undefined);
  }

  /**
   * Add an address component to the address group
   */
  private addAddressField(group: ContactFieldGroup, label: string, component: string | undefined, value: any): void {
    // Find or create address entry for this label
    let addressField = group.fields.find(f => f.label === label);
    if (!addressField) {
      addressField = {
        label,
        value: '',
        isMultiLine: true
      };
      group.fields.push(addressField);
    }

    // Build multi-line address format
    const componentValues: Record<string, string> = {};
    
    // Parse existing value to extract components
    if (addressField.value) {
      const lines = addressField.value.split('\n');
      if (lines[0]) componentValues.STREET = lines[0];
      if (lines[1]) {
        const cityLine = lines[1];
        const parts = cityLine.split(',');
        if (parts[0]) componentValues.LOCALITY = parts[0].trim();
        if (parts[1]) {
          const regionPostal = parts[1].trim().split(/\s+/);
          if (regionPostal[0]) componentValues.REGION = regionPostal[0];
          if (regionPostal[1]) componentValues.POSTAL = regionPostal[1];
        }
      }
      if (lines[2]) componentValues.COUNTRY = lines[2];
    }

    // Update with new component value
    if (component) {
      componentValues[component] = String(value);
    }

    // Rebuild address string
    const parts: string[] = [];
    if (componentValues.STREET) parts.push(componentValues.STREET);
    
    const cityLine: string[] = [];
    if (componentValues.LOCALITY) cityLine.push(componentValues.LOCALITY);
    const regionPostal: string[] = [];
    if (componentValues.REGION) regionPostal.push(componentValues.REGION);
    if (componentValues.POSTAL) regionPostal.push(componentValues.POSTAL);
    if (regionPostal.length > 0) {
      cityLine.push(regionPostal.join(' '));
    }
    if (cityLine.length > 0) {
      parts.push(cityLine.join(', '));
    }
    
    if (componentValues.COUNTRY) parts.push(componentValues.COUNTRY);

    addressField.value = parts.join('\n');
  }

  // === Contact Section Validation ===

  /**
   * Validate contact information
   * Returns validation warnings without blocking operations
   */
  validateContactFields(fields: ParsedContactField[]): string[] {
    const warnings: string[] = [];

    for (const field of fields) {
      switch (field.fieldType) {
        case 'EMAIL':
          if (!this.isValidEmail(field.value)) {
            warnings.push(`Invalid email format: ${field.value}`);
          }
          break;
        case 'TEL':
          if (!this.isValidPhone(field.value)) {
            warnings.push(`Invalid phone format: ${field.value}`);
          }
          break;
        case 'URL':
          if (!this.isValidURL(field.value)) {
            warnings.push(`Invalid URL format: ${field.value}`);
          }
          break;
      }
    }

    return warnings;
  }

  private isValidEmail(email: string): boolean {
    // Basic email validation
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private isValidPhone(phone: string): boolean {
    // Flexible phone validation - just check for digits
    return /\d/.test(phone);
  }

  private isValidURL(url: string): boolean {
    // Basic URL validation
    return /^https?:\/\/.+/.test(url);
  }

  // === Contact Section Update ===

  /**
   * Update the Contact section in markdown content
   * Replaces existing Contact section or adds it before Related section (if exists) or before final hashtags
   * If Contact exists after Related, moves it to before Related
   */
  async updateContactSectionInContent(contactSection: string): Promise<void> {
    const content = await this.contactData.getContent();

    // Check if Contact section exists
    const contactSectionMatch = content.match(/(^|\n)(#{2,})\s*contact\s*\n[\s\S]*?(?=\n#{2,}\s|\n\n(?:#|$)|\n$)/i);
    // Check if Related section exists
    const relatedSectionMatch = content.match(/(^|\n)(#{2,})\s*related\s*\n/i);
    
    let newContent: string;
    if (contactSectionMatch) {
      // Contact section exists
      if (relatedSectionMatch) {
        // Both sections exist - check if Contact is after Related
        const contactIndex = content.indexOf(contactSectionMatch[0]);
        const relatedIndex = content.indexOf(relatedSectionMatch[0]);
        
        if (contactIndex > relatedIndex) {
          // Contact is AFTER Related - need to fix the ordering
          // 1. Remove Contact from its current location
          const contentWithoutContact = content.replace(contactSectionMatch[0], '');
          // 2. Insert Contact before Related
          const relatedIndexInNewContent = contentWithoutContact.indexOf(relatedSectionMatch[0]);
          newContent = contentWithoutContact.substring(0, relatedIndexInNewContent) + 
                      `\n${contactSection}\n` + 
                      contentWithoutContact.substring(relatedIndexInNewContent);
        } else {
          // Contact is already before Related - just replace in place
          newContent = content.replace(contactSectionMatch[0], `\n${contactSection}`);
        }
      } else {
        // Only Contact exists - replace in place
        newContent = content.replace(contactSectionMatch[0], `\n${contactSection}`);
      }
    } else {
      // Contact section doesn't exist - add it
      if (relatedSectionMatch) {
        // Insert Contact section before Related section
        const relatedIndex = content.indexOf(relatedSectionMatch[0]);
        newContent = content.substring(0, relatedIndex) + `\n${contactSection}\n` + content.substring(relatedIndex);
      } else {
        // Add Contact section before final hashtags (match both single and double newlines)
        const hashtagMatch = content.match(/\n+(#\w+.*?)$/);
        if (hashtagMatch) {
          newContent = content.replace(hashtagMatch[0], `\n\n${contactSection}\n\n${hashtagMatch[1]}`);
        } else {
          // Add at the end
          newContent = `${content}\n\n${contactSection}`;
        }
      }
    }

    await this.contactData.updateContent(newContent);
  }
}
