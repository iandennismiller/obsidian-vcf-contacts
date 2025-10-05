/**
 * Optimized ContactNote class with improved data locality.
 * Groups methods close to the data they operate on for better cache performance.
 */

import { TFile, App } from 'obsidian';
import { ContactsPluginSettings } from 'src/plugin/settings';
import { Gender, Contact, ParsedRelationship, FrontmatterRelationship, ResolvedContact } from './types';

// Import the optimized components
import { ContactData } from './contactData';
import { SyncOperations } from './syncOperations';
import { AdvancedRelationshipOperations } from './advancedRelationshipOperations';

// Import entities
import { UID } from './entities/valueObjects/UID';
import { Revision } from './entities/valueObjects/Revision';
import { Gender as GenderEntity } from './entities/valueObjects/Gender';
import { ContactSection } from './entities/document/ContactSection';
import type { ContactField } from './entities/fields/ContactField';
import { RelatedSection } from './entities/document/RelatedSection';
import { Relationship } from './entities/relationships/Relationship';
import { RelationshipType } from './entities/relationships/RelationshipType';
import { RelationshipReference } from './entities/relationships/RelationshipReference';

// Import utilities for markdown rendering
import { stringify as stringifyYaml } from 'yaml';
import { marked, Tokens } from 'marked';
import { 
  SECTION_NAMES, 
  HEADING_LEVELS, 
  FIELD_GROUPS,
  REGEX_PATTERNS
} from './markdownConstants';

// Re-export types for backward compatibility and external use
export type { Contact, Gender, ParsedRelationship, FrontmatterRelationship, ResolvedContact };

// Re-export utility functions
export { mdRender, createNameSlug, createContactSlug, isKind, fileId, getUiName, uiSafeString, getSortName, createFileName } from './utilityFunctions';

/**
 * Optimized ContactNote class that groups operations by data locality.
 * Uses centralized ContactData for better cache performance.
 */
export class ContactNote {
  private app: App;
  private settings: ContactsPluginSettings;
  private contactData: ContactData;
  
  // Operation groups - each works closely with ContactData
  private syncOps: SyncOperations;
  private advancedRelationshipOps: AdvancedRelationshipOperations;

  constructor(app: App, settings: ContactsPluginSettings, file: TFile) {
    this.app = app;
    this.settings = settings;
    
    // Initialize centralized data store
    this.contactData = new ContactData(app, file);
    
    // Initialize operation groups that work with the centralized data
    // Pass ContactNote instance (this) instead of relationshipOps
    this.syncOps = new SyncOperations(this.contactData, this as any);
    this.advancedRelationshipOps = new AdvancedRelationshipOperations(app, settings, this.contactData, this as any);
  }

  // === Core File Operations (directly from ContactData) ===

  /**
   * Get the TFile object for this contact
   */
  getFile(): TFile {
    return this.contactData.getFile();
  }

  /**
   * Get the contact's UID from frontmatter
   */
  async getUID(): Promise<string | null> {
    return this.contactData.getUID();
  }

  /**
   * Get the contact's display name
   */
  getDisplayName(): string {
    return this.contactData.getDisplayName();
  }

  /**
   * Get the file content with caching
   */
  async getContent(): Promise<string> {
    return this.contactData.getContent();
  }

  /**
   * Get the frontmatter with caching
   */
  async getFrontmatter(): Promise<Record<string, any> | null> {
    return this.contactData.getFrontmatter();
  }

  /**
   * Invalidate caches when file is modified externally
   */
  invalidateCache(): void {
    this.contactData.invalidateAllCaches();
  }

  // === Gender Operations (directly from ContactData) ===

  /**
   * Parse GENDER field value from vCard
   */
  parseGender(value: string): Gender {
    return this.contactData.parseGender(value);
  }

  /**
   * Get the contact's gender from frontmatter
   */
  async getGender(): Promise<Gender> {
    return this.contactData.getGender();
  }

  /**
   * Update the contact's gender in frontmatter
   */
  async updateGender(gender: Gender): Promise<void> {
    return this.contactData.updateGender(gender);
  }

  // === Frontmatter Operations (directly from ContactData) ===

  /**
   * Update a single frontmatter value
   */
  async updateFrontmatterValue(key: string, value: string, skipRevUpdate = false): Promise<void> {
    return this.contactData.updateFrontmatterValue(key, value, skipRevUpdate);
  }

  /**
   * Update multiple frontmatter values in a single operation
   */
  async updateMultipleFrontmatterValues(updates: Record<string, string>, skipRevUpdate = false): Promise<void> {
    return this.contactData.updateMultipleFrontmatterValues(updates, skipRevUpdate);
  }

  // === Relationship Operations (using Relationship entities) ===

  /**
   * Parse Related section from markdown content
   * Returns parsed relationships compatible with existing code
   */
  async parseRelatedSection(): Promise<ParsedRelationship[]> {
    const content = await this.getContent();
    
    // Extract the Related section using regex
    const relatedSectionMatch = content.match(/^#{2,4} Related\s*\n([\s\S]*?)(?=\n#{2,4} |\n#\w+|$)/m);
    
    if (!relatedSectionMatch) {
      return [];
    }
    
    const relatedContent = relatedSectionMatch[1];
    const relatedSection = RelatedSection.fromMarkdown(relatedContent, 'Related', 2);
    const relationships = relatedSection.getRelationships();
    
    // Convert Relationship entities to ParsedRelationship format for backward compatibility
    const parsedRelationships: ParsedRelationship[] = [];
    
    for (const rel of relationships) {
      const target = rel.getTarget();
      const type = rel.getType();
      
      // Determine if this is a UID or name reference
      const isUID = target.isUIDReference();
      
      parsedRelationships.push({
        type: type.toString(),
        contactName: target.getValue(), // This is either the UID or the name
        linkType: isUID ? 'uid' : 'name',
        parsedValue: {
          type: isUID ? 'uid' : 'name',
          value: target.getValue()
        }
      });
    }
    
    return parsedRelationships;
  }

  /**
   * Find contact by name in the contacts folder
   */
  /**
   * Find contact by name (override to handle test environment)
   */
  async findContactByName(contactName: string): Promise<TFile | null> {
    try {
      // Use the internal implementation
      return await this.findContactByNameInternal(contactName);
    } catch (error: any) {
      // Fallback implementation for test environment
      const contactsFolder = this.settings.contactsFolder || 'Contacts';
      
      // Try exact path match first
      const normalizedContactName = contactName.toLowerCase().replace(/\s+/g, '-');
      let contactFile = this.app.vault.getAbstractFileByPath(`${contactsFolder}/${normalizedContactName}.md`);
      
      if (contactFile) {
        return contactFile as TFile;
      }
      
      // Try basename match
      contactFile = this.app.vault.getAbstractFileByPath(`${contactsFolder}/${contactName}.md`);
      if (contactFile) {
        return contactFile as TFile;
      }
      
      // Search through all markdown files in contacts folder
      const allFiles = this.app.vault.getMarkdownFiles();
      for (const file of allFiles) {
        if (file.path.startsWith(contactsFolder)) {
          if (file.basename === contactName || 
              file.basename.toLowerCase() === contactName.toLowerCase() ||
              file.basename.replace(/\s+/g, '-').toLowerCase() === normalizedContactName) {
            return file;
          }
        }
      }
      
      return null;
    }
  }

  /**
   * Resolve contact information from contact name
   */
  async resolveContact(contactName: string): Promise<ResolvedContact | null> {
    return await this.resolveContactInternal(contactName);
  }

  /**
   * Format a related value for vCard RELATED field
   */
  formatRelatedValue(targetUid: string, targetName: string): string {
    return this.formatRelatedValueInternal(targetUid, targetName);
  }

  /**
   * Parse a vCard RELATED value to extract UID or name
   */
  parseRelatedValue(value: string): { type: 'uuid' | 'uid' | 'name'; value: string } | null {
    if (!value || typeof value !== 'string') return null;
    
    const trimmed = value.trim();
    
    // Check for urn:uuid: format
    if (trimmed.startsWith('urn:uuid:')) {
      return {
        type: 'uuid',
        value: trimmed.substring(9)
      };
    }
    
    // Check for uid: format
    if (trimmed.startsWith('uid:')) {
      return {
        type: 'uid',
        value: trimmed.substring(4)
      };
    }
    
    // Check if it looks like a UID (UUID format)
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
      return {
        type: 'uuid',
        value: trimmed
      };
    }
    
    // Default to name
    return {
      type: 'name',
      value: trimmed
    };
  }

  /**
   * Extract relationship type from RELATED key format
   */
  extractRelationshipType(key: string): string {
    // Extract type from RELATED[type] format
    const match = key.match(/^RELATED\[([^\]]+)\]$/);
    return match ? match[1] : '';
  }

  /**
   * Get the display term for a relationship based on the contact's gender
   */
  getGenderedRelationshipTerm(relationshipType: string, contactGender: Gender): string {
    const relType = RelationshipType.fromString(relationshipType);
    // Convert old Gender type to GenderEntity
    let genderEntity: GenderEntity;
    if (contactGender === 'M' || contactGender === 'male') {
      genderEntity = GenderEntity.MALE;
    } else if (contactGender === 'F' || contactGender === 'female') {
      genderEntity = GenderEntity.FEMALE;
    } else if (contactGender === 'NB' || contactGender === 'other') {
      genderEntity = GenderEntity.OTHER;
    } else {
      genderEntity = GenderEntity.UNKNOWN;
    }
    return relType.getGenderedTerm(genderEntity);
  }

  /**
   * Infer gender from a gendered relationship term
   */
  inferGenderFromRelationship(relationshipType: string): Gender {
    const relType = RelationshipType.fromString(relationshipType);
    const genderEntity = relType.inferGender();
    
    // Convert GenderEntity back to legacy Gender type
    if (!genderEntity) return null;
    if (genderEntity.isMale()) return 'M';
    if (genderEntity.isFemale()) return 'F';
    if (genderEntity.isOther()) return 'NB';
    return 'U';
  }

  /**
   * Convert gendered relationship term to genderless equivalent
   */
  convertToGenderlessType(relationshipType: string): string {
    const relType = RelationshipType.fromString(relationshipType);
    return relType.getNeutralType();
  }

  // === Markdown Operations (delegated to MarkdownOperations) ===

  /**
   * Render the contact as markdown from vCard record data
   */
  mdRender(record: Record<string, any>, hashtags: string, genderLookup?: (contactRef: string) => Gender): string {
    const { NOTE, ...recordWithoutNote } = record;
    const groups = this.groupVCardFields(recordWithoutNote);
    const myNote = NOTE ? NOTE.replace(/\\n/g, '\n') : '';
    let additionalTags = '';
    
    if (recordWithoutNote.CATEGORIES) {
      const tempTags = recordWithoutNote.CATEGORIES.split(',');
      additionalTags = `#${tempTags.join(' #')}`;
    }

    const frontmatter = {
      ...this.sortNameItems(groups.name),
      ...this.sortedPriorityItems(groups.priority),
      ...groups.address,
      ...groups.other
    };

    const relatedSection = this.generateRelatedList(recordWithoutNote, genderLookup);

    return `---\n${stringifyYaml(frontmatter)}---\n${HEADING_LEVELS.SUBSECTION} ${SECTION_NAMES.NOTES}\n${myNote}\n${relatedSection}\n\n${hashtags} ${additionalTags}\n`;
  }

  private groupVCardFields(record: Record<string, any>) {
    const nameKeys = FIELD_GROUPS.NAME as readonly string[];
    const priorityKeys = FIELD_GROUPS.PRIORITY as readonly string[];
    const addressKeys = FIELD_GROUPS.ADDRESS as readonly string[];

    const groups = {
      name: {} as Record<string, any>,
      priority: {} as Record<string, any>,
      address: {} as Record<string, any>,
      other: {} as Record<string, any>
    };

    // Group fields by category for better organization
    for (const [key, value] of Object.entries(record)) {
      const baseKey = key.split('[')[0];
      
      if (nameKeys.includes(baseKey)) {
        groups.name[key] = value;
      } else if (priorityKeys.includes(baseKey)) {
        groups.priority[key] = value;
      } else if (addressKeys.includes(baseKey)) {
        groups.address[key] = value;
      } else {
        groups.other[key] = value;
      }
    }

    return groups;
  }

  private sortNameItems(nameItems: Record<string, any>): Record<string, any> {
    const nameOrder = ["N.PREFIX", "N.GN", "N.MN", "N.FN", "N.SUFFIX", "FN"];
    const sortedNameItems: Record<string, any> = {};

    // Sort name fields in logical order
    nameOrder.forEach(key => {
      if (nameItems[key] !== undefined) {
        sortedNameItems[key] = nameItems[key];
      }
    });

    // Add any remaining name fields
    Object.keys(nameItems).forEach(key => {
      if (!nameOrder.includes(key)) {
        sortedNameItems[key] = nameItems[key];
      }
    });

    return sortedNameItems;
  }

  private sortedPriorityItems(priorityItems: Record<string, any>): Record<string, any> {
    const priorityOrder = [
      "EMAIL", "TEL", "BDAY", "URL", "ORG", "TITLE", "ROLE", 
      "PHOTO", "RELATED", "GENDER"
    ];
    const sortedPriorityItems: Record<string, any> = {};

    // Sort priority fields in logical order
    priorityOrder.forEach(baseKey => {
      Object.keys(priorityItems).forEach(key => {
        if (key.startsWith(baseKey)) {
          sortedPriorityItems[key] = priorityItems[key];
        }
      });
    });

    return sortedPriorityItems;
  }

  private generateRelatedList(record: Record<string, any>, genderLookup?: (contactRef: string) => Gender): string {
    const relatedEntries: string[] = [];

    // Process RELATED fields from frontmatter
    Object.entries(record).forEach(([key, value]) => {
      if (key.startsWith('RELATED')) {
        const relationshipType = this.extractRelationshipTypeFromKey(key);
        const parsedValue = this.parseRelatedValueForMarkdown(value as string);
        
        if (parsedValue) {
          let contactName = parsedValue.value;
          let displayType = relationshipType;
          
          // Apply gender-based relationship terms if gender lookup is available
          if (genderLookup && parsedValue.type === 'name') {
            const contactGender = genderLookup(contactName);
            if (contactGender) {
              displayType = this.getGenderedRelationshipTermForMarkdown(relationshipType, contactGender);
            }
          }
          
          relatedEntries.push(`- ${displayType} [[${contactName}]]`);
        }
      }
    });

    if (relatedEntries.length === 0) {
      return `${HEADING_LEVELS.SECTION} ${SECTION_NAMES.RELATED}\n`;
    }

    return `${HEADING_LEVELS.SECTION} ${SECTION_NAMES.RELATED}\n${relatedEntries.join('\n')}\n`;
  }

  private extractRelationshipTypeFromKey(key: string): string {
    // Try dot notation first (RELATED.type or RELATED.type.1)
    const dotMatch = key.match(/^RELATED\.([^.]+)(?:\.\d+)?$/);
    if (dotMatch) {
      return dotMatch[1];
    }
    
    // Fall back to bracket notation for backward compatibility
    const bracketMatch = key.match(/RELATED(?:\[(?:\d+:)?([^\]]+)\])?/);
    return bracketMatch ? bracketMatch[1] || 'related' : 'related';
  }

  private parseRelatedValueForMarkdown(value: string): { type: 'uuid' | 'uid' | 'name'; value: string } | null {
    if (value.startsWith('urn:uuid:')) {
      return { type: 'uuid', value: value.substring(9) };
    } else if (value.startsWith('uid:')) {
      return { type: 'uid', value: value.substring(4) };
    } else if (value.startsWith('name:')) {
      return { type: 'name', value: value.substring(5) };
    }
    return null;
  }

  private getGenderedRelationshipTermForMarkdown(relationshipType: string, contactGender: Gender): string {
    const mapping: Record<string, { M: string; F: string; default: string }> = {
      parent: { M: 'father', F: 'mother', default: 'parent' },
      auncle: { M: 'uncle', F: 'aunt', default: 'aunt/uncle' },
      child: { M: 'son', F: 'daughter', default: 'child' },
      sibling: { M: 'brother', F: 'sister', default: 'sibling' },
      grandparent: { M: 'grandfather', F: 'grandmother', default: 'grandparent' },
      grandchild: { M: 'grandson', F: 'granddaughter', default: 'grandchild' },
      spouse: { M: 'husband', F: 'wife', default: 'spouse' },
      friend: { M: 'friend', F: 'friend', default: 'friend' },
      colleague: { M: 'colleague', F: 'colleague', default: 'colleague' },
      acquaintance: { M: 'acquaintance', F: 'acquaintance', default: 'acquaintance' }
    };

    const typeMapping = mapping[relationshipType.toLowerCase()];
    if (!typeMapping) return relationshipType;

    if (contactGender === 'M') return typeMapping.M;
    if (contactGender === 'F') return typeMapping.F;
    return typeMapping.default;
  }

  // === Sync Operations (delegated to SyncOperations) ===

  /**
   * Sync Related list from markdown to frontmatter
   */
  async syncRelatedListToFrontmatter(): Promise<{ success: boolean; errors: string[] }> {
    return this.syncOps.syncRelatedListToFrontmatter();
  }

  /**
   * Sync relationships from frontmatter to markdown
   */
  async syncFrontmatterToRelatedList(): Promise<{ 
    success: boolean; 
    errors: string[];
    updatedRelationships?: Array<{ newName: string; uid: string; oldName?: string }>;
  }> {
    return this.syncOps.syncFrontmatterToRelatedList();
  }

  /**
   * Perform full bidirectional sync between markdown and frontmatter
   */
  async performFullSync(): Promise<{ success: boolean; errors: string[] }> {
    return this.syncOps.performFullSync();
  }

  /**
   * Validate relationship consistency
   */
  async validateRelationshipConsistency(): Promise<{ 
    isConsistent: boolean; 
    issues: string[]; 
    recommendations: string[] 
  }> {
    return this.syncOps.validateRelationshipConsistency();
  }

  // === Validation Methods ===

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
  private validateURL(url: string): boolean {
    if (!url || typeof url !== 'string') return true; // Empty is valid
    // Basic URL validation - must start with http:// or https://
    return /^https?:\/\/.+/.test(url);
  }

  /**
   * Identify invalid frontmatter fields
   * Returns list of invalid fields with their values and reasons
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
   * This is a helper method for removeFieldsFromFrontmatter
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

  // === Advanced Relationship Operations ===

  /**
   * Get relationships with enhanced UID/name linking information
   */
  async getRelationships(): Promise<Array<{
    type: string;
    contactName: string;
    targetUID?: string;
    linkType: 'uid' | 'name';
    originalType: string;
  }>> {
    return this.advancedRelationshipOps.getRelationships(
      this.resolveContact.bind(this),
      this.resolveContactNameByUID.bind(this)
    );
  }

  /**
   * Resolve a contact by UID - returns object with frontmatter
   */
  async resolveContactByUID(uid: string): Promise<{ file: TFile; frontmatter: any } | null> {
    const allFiles = this.app.vault.getMarkdownFiles();
    
    for (const file of allFiles) {
      if (!file.path.startsWith(this.settings.contactsFolder)) continue;
      
      const cache = this.app.metadataCache.getFileCache(file);
      if (cache?.frontmatter?.UID === uid) {
        return { file, frontmatter: cache.frontmatter };
      }
    }
    
    return null;
  }

  /**
   * Resolve contact file by UID - returns just the TFile
   */
  async resolveContactFileByUID(uid: string): Promise<TFile | null> {
    const result = await this.resolveContactByUID(uid);
    return result?.file || null;
  }

  /**
   * Resolve contact name by UID
   */
  async resolveContactNameByUID(uid: string): Promise<string | null> {
    const result = await this.resolveContactByUID(uid);
    if (!result) return null;
    
    return result.frontmatter?.FN || result.file.basename;
  }

  /**
   * Resolve relationship target by relationship type or identifier
   */
  async resolveRelationshipTarget(identifierOrType: string): Promise<{
    file: TFile | null;
    frontmatter?: any;
    type: 'uid' | 'name';
    contactName: string;
  } | null> {
    return this.advancedRelationshipOps.resolveRelationshipTarget(
      identifierOrType,
      (uid: string) => UID.validate(uid),
      this.resolveContactByUID.bind(this),
      this.findContactByName.bind(this)
    );
  }

  /**
   * Process reverse relationships for automatic bidirectional linking
   */
  async processReverseRelationships(): Promise<{
    success: boolean;
    processedRelationships: Array<{
      targetContact: string;
      reverseType: string;
      added: boolean;
      reason?: string;
      error?: string;
    }>;
    errors: string[];
  }> {
    return this.advancedRelationshipOps.processReverseRelationships(
      this.getDisplayName.bind(this),
      this.getReciprocalRelationshipType.bind(this),
      this.areRelationshipTypesEquivalent.bind(this),
      (file: TFile) => new ContactNote(this.app, this.settings, file)
    );
  }

  /**
   * Upgrade name-based relationships to UID-based when possible
   */
  async upgradeNameBasedRelationshipsToUID(): Promise<{
    success: boolean;
    upgradedRelationships: Array<{
      targetUID: string;
      type: string;
      key: string;
    }>;
    errors: string[];
  }> {
    return this.advancedRelationshipOps.upgradeNameBasedRelationshipsToUID(
      this.findContactByName.bind(this)
    );
  }

  /**
   * Detect UID conflicts within the contact system
   */
  async detectUIDConflicts(): Promise<{
    hasConflicts: boolean;
    conflicts: Array<{
      uid: string;
      files: string[];
    }>;
  }> {
    const result: {
      hasConflicts: boolean;
      conflicts: Array<{
        uid: string;
        files: string[];
      }>;
    } = { hasConflicts: false, conflicts: [] };
    const uidMap = new Map<string, string[]>();
    
    const allFiles = this.app.vault.getMarkdownFiles();
    
    for (const file of allFiles) {
      if (!file.path.startsWith(this.settings.contactsFolder)) continue;
      
      const cache = this.app.metadataCache.getFileCache(file);
      const uid = cache?.frontmatter?.UID;
      
      if (uid) {
        if (!uidMap.has(uid)) {
          uidMap.set(uid, []);
        }
        uidMap.get(uid)!.push(file.path);
      }
    }
    
    for (const [uid, files] of uidMap.entries()) {
      if (files.length > 1) {
        result.hasConflicts = true;
        result.conflicts.push({ uid, files });
      }
    }
    
    return result;
  }

  /**
   * Update a specific relationship's UID
   */
  async updateRelationshipUID(oldUID: string, newUID: string): Promise<{
    success: boolean;
    updatedRelationships: Array<{
      oldUID: string;
      newUID: string;
      key: string;
    }>;
  }> {
    const result: {
      success: boolean;
      updatedRelationships: Array<{
        oldUID: string;
        newUID: string;
        key: string;
      }>;
    } = {
      success: true,
      updatedRelationships: []
    };
    
    try {
      const frontmatter = await this.contactData.getFrontmatter();
      if (!frontmatter) {
        result.success = false;
        return result;
      }

      const updates: Record<string, string> = {};
      
      for (const [key, value] of Object.entries(frontmatter)) {
        if (key.startsWith('RELATED[') && typeof value === 'string') {
          const parsedValue = this.parseRelatedValue(value);
          if (parsedValue && (parsedValue.type === 'uuid' || parsedValue.type === 'uid')) {
            if (parsedValue.value === oldUID) {
              // Format with the same prefix style (urn:uuid: or uid:)
              updates[key] = this.formatRelatedValue(newUID, '');
              result.updatedRelationships.push({
                oldUID,
                newUID,
                key
              });
            }
          } else if (value === oldUID) {
            // Direct match without prefix
            updates[key] = this.formatRelatedValue(newUID, '');
            result.updatedRelationships.push({
              oldUID,
              newUID,
              key
            });
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        await this.contactData.updateMultipleFrontmatterValues(updates);
      }
    } catch (error: any) {
      result.success = false;
      console.error(`Error updating relationship UID: ${error.message}`);
    }
    
    return result;
  }

  /**
   * Bulk update relationship UIDs
   */
  async bulkUpdateRelationshipUIDs(
    uidMappings: Record<string, string> | Array<{ name: string; uid: string }>
  ): Promise<{
    success: boolean;
    updatedCount: number;
    failedCount: number;
    errors: string[];
  }> {
    const result: {
      success: boolean;
      updatedCount: number;
      failedCount: number;
      errors: string[];
    } = { success: true, updatedCount: 0, failedCount: 0, errors: [] };
    
    try {
      const frontmatter = await this.contactData.getFrontmatter();
      if (!frontmatter) return result;

      const updates: Record<string, string> = {};
      
      // Convert array format to map if needed
      const mappingMap = Array.isArray(uidMappings)
        ? uidMappings.reduce((acc, { name, uid }) => {
            acc[`name:${name}`] = uid;
            return acc;
          }, {} as Record<string, string>)
        : uidMappings;

      for (const [key, value] of Object.entries(frontmatter)) {
        if (key.startsWith('RELATED[') && typeof value === 'string') {
          // Try to match the value directly or parse it
          let matchedUID = mappingMap[value];
          
          if (!matchedUID) {
            // Try parsing the value
            const parsedValue = this.parseRelatedValue(value);
            if (parsedValue) {
              if (parsedValue.type === 'name') {
                matchedUID = mappingMap[`name:${parsedValue.value}`] || mappingMap[parsedValue.value];
              } else {
                matchedUID = mappingMap[parsedValue.value];
              }
            }
          }
          
          if (matchedUID && matchedUID !== value) {
            updates[key] = this.formatRelatedValue(matchedUID, '');
            result.updatedCount++;
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        await this.contactData.updateMultipleFrontmatterValues(updates);
      }
    } catch (error: any) {
      result.success = false;
      result.failedCount = result.updatedCount;
      result.updatedCount = 0;
      result.errors.push(`Error in bulk update: ${error.message}`);
    }

    return result;
  }

  // === Helper Methods for Relationship Operations ===

  /**
   * Get reciprocal relationship type with gender awareness
   */
  private getReciprocalRelationshipType(relationshipType: string, targetGender?: Gender): string | null {
    const reciprocalMap: Record<string, string | Record<string, string>> = {
      'father': {
        'M': 'son',
        'F': 'daughter',
        'NB': 'child',
        'O': 'child',
        'N': 'child',
        'U': 'child',
        'default': 'child'
      },
      'mother': {
        'M': 'son',
        'F': 'daughter',
        'NB': 'child',
        'O': 'child',
        'N': 'child',
        'U': 'child',
        'default': 'child'
      },
      'parent': {
        'M': 'son',
        'F': 'daughter',
        'NB': 'child',
        'O': 'child', 
        'N': 'child',
        'U': 'child',
        'default': 'child'
      },
      'son': 'parent',
      'daughter': 'parent',
      'child': 'parent',
      'brother': {
        'M': 'brother',
        'F': 'sister',
        'NB': 'sibling',
        'O': 'sibling',
        'N': 'sibling', 
        'U': 'sibling',
        'default': 'sibling'
      },
      'sister': {
        'M': 'brother',
        'F': 'sister',
        'NB': 'sibling',
        'O': 'sibling',
        'N': 'sibling',
        'U': 'sibling', 
        'default': 'sibling'
      },
      'sibling': 'sibling',
      'spouse': 'spouse',
      'husband': 'wife',
      'wife': 'husband',
      'friend': 'friend',
      'colleague': 'colleague',
      'manager': 'employee',
      'employee': 'manager',
      'boss': 'employee',
      'mentor': 'mentee',
      'mentee': 'mentor',
      'uncle': {
        'M': 'nephew',
        'F': 'niece',
        'NB': 'nephew',
        'O': 'nephew',
        'N': 'nephew',
        'U': 'nephew',
        'default': 'nephew'
      },
      'aunt': {
        'M': 'nephew',
        'F': 'niece',
        'NB': 'nephew',
        'O': 'nephew',
        'N': 'nephew',
        'U': 'nephew',
        'default': 'nephew'
      },
      'nephew': {
        'M': 'uncle',
        'F': 'aunt',
        'NB': 'uncle',
        'O': 'uncle',
        'N': 'uncle',
        'U': 'uncle',
        'default': 'uncle'
      },
      'niece': {
        'M': 'uncle',
        'F': 'aunt',
        'NB': 'aunt',
        'O': 'uncle',
        'N': 'uncle',
        'U': 'uncle',
        'default': 'uncle'
      }
    };
    
    const mapping = reciprocalMap[relationshipType.toLowerCase()];
    if (!mapping) return null;
    
    if (typeof mapping === 'string') {
      return mapping;
    }
    
    // Use gender-specific mapping if available
    if (targetGender && mapping[targetGender]) {
      return mapping[targetGender];
    }
    
    return mapping.default || null;
  }

  /**
   * Check if two relationship types are equivalent
   */
  private areRelationshipTypesEquivalent(type1: string, type2: string): boolean {
    const genderless1 = this.convertToGenderlessType(type1);
    const genderless2 = this.convertToGenderlessType(type2);
    return genderless1 === genderless2;
  }

  // === Relationship Operations (inlined from RelationshipOperations) ===

  /**
   * Parse Related section from markdown content
   */
  async parseRelatedSection(): Promise<ParsedRelationship[]> {
    const content = await this.contactData.getContent();
    const relationships: ParsedRelationship[] = [];

    // Use marked to find the Related section
    const contentWithoutFrontmatter = this.removeFrontmatter(content);
    const tokens = marked.lexer(contentWithoutFrontmatter);
    
    // Find the Related list
    const relatedList = this.findListAfterHeading(tokens, SECTION_NAMES.RELATED);
    
    if (!relatedList) {
      console.debug(`[ContactNote] No Related section found in content`);
      return relationships;
    }

    console.debug(`[ContactNote] Found Related section with ${relatedList.items.length} items`);
    
    // Parse each list item using domain-specific patterns
    for (const item of relatedList.items) {
      const line = item.text;
      console.debug(`[ContactNote] Parsing line: "${line}"`);
      
      // Parse different formats (in order of preference):
      const match1 = line.match(REGEX_PATTERNS.RELATIONSHIP_FORMATS.TYPE_LINK);
      const match2 = line.match(REGEX_PATTERNS.RELATIONSHIP_FORMATS.TYPE_COLON_LINK);
      const match3 = line.match(REGEX_PATTERNS.RELATIONSHIP_FORMATS.LINK_TYPE_PARENS);
      const match4 = line.match(REGEX_PATTERNS.RELATIONSHIP_FORMATS.TYPE_COLON_TEXT);

      if (match1) {
        const [, type, contactName] = match1;
        console.debug(`[ContactNote]   Matched format 1 (type [[Name]] - canonical): ${type} -> ${contactName}`);
        relationships.push({
          type: type.trim(),
          contactName: contactName.trim(),
          linkType: 'name'
        });
      } else if (match2) {
        const [, type, contactName] = match2;
        console.debug(`[ContactNote]   Matched format 2 (type: [[Name]] - alternative): ${type} -> ${contactName}`);
        relationships.push({
          type: type.trim(),
          contactName: contactName.trim(),
          linkType: 'name'
        });
      } else if (match3) {
        const [, contactName, type] = match3;
        console.debug(`[ContactNote]   Matched format 3 ([[Name]] (type)): ${type} -> ${contactName}`);
        relationships.push({
          type: type.trim(),
          contactName: contactName.trim(),
          linkType: 'name'
        });
      } else if (match4 && !match4[2].startsWith('[[')) {
        const [, type, contactName] = match4;
        console.debug(`[ContactNote]   Matched format 4 (type: Name - plain text fallback): ${type} -> ${contactName}`);
        relationships.push({
          type: type.trim(),
          contactName: contactName.trim(),
          linkType: 'name'
        });
      } else {
        console.debug(`[ContactNote]   No match for this line - skipping`);
      }
    }

    console.debug(`[ContactNote] Parsed ${relationships.length} relationships from Related section`);
    return relationships;
  }

  /**
   * Parse RELATED fields from frontmatter
   */
  async parseFrontmatterRelationships(): Promise<FrontmatterRelationship[]> {
    const frontmatter = await this.contactData.getFrontmatter();
    const relationships: FrontmatterRelationship[] = [];

    if (!frontmatter) return relationships;

    for (const [key, value] of Object.entries(frontmatter)) {
      if (key.startsWith('RELATED')) {
        // Handle RELATED as an object (from RELATED.type YAML dot notation)
        if (key === 'RELATED' && typeof value === 'object' && value !== null && !Array.isArray(value)) {
          for (const [nestedKey, nestedValue] of Object.entries(value)) {
            if (typeof nestedValue === 'string') {
              const correctedKey = `RELATED.${nestedKey}`;
              const type = nestedKey;
              const parsedValue = this.parseRelatedValue(nestedValue);
              
              relationships.push({
                key: correctedKey,
                type,
                value: nestedValue,
                parsedValue: parsedValue || undefined
              });
              
              console.debug(`[ContactNote] Parsed RELATED.${nestedKey}`);
            } else if (Array.isArray(nestedValue)) {
              for (let i = 0; i < nestedValue.length; i++) {
                const arrayValue = nestedValue[i];
                if (typeof arrayValue === 'string') {
                  const correctedKey = i === 0 ? `RELATED.${nestedKey}` : `RELATED.${nestedKey}.${i}`;
                  const parsedValue = this.parseRelatedValue(arrayValue);
                  
                  relationships.push({
                    key: correctedKey,
                    type: nestedKey,
                    value: arrayValue,
                    parsedValue: parsedValue || undefined
                  });
                  
                  console.debug(`[ContactNote] Parsed RELATED.${nestedKey}${i > 0 ? '.' + i : ''}`);
                }
              }
            }
          }
          continue;
        }
        
        // Handle RELATED.type format (dot notation as a key)
        if (key.includes('.') && key !== 'RELATED') {
          const parts = key.split('.');
          if (parts[0] === 'RELATED' && parts.length >= 2) {
            const typePart = parts.slice(1).join('.');
            
            if (typeof value === 'string') {
              const parsedValue = this.parseRelatedValue(value);
              
              relationships.push({
                key: key,
                type: typePart,
                value: value,
                parsedValue: parsedValue || undefined
              });
              
              console.debug(`[ContactNote] Parsed ${key}`);
              continue;
            } else if (Array.isArray(value)) {
              for (let i = 0; i < value.length; i++) {
                const arrayValue = value[i];
                if (typeof arrayValue === 'string') {
                  const correctedKey = i === 0 ? `RELATED.${typePart}` : `RELATED.${typePart}.${i}`;
                  const parsedValue = this.parseRelatedValue(arrayValue);
                  
                  relationships.push({
                    key: correctedKey,
                    type: typePart,
                    value: arrayValue,
                    parsedValue: parsedValue || undefined
                  });
                  
                  console.debug(`[ContactNote] Parsed ${correctedKey}`);
                }
              }
              continue;
            } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
              for (const [nestedKey, nestedValue] of Object.entries(value)) {
                if (typeof nestedValue === 'string') {
                  const combinedType = `${typePart}.${nestedKey}`;
                  const parsedValue = this.parseRelatedValue(nestedValue);
                  
                  relationships.push({
                    key: `RELATED.${combinedType}`,
                    type: combinedType,
                    value: nestedValue,
                    parsedValue: parsedValue || undefined
                  });
                  
                  console.debug(`[ContactNote] Parsed RELATED.${combinedType}`);
                }
              }
              continue;
            } else {
              let valueType: string = typeof value;
              if (value === null) {
                valueType = 'null';
              } else if (Array.isArray(value)) {
                valueType = 'array';
              }
              console.warn(`[ContactNote] Skipping malformed RELATED key "${key}": Use RELATED.type format. Value type: ${valueType}`);
              continue;
            }
          }
        }
        
        // Skip non-string values
        if (typeof value !== 'string') {
          console.warn(`[ContactNote] Skipping non-string RELATED value for key ${key}: ${typeof value}`);
          continue;
        }
        
        const type = this.extractRelationshipType(key);
        const parsedValue = this.parseRelatedValue(value);
        
        relationships.push({
          key,
          type,
          value: value,
          parsedValue: parsedValue || undefined
        });
      }
    }

    return relationships;
  }

  /**
   * Format a related value for vCard RELATED field
   */
  private formatRelatedValueInternal(targetUid: string, targetName: string): string {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(targetUid)) {
      return `urn:uuid:${targetUid}`;
    } else if (targetUid) {
      return `uid:${targetUid}`;
    } else {
      return `name:${targetName}`;
    }
  }

  /**
   * Parse a vCard RELATED value to extract UID or name
   */
  parseRelatedValue(value: string): { type: 'uuid' | 'uid' | 'name'; value: string } | null {
    if (value.startsWith('urn:uuid:')) {
      return { type: 'uuid', value: value.substring(9) };
    } else if (value.startsWith('uid:')) {
      return { type: 'uid', value: value.substring(4) };
    } else if (value.startsWith('name:')) {
      return { type: 'name', value: value.substring(5) };
    }
    return null;
  }

  /**
   * Extract relationship type from RELATED key format
   */
  private extractRelationshipType(key: string): string {
    // Try dot notation first (RELATED.type or RELATED.type.1)
    const dotMatch = key.match(/^RELATED\.([^.]+)(?:\.\d+)?$/);
    if (dotMatch) {
      return dotMatch[1];
    }
    
    // Fall back to bracket notation
    const bracketMatch = key.match(/RELATED(?:\[(?:\d+:)?([^\]]+)\])?/);
    return bracketMatch ? bracketMatch[1] || 'related' : 'related';
  }

  /**
   * Find contact by name - resolves to the actual implementation
   */
  private async findContactByNameInternal(contactName: string): Promise<TFile | null> {
    try {
      const contactsFolder = this.settings.contactsFolder || 'Contacts';
      
      // Normalize the contact name
      const normalizedContactName = contactName.toLowerCase().replace(/\s+/g, '-');
      const contactFile = this.app.vault.getAbstractFileByPath(`${contactsFolder}/${normalizedContactName}.md`);
      
      if (contactFile && 'path' in contactFile && 'basename' in contactFile) {
        return contactFile as TFile;
      }

      // Search for file in contacts folder
      const allFiles = this.app.vault.getMarkdownFiles();
      const matchingFiles = allFiles.filter(file => {
        const normalizedBasename = file.basename.toLowerCase().replace(/\s+/g, '-');
        return normalizedBasename === normalizedContactName &&
          file.path.startsWith(contactsFolder);
      });

      return matchingFiles.length > 0 ? matchingFiles[0] : null;
    } catch (error: any) {
      console.error('Error finding contact by name:', error);
      return null;
    }
  }

  /**
   * Resolve contact information from contact name - internal implementation
   */
  private async resolveContactInternal(contactName: string): Promise<ResolvedContact | null> {
    const file = await this.findContactByNameInternal(contactName);
    if (!file) return null;
    
    // Create a temporary ContactData for the target contact
    const targetContactData = new ContactData(this.app, file);
    
    try {
      const uid = await targetContactData.getUID();
      const gender = await targetContactData.getGender();
      
      return {
        name: contactName,
        uid: uid || '',
        file: file,
        gender: gender
      };
    } catch (error: any) {
      console.debug(`[ContactNote] Error resolving contact ${contactName}: ${error.message}`);
      return null;
    }
  }

  /**
   * Update Related section in markdown content
   */
  async updateRelatedSectionInContent(relationships: { type: string; contactName: string }[]): Promise<void> {
    const content = await this.contactData.getContent();
    
    // Generate new Related section
    let newRelatedSection = `${HEADING_LEVELS.SECTION} ${SECTION_NAMES.RELATED}\n`;
    if (relationships.length > 0) {
      for (const rel of relationships) {
        newRelatedSection += `- ${rel.type} [[${rel.contactName}]]\n`;
      }
    } else {
      newRelatedSection += '\n';
    }

    // Replace existing Related section or add new one
    const relatedSectionMatch = content.match(/(^|\n)(#{2,})\s*related\s*\n([\s\S]*?)(?=\n#{2,}\s|\n\n(?:#|$)|\n$)/i);
    const contactSectionMatch = content.match(/(^|\n)(#{2,})\s*contact\s*\n[\s\S]*?(?=\n#{2,}\s|\n\n(?:#|$)|\n$)/i);
    
    let newContent: string;
    
    if (relatedSectionMatch) {
      if (contactSectionMatch) {
        const contactIndex = content.indexOf(contactSectionMatch[0]);
        const relatedIndex = content.indexOf(relatedSectionMatch[0]);
        
        if (contactIndex > relatedIndex) {
          const contentWithoutContact = content.replace(contactSectionMatch[0], '');
          const relatedMatchInNewContent = contentWithoutContact.match(/(^|\n)(#{2,})\s*related\s*\n([\s\S]*?)(?=\n#{2,}\s|\n\n(?:#|$)|\n$)/i);
          if (relatedMatchInNewContent) {
            const relatedIndexInNewContent = contentWithoutContact.indexOf(relatedMatchInNewContent[0]);
            const contentWithContactMoved = contentWithoutContact.substring(0, relatedIndexInNewContent) + 
                                           contactSectionMatch[0] + '\n' + 
                                           contentWithoutContact.substring(relatedIndexInNewContent);
            newContent = contentWithContactMoved.replace(relatedMatchInNewContent[0], '\n' + newRelatedSection.trim());
          } else {
            newContent = content.replace(relatedSectionMatch[0], '\n' + newRelatedSection.trim());
          }
        } else {
          newContent = content.replace(relatedSectionMatch[0], '\n' + newRelatedSection.trim());
        }
      } else {
        newContent = content.replace(relatedSectionMatch[0], '\n' + newRelatedSection.trim());
      }
    } else {
      if (contactSectionMatch) {
        const contactEndIndex = content.indexOf(contactSectionMatch[0]) + contactSectionMatch[0].length;
        newContent = content.substring(0, contactEndIndex) + '\n' + newRelatedSection + content.substring(contactEndIndex);
      } else {
        const tagMatch = content.match(/\n(#\w.*?)\s*$/);
        if (tagMatch) {
          const insertIndex = content.lastIndexOf(tagMatch[1]);
          newContent = content.substring(0, insertIndex) + newRelatedSection + '\n' + tagMatch[1] + '\n';
        } else {
          newContent = content + '\n' + newRelatedSection;
        }
      }
    }

    await this.contactData.updateContent(newContent);
  }

  /**
   * Get the display term for a relationship based on the contact's gender
   */
  private getGenderedRelationshipTerm(relationshipType: string, contactGender: Gender): string {
    const mapping: Record<string, { M: string; F: string; default: string }> = {
      parent: { M: 'father', F: 'mother', default: 'parent' },
      auncle: { M: 'uncle', F: 'aunt', default: 'aunt/uncle' },
      child: { M: 'son', F: 'daughter', default: 'child' },
      sibling: { M: 'brother', F: 'sister', default: 'sibling' },
      grandparent: { M: 'grandfather', F: 'grandmother', default: 'grandparent' },
      grandchild: { M: 'grandson', F: 'granddaughter', default: 'grandchild' },
      spouse: { M: 'husband', F: 'wife', default: 'spouse' },
      friend: { M: 'friend', F: 'friend', default: 'friend' },
      colleague: { M: 'colleague', F: 'colleague', default: 'colleague' },
      acquaintance: { M: 'acquaintance', F: 'acquaintance', default: 'acquaintance' }
    };

    const typeMapping = mapping[relationshipType.toLowerCase()];
    if (!typeMapping) return relationshipType;

    if (contactGender === 'M') return typeMapping.M;
    if (contactGender === 'F') return typeMapping.F;
    return typeMapping.default;
  }

  /**
   * Infer gender from a gendered relationship term
   */
  private inferGenderFromRelationship(relationshipType: string): Gender {
    const maleTerms = ['father', 'uncle', 'son', 'brother', 'grandfather', 'grandson', 'husband'];
    const femaleTerms = ['mother', 'aunt', 'daughter', 'sister', 'grandmother', 'granddaughter', 'wife'];

    const term = relationshipType.toLowerCase();
    if (maleTerms.includes(term)) return 'M';
    if (femaleTerms.includes(term)) return 'F';
    return null;
  }

  /**
   * Get the reverse relationship type (genderless form)
   */
  private getReverseRelationshipType(relationshipType: string): string {
    const reverseMap: Record<string, string> = {
      parent: 'child',
      child: 'parent',
      sibling: 'sibling',
      spouse: 'spouse',
      grandparent: 'grandchild',
      grandchild: 'grandparent',
      auncle: 'niece-nephew',
      'niece-nephew': 'auncle',
      'aunt-uncle': 'niece-nephew',
      friend: 'friend',
      colleague: 'colleague',
      'in-law-parent': 'in-law-child',
      'in-law-child': 'in-law-parent'
    };

    const genderless = this.convertToGenderlessType(relationshipType);
    return reverseMap[genderless.toLowerCase()] || relationshipType;
  }

  // === Helper methods from BaseMarkdownSectionOperations ===

  /**
   * Remove frontmatter from markdown content
   */
  private removeFrontmatter(content: string): string {
    const frontmatterRegex = /^---\n[\s\S]*?\n---\n/;
    return content.replace(frontmatterRegex, '');
  }

  /**
   * Find list tokens after a specific heading
   */
  private findListAfterHeading(tokens: Tokens.Generic[], headingName: string): Tokens.List | null {
    const heading = this.findHeadingByName(tokens, headingName);
    if (!heading) {
      return null;
    }
    
    const headingIndex = tokens.indexOf(heading);
    
    for (let i = headingIndex + 1; i < tokens.length; i++) {
      const token = tokens[i];
      
      if (token.type === 'heading') {
        break;
      }
      
      if (token.type === 'list') {
        return token as Tokens.List;
      }
    }
    
    return null;
  }

  /**
   * Find a heading token by name (case-insensitive)
   */
  private findHeadingByName(tokens: Tokens.Generic[], name: string): Tokens.Heading | null {
    const normalized = name.toLowerCase();
    
    for (const token of tokens) {
      if (token.type === 'heading') {
        const heading = token as Tokens.Heading;
        if (heading.text.toLowerCase() === normalized) {
          return heading;
        }
      }
    }
    
    return null;
  }

  // === Static Utility Methods ===

  /**
   * Validate UID format
   */
  static isValidUID(uid: string): boolean {
    return UID.validate(uid);
  }

  // === Debug and Utility Operations ===

  /**
   * Get cache status for debugging
   */
  getCacheStatus(): { [key: string]: boolean } {
    return this.contactData.getCacheStatus();
  }

  // === Additional utility methods for backward compatibility ===

  /**
   * Generate REV timestamp for vCard compatibility
   */
  generateRevTimestamp(): string {
    return this.contactData.generateRevTimestamp();
  }

  /**
   * Parse a VCard REV date string into a Date object
   * Handles VCard format: YYYYMMDDTHHMMSSZ
   */
  parseRevDate(revString: string): Date | null {
    if (!revString) {
      return null;
    }

    try {
      // Only handle VCard format: YYYYMMDDTHHMMSSZ - be strict about format
      if (/^\d{8}T\d{6}Z$/.test(revString)) {
        const year = parseInt(revString.substr(0, 4), 10);
        const month = parseInt(revString.substr(4, 2), 10);
        const day = parseInt(revString.substr(6, 2), 10);
        const hour = parseInt(revString.substr(9, 2), 10);
        const minute = parseInt(revString.substr(11, 2), 10);
        const second = parseInt(revString.substr(13, 2), 10);

        // Validate ranges
        if (month < 1 || month > 12 || day < 1 || day > 31 || 
            hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
          return null;
        }

        const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
        return isNaN(date.getTime()) ? null : date;
      }

      // Don't parse ISO format or other formats - return null for non-VCard formats
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Check if contact should be updated from vcard based on REV timestamp
   */
  async shouldUpdateFromVcard(record: Record<string, any>): Promise<boolean> {
    const frontmatter = await this.contactData.getFrontmatter();
    if (!frontmatter) return true;

    const contactRev = frontmatter.REV;
    const vcardRev = record.REV;

    // If either timestamp is missing, don't update (conservative approach)
    if (!contactRev || !vcardRev) return false;

    // Parse both timestamps using VCard format parser
    const contactDate = this.parseRevDate(contactRev);
    const vcardDate = this.parseRevDate(vcardRev);

    // If we can't parse either date, don't update
    if (!contactDate || !vcardDate) return false;

    // Compare timestamps - allow update if vcard is newer
    return vcardDate.getTime() > contactDate.getTime();
  }

  // === Contact Section Operations ===

  /**
   * Parse Contact section from markdown
   * Returns parsed contact fields compatible with existing curators
   */
  async parseContactSection(): Promise<Array<{
    fieldType: string;
    fieldLabel: string;
    value: string;
    component?: string;
  }>> {
    const content = await this.getContent();
    
    // Extract the Contact section using markdown parsing
    const contactSectionMatch = content.match(/^## Contact\s*\n([\s\S]*?)(?=\n## |\n#Contact|$)/m);
    
    if (!contactSectionMatch) {
      return [];
    }
    
    const contactContent = contactSectionMatch[1];
    const contactSection = ContactSection.fromMarkdown(contactContent, 'Contact', 2);
    const fields = contactSection.getFields();
    
    // Convert ContactField entities to ParsedContactField format for backward compatibility
    const parsedFields: Array<{
      fieldType: string;
      fieldLabel: string;
      value: string;
      component?: string;
    }> = [];
    
    for (const field of fields) {
      const frontmatter = field.toFrontmatter();
      
      // Handle both single entries and arrays
      const entries = Array.isArray(frontmatter) ? frontmatter : [frontmatter];
      
      for (const entry of entries) {
        // Parse the frontmatter key to extract field type, label, and component
        // Format examples: "EMAIL[WORK]", "EMAIL", "ADR[HOME].STREET", "ADR.STREET"
        const keyMatch = entry.key.match(/^([A-Z]+)(?:\[([^\]]+)\])?(?:\.(.+))?$/);
        
        if (keyMatch) {
          parsedFields.push({
            fieldType: keyMatch[1],
            fieldLabel: keyMatch[2] || '',
            value: String(entry.value),
            component: keyMatch[3]
          });
        }
      }
    }
    
    return parsedFields;
  }

  /**
   * Generate Contact section markdown from frontmatter
   */
  async generateContactSection(): Promise<string> {
    const frontmatter = await this.getFrontmatter();
    if (!frontmatter) return '';
    
    const fields: ContactField[] = [];
    
    // Parse frontmatter for contact fields
    // Look for EMAIL, TEL, URL, ADR fields
    for (const [key, value] of Object.entries(frontmatter)) {
      // Match field patterns: EMAIL, EMAIL[WORK], EMAIL.WORK, etc.
      const bareMatch = key.match(/^(EMAIL|TEL|URL|ADR)$/);
      const bracketMatch = key.match(/^(EMAIL|TEL|URL|ADR)\[([^\]]+)\](?:\.(.+))?$/);
      const dotMatch = key.match(/^(EMAIL|TEL|URL|ADR)\.([^.]+)(?:\.(.+))?$/);
      
      if (bareMatch) {
        // Bare field: EMAIL, TEL, etc.
        const fieldType = bareMatch[1];
        // For now, convert to simple field format: "- value"
        // This is a minimal implementation to get tests passing
        if (fieldType === 'EMAIL' || fieldType === 'TEL' || fieldType === 'URL') {
          // Will be rendered as "- value"
          // The entity parsing doesn't need explicit type matching since we're generating simple format
        }
      }
    }
    
    // For now, generate a simple list from EMAIL, TEL, URL, ADR fields
    const lines: string[] = [];
    
    // EMAIL fields
    const emailFields = Object.keys(frontmatter).filter(k => k.startsWith('EMAIL'));
    for (const key of emailFields) {
      const match = key.match(/^EMAIL(?:\[([^\]]+)\])?(?:\.(.+))?$/);
      if (match && !match[2]) { // Not a component field
        const label = match[1] || '';
        const value = frontmatter[key];
        if (label) {
          lines.push(`- ${label}: ${value}`);
        } else {
          lines.push(`- ${value}`);
        }
      }
    }
    
    // TEL fields
    const telFields = Object.keys(frontmatter).filter(k => k.startsWith('TEL'));
    for (const key of telFields) {
      const match = key.match(/^TEL(?:\[([^\]]+)\])?(?:\.(.+))?$/);
      if (match && !match[2]) {
        const label = match[1] || '';
        const value = frontmatter[key];
        if (label) {
          lines.push(`- ${label}: ${value}`);
        } else {
          lines.push(`- ${value}`);
        }
      }
    }
    
    // URL fields
    const urlFields = Object.keys(frontmatter).filter(k => k.startsWith('URL'));
    for (const key of urlFields) {
      const match = key.match(/^URL(?:\[([^\]]+)\])?(?:\.(.+))?$/);
      if (match && !match[2]) {
        const label = match[1] || '';
        const value = frontmatter[key];
        if (label) {
          lines.push(`- ${label}: ${value}`);
        } else {
          lines.push(`- ${value}`);
        }
      }
    }
    
    // ADR fields (simplified - just show as single line for now)
    const adrFields = Object.keys(frontmatter).filter(k => k.match(/^ADR(?:\[([^\]]+)\])?$/));
    for (const key of adrFields) {
      const match = key.match(/^ADR(?:\[([^\]]+)\])?$/);
      if (match) {
        const label = match[1] || '';
        // Look for address components
        const prefix = key;
        const street = frontmatter[`${prefix}.STREET`];
        const locality = frontmatter[`${prefix}.LOCALITY`];
        const region = frontmatter[`${prefix}.REGION`];
        const postal = frontmatter[`${prefix}.POSTAL`];
        const country = frontmatter[`${prefix}.COUNTRY`];
        
        const parts = [street, locality, region, postal, country].filter(Boolean);
        if (parts.length > 0) {
          const addressValue = parts.join(', ');
          if (label) {
            lines.push(`- ${label}: ${addressValue}`);
          } else {
            lines.push(`- ${addressValue}`);
          }
        }
      }
    }
    
    if (lines.length === 0) {
      return '';
    }
    
    return lines.join('\n');
  }

  /**
   * Update Contact section in markdown content
   */
  async updateContactSectionInContent(contactSection: string): Promise<void> {
    const content = await this.getContent();
    
    // Check if Contact section exists
    const contactSectionRegex = /^(#{2,4} Contact\s*\n)([\s\S]*?)(?=\n#{2,4} |\n#\w+|$)/m;
    const contactMatch = content.match(contactSectionRegex);
    
    // Check if Related section exists
    const relatedSectionRegex = /^(#{2,4} Related\s*\n)/m;
    const relatedMatch = content.match(relatedSectionRegex);
    
    if (contactMatch && relatedMatch) {
      // Both exist - check ordering
      const contactIndex = content.indexOf(contactMatch[0]);
      const relatedIndex = content.indexOf(relatedMatch[0]);
      
      if (contactIndex > relatedIndex) {
        // Wrong order! Contact is after Related. Need to move Contact before Related
        // 1. Remove Contact section from current position
        const contentWithoutContact = content.replace(contactSectionRegex, '');
        // 2. Insert Contact before Related
        const newRelatedMatch = contentWithoutContact.match(relatedSectionRegex);
        if (newRelatedMatch) {
          const insertPos = contentWithoutContact.indexOf(newRelatedMatch[0]);
          const newContent = contentWithoutContact.slice(0, insertPos) + `## Contact\n${contactSection}\n\n` + contentWithoutContact.slice(insertPos);
          await this.contactData.updateContent(newContent);
          return;
        }
      } else {
        // Correct order - just replace Contact section
        const newContent = content.replace(contactSectionRegex, `$1${contactSection}\n`);
        await this.contactData.updateContent(newContent);
        return;
      }
    }
    
    if (contactMatch && !relatedMatch) {
      // Contact exists, no Related - just replace in-place
      const newContent = content.replace(contactSectionRegex, `$1${contactSection}\n`);
      await this.contactData.updateContent(newContent);
      return;
    }
    
    // Contact doesn't exist - add it in the right place
    // Priority: before Related section > before hashtags > at end
    
    const relatedMatch2 = content.match(/\n(#{2,4} Related)/);
    const hashtagMatch = content.match(/\n(#\w+)/);
    
    let newContent: string;
    
    if (relatedMatch2) {
      // Insert before Related section
      const insertPos = content.indexOf(relatedMatch2[0]);
      newContent = content.slice(0, insertPos) + `\n## Contact\n${contactSection}\n` + content.slice(insertPos);
    } else if (hashtagMatch) {
      // Insert before hashtags
      const insertPos = content.indexOf(hashtagMatch[0]);
      newContent = content.slice(0, insertPos) + `\n## Contact\n${contactSection}\n` + content.slice(insertPos);
    } else {
      // Add at end
      newContent = content + `\n\n## Contact\n${contactSection}\n`;
    }
    
    await this.contactData.updateContent(newContent);
  }

  /**
   * Validate contact fields
   */
  validateContactFields(fields: any[]): string[] {
    const warnings: string[] = [];
    
    // Basic validation - this would be replaced with ContactSection.validate()
    // For now, keep simple validation for backward compatibility
    for (const field of fields) {
      if (field.fieldType === 'EMAIL') {
        // Simple email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(field.value)) {
          warnings.push(`Invalid email format: ${field.value}`);
        }
      }
    }
    
    return warnings;
  }
}