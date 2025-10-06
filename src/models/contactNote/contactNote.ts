/**
 * Optimized ContactNote class with improved data locality.
 * Groups methods close to the data they operate on for better cache performance.
 */

import { TFile, App } from 'obsidian';
import { ContactsPluginSettings } from 'src/plugin/settings';
import { Gender, Contact, ParsedRelationship, FrontmatterRelationship, ResolvedContact } from './types';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { normalizeFieldValue } from './fieldPatternDetection';

// Import entities
import { UID } from './entities/valueObjects/UID';
import { Revision } from './entities/valueObjects/Revision';
import { Gender as GenderEntity } from './entities/valueObjects/Gender';
import { Frontmatter } from './entities/document/Frontmatter';
import { ContactSection } from './entities/document/ContactSection';
import type { ContactField } from './entities/fields/ContactField';
import { RelatedSection } from './entities/document/RelatedSection';
import { Relationship } from './entities/relationships/Relationship';
import { RelationshipType } from './entities/relationships/RelationshipType';
import { RelationshipReference } from './entities/relationships/RelationshipReference';

// Import utilities for markdown rendering
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
 * Simplified ContactNote class with direct data access.
 * Caches frontmatter and content for performance.
 */
export class ContactNote {
  private app: App;
  private settings: ContactsPluginSettings;
  private file: TFile;
  
  // Cached data
  private _frontmatter: Record<string, any> | null = null;
  private _content: string | null = null;
  private _gender: Gender | null = null;
  private _uid: string | null = null;
  private _displayName: string | null = null;
  
  // Flag to skip metadata cache after a write operation
  private _skipMetadataCache: boolean = false;

  constructor(app: App, settings: ContactsPluginSettings, file: TFile) {
    this.app = app;
    this.settings = settings;
    this.file = file;
  }

  // === Core File Operations ===

  /**
   * Get the TFile object for this contact
   */
  getFile(): TFile {
    return this.file;
  }

  /**
   * Get the contact's UID from frontmatter
   */
  async getUID(): Promise<string | null> {
    if (this._uid === null) {
      const frontmatter = await this.getFrontmatter();
      this._uid = frontmatter?.UID || null;
    }
    return this._uid;
  }

  /**
   * Get the contact's display name
   */
  getDisplayName(): string {
    if (this._displayName === null) {
      this._displayName = this.file.basename;
    }
    return this._displayName;
  }

  /**
   * Get the file content with caching
   */
  async getContent(): Promise<string> {
    if (this._content === null) {
      this._content = await this.app.vault.read(this.file);
    }
    return this._content;
  }

  /**
   * Get the frontmatter with caching
   * Uses Frontmatter entity internally for parsing
   */
  async getFrontmatter(): Promise<Record<string, any> | null> {
    if (this._frontmatter === null) {
      // Skip metadata cache if we just wrote to the file
      if (!this._skipMetadataCache) {
        try {
          const cache = this.app.metadataCache.getFileCache(this.file);
          if (cache?.frontmatter) {
            this._frontmatter = cache.frontmatter;
            return this._frontmatter;
          }
        } catch (error: any) {
          console.debug(`[ContactNote] Error accessing metadata cache for ${this.file.path}: ${error.message}`);
        }
      }

      try {
        const content = await this.getContent();
        const match = content.match(/^---\n([\s\S]*?)\n---/);
        if (match) {
          try {
            // Use Frontmatter entity for parsing
            const frontmatterEntity = Frontmatter.fromYAML(match[1]);
            this._frontmatter = frontmatterEntity.toObject();
          } catch (error: any) {
            console.debug(`[ContactNote] Error parsing frontmatter for ${this.file.path}: ${error.message}`);
            this._frontmatter = null;
            return null;
          }
        } else {
          this._frontmatter = {};
        }
      } catch (error: any) {
        console.debug(`[ContactNote] Error reading content for ${this.file.path}: ${error.message}`);
        this._frontmatter = {};
      }
    }
    return this._frontmatter;
  }

  /**
   * Update content and invalidate caches
   */
  private async updateContent(newContent: string): Promise<void> {
    await this.app.vault.modify(this.file, newContent);
    this._content = null;
    this._frontmatter = null;
    this._skipMetadataCache = true;
  }

  /**
   * Invalidate caches when file is modified externally
   */
  invalidateCache(): void {
    this._frontmatter = null;
    this._content = null;
    this._gender = null;
    this._uid = null;
    this._displayName = null;
    this._skipMetadataCache = false;
  }

  // === Gender Operations ===

  /**
   * Parse GENDER field value from vCard
   * Delegates to Gender entity
   */
  parseGender(value: string): Gender {
    try {
      return GenderEntity.fromString(value).getValue();
    } catch (error) {
      return null;
    }
  }

  /**
   * Get the contact's gender from frontmatter
   */
  async getGender(): Promise<Gender> {
    if (this._gender === null) {
      const frontmatter = await this.getFrontmatter();
      const genderValue = frontmatter?.GENDER;
      this._gender = genderValue ? this.parseGender(genderValue) : null;
    }
    return this._gender;
  }

  /**
   * Update the contact's gender in frontmatter
   */
  async updateGender(gender: Gender): Promise<void> {
    const genderValue = gender ? gender : '';
    await this.updateFrontmatterValue('GENDER', genderValue);
    this._gender = gender;
  }

  // === Frontmatter Operations ===

  /**
   * Generate a revision timestamp in VCF format
   * Delegates to Revision entity
   */
  generateRevTimestamp(): string {
    return Revision.now().toVCFFormat();
  }

  /**
   * Save frontmatter to file
   * Uses Frontmatter entity for serialization
   */
  private async saveFrontmatter(frontmatter: Record<string, any>): Promise<void> {
    const content = await this.getContent();
    
    // Use Frontmatter entity for YAML serialization
    const frontmatterEntity = Frontmatter.fromObject(frontmatter);
    let frontmatterYaml = frontmatterEntity.toYAML();
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
    
    await this.updateContent(newContent);
  }

  /**
   * Extract field type from a frontmatter key
   */
  private extractFieldType(key: string): string | null {
    const match = key.match(/^(EMAIL|TEL|URL|ADR)(\[|\.)?/);
    return match ? match[1] : null;
  }

  /**
   * Compare two values for a given field type, normalizing both before comparison
   */
  private valuesAreEqual(currentValue: any, newValue: string, fieldType: string | null): boolean {
    if (currentValue === undefined || currentValue === null) {
      return false;
    }

    const currentStr = String(currentValue);
    
    if (fieldType && (fieldType === 'TEL' || fieldType === 'EMAIL' || fieldType === 'URL')) {
      const normalizedCurrent = normalizeFieldValue(currentStr, fieldType);
      const normalizedNew = normalizeFieldValue(newValue, fieldType);
      return normalizedCurrent === normalizedNew;
    }
    
    return currentStr === newValue;
  }

  /**
   * Find an existing frontmatter key that matches the given key, ignoring case
   */
  private findFrontmatterKey(frontmatter: Record<string, any>, searchKey: string): string | null {
    if (searchKey in frontmatter) {
      return searchKey;
    }
    
    const searchKeyLower = searchKey.toLowerCase();
    for (const key of Object.keys(frontmatter)) {
      if (key.toLowerCase() === searchKeyLower) {
        return key;
      }
    }
    
    return null;
  }

  /**
   * Update a single frontmatter value
   */
  async updateFrontmatterValue(key: string, value: string, skipRevUpdate = false): Promise<void> {
    const frontmatter = await this.getFrontmatter();
    if (!frontmatter) {
      return;
    }

    if (frontmatter[key] === value) {
      return;
    }

    if (value === '') {
      delete frontmatter[key];
    } else {
      frontmatter[key] = value;
    }

    if (!skipRevUpdate && key !== 'REV') {
      frontmatter['REV'] = this.generateRevTimestamp();
    }

    await this.saveFrontmatter(frontmatter);
  }

  /**
   * Update multiple frontmatter values in a single operation
   */
  async updateMultipleFrontmatterValues(updates: Record<string, string>, skipRevUpdate = false): Promise<void> {
    const frontmatter = await this.getFrontmatter();
    if (!frontmatter) {
      return;
    }

    let hasChanges = false;
    const keyMapping: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(updates)) {
      const actualKey = this.findFrontmatterKey(frontmatter, key);
      if (actualKey) {
        keyMapping[key] = actualKey;
      } else {
        keyMapping[key] = key;
      }
      
      const currentValue = actualKey ? frontmatter[actualKey] : undefined;
      const fieldType = this.extractFieldType(key);
      const valuesMatch = this.valuesAreEqual(currentValue, value, fieldType);
      if (!valuesMatch) {
        hasChanges = true;
      }
    }

    if (!hasChanges) {
      return;
    }

    for (const [key, value] of Object.entries(updates)) {
      const actualKey = keyMapping[key];
      
      if (actualKey !== key && actualKey in frontmatter) {
        delete frontmatter[actualKey];
      }
      
      if (value === '') {
        delete frontmatter[key];
      } else {
        frontmatter[key] = value;
      }
    }

    if (!skipRevUpdate) {
      frontmatter['REV'] = this.generateRevTimestamp();
    }

    await this.saveFrontmatter(frontmatter);
  }

  // === Relationship Operations (using Relationship entities) ===

  /**
   * Parse Related section from markdown content
   * Returns parsed relationships compatible with existing code
   */
  /**
   * Parse Related section from markdown content
   * Returns Relationship entity objects directly
   */
  async parseRelatedSection(): Promise<Relationship[]> {
    const content = await this.getContent();
    
    // Extract the Related section using regex
    const relatedSectionMatch = content.match(/^#{2,4} Related\s*\n([\s\S]*?)(?=\n#{2,4} |\n#\w+|$)/m);
    
    if (!relatedSectionMatch) {
      return [];
    }
    
    const relatedContent = relatedSectionMatch[1];
    const relatedSection = RelatedSection.fromMarkdown(relatedContent, 'Related', 2);
    return relatedSection.getRelationships();
  }

  /**
   * Find contact by name in the contacts folder
   */
  async findContactByName(contactName: string): Promise<TFile | null> {
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
   * Resolve contact information from contact name
   */
  async resolveContact(contactName: string): Promise<ResolvedContact | null> {
    const file = await this.findContactByName(contactName);
    if (!file) return null;
    
    // Create a temporary ContactNote for the target contact
    const targetContact = new ContactNote(this.app, this.settings, file);
    
    try {
      const uid = await targetContact.getUID();
      const gender = await targetContact.getGender();
      
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
   * Format a related value for vCard RELATED field
   * Delegates to RelationshipReference entity
   */
  formatRelatedValue(targetUid: string, targetName: string): string {
    if (targetUid) {
      try {
        const uid = UID.fromString(targetUid);
        return RelationshipReference.fromUID(uid).toString();
      } catch {
        return RelationshipReference.fromName(targetName).toString();
      }
    }
    return RelationshipReference.fromName(targetName).toString();
  }

  /**
   * Parse a vCard RELATED value to extract UID or name
   */
  /**
   * Parse a RELATED value using RelationshipReference entity
   * @deprecated Use RelationshipReference.fromString() directly
   */
  parseRelatedValue(value: string): { type: 'uuid' | 'uid' | 'name'; value: string } | null {
    if (!value || typeof value !== 'string') return null;
    
    try {
      const reference = RelationshipReference.fromString(value);
      const refType = reference.getType();
      
      if (refType === 'uid') {
        const uid = reference.getUID();
        return uid ? { type: 'uuid', value: uid.toString() } : null;
      } else {
        return { type: 'name', value: reference.getValue() };
      }
    } catch (error) {
      // Fall back to name if parsing fails
      return { type: 'name', value: value.trim() };
    }
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
   * Parse RELATED fields from frontmatter
   */
  async parseFrontmatterRelationships(): Promise<FrontmatterRelationship[]> {
    const frontmatter = await this.getFrontmatter();
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
   * Update Related section in markdown content using entities
   */
  async updateRelatedSectionInContent(relationships: { type: string; contactName: string }[]): Promise<void> {
    const content = await this.getContent();
    
    // Convert to entities
    const relationshipEntities: Relationship[] = [];
    for (const rel of relationships) {
      const relType = RelationshipType.fromString(rel.type);
      const target = RelationshipReference.fromString(rel.contactName);
      relationshipEntities.push(Relationship.create(relType, target));
    }
    
    // Create section
    const relatedSection = RelatedSection.fromRelationships(relationshipEntities, 'Related', 2);
    const sectionMarkdown = relatedSection.toMarkdown();
    
    // Replace section
    const relatedSectionRegex = /^(#{2,4} Related\s*\n)([\s\S]*?)(?=\n#{2,4} |\n#\w+|$)/m;
    
    let newContent: string;
    if (relatedSectionRegex.test(content)) {
      newContent = content.replace(relatedSectionRegex, sectionMarkdown + '\n');
    } else {
      // Add before hashtags or at end
      const hashtagMatch = content.match(/\n(#\w+)/);
      if (hashtagMatch) {
        const insertPos = content.indexOf(hashtagMatch[0]);
        newContent = content.slice(0, insertPos) + `\n${sectionMarkdown}\n` + content.slice(insertPos);
      } else {
        newContent = content + `\n\n${sectionMarkdown}\n`;
      }
    }
    
    await this.updateContent(newContent);
  }

  /**
   * Get the display term for a relationship based on the contact's gender
   * Delegates to RelationshipType entity
   */
  getGenderedRelationshipTerm(relationshipType: string, contactGender: Gender): string {
    const relType = RelationshipType.fromString(relationshipType);
    const genderEntity = GenderEntity.fromString(contactGender);
    return relType.getGenderedTerm(genderEntity);
  }

  /**
   * Infer gender from a gendered relationship term
   * Delegates to RelationshipType entity
   */
  inferGenderFromRelationship(relationshipType: string): Gender {
    const relType = RelationshipType.fromString(relationshipType);
    const genderEntity = relType.inferGender();
    return genderEntity ? genderEntity.getValue() : null;
  }

  /**
   * Convert gendered relationship term to genderless equivalent
   * Delegates to RelationshipType entity
   */
  convertToGenderlessType(relationshipType: string): string {
    return RelationshipType.fromString(relationshipType).getNeutralType();
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
              displayType = this.getGenderedRelationshipTerm(relationshipType, contactGender);
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

  /**
   * Parse a RELATED value for markdown rendering using RelationshipReference entity
   * @deprecated Use RelationshipReference.fromString() directly
   */
  private parseRelatedValueForMarkdown(value: string): { type: 'uuid' | 'uid' | 'name'; value: string } | null {
    // Delegate to parseRelatedValue which now uses RelationshipReference entity
    return this.parseRelatedValue(value);
  }

  // === Sync Operations (inlined from SyncOperations) ===

  /**
   * Deduplicate relationships, preferring gendered terms over ungendered
   */
  private deduplicateRelationships(relationships: Relationship[]): {
    deduplicated: Relationship[];
    inferredGender: Map<string, Gender>;
  } {
    const seen = new Map<string, Relationship>();
    const inferredGender = new Map<string, Gender>();
    
    for (const rel of relationships) {
      const type = rel.getType().toString();
      const contactName = rel.getTarget().getValue();
      
      const genderlessType = this.convertToGenderlessType(type);
      const contactKey = `${genderlessType}:${contactName.toLowerCase()}`;
      const existing = seen.get(contactKey);
      
      if (!existing) {
        seen.set(contactKey, rel);
        const gender = this.inferGenderFromRelationship(type);
        if (gender) {
          inferredGender.set(contactName, gender);
        }
        continue;
      }
      
      const existingType = existing.getType().toString();
      const existingGender = this.inferGenderFromRelationship(existingType);
      const currentGender = this.inferGenderFromRelationship(type);
      
      if (currentGender && !existingGender) {
        seen.set(contactKey, rel);
        inferredGender.set(contactName, currentGender);
      } else if (currentGender) {
        const existingContactName = existing.getTarget().getValue();
        inferredGender.set(existingContactName, existingGender!);
      }
    }
    
    return {
      deduplicated: Array.from(seen.values()),
      inferredGender
    };
  }

  /**
   * Find contact by UID
   */
  private async findContactByUid(uid: string): Promise<{ name: string; file: any } | null> {
    const allFiles = this.app.vault.getMarkdownFiles();

    for (const file of allFiles) {
      try {
        const tempContact = new ContactNote(this.app, this.settings, file);
        const fileUid = await tempContact.getUID();
        
        if (fileUid === uid) {
          const frontmatter = await tempContact.getFrontmatter();
          const contactName = frontmatter?.FN || file.basename;
          
          return {
            name: contactName,
            file: file
          };
        }
      } catch (error: any) {
        continue;
      }
    }

    return null;
  }

  /**
   * Sync Related list from markdown to frontmatter
   */
  async syncRelatedListToFrontmatter(): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    try {
      const relationships = await this.parseRelatedSection();
      const { deduplicated, inferredGender } = this.deduplicateRelationships(relationships);
      
      const frontmatterUpdates: Record<string, string> = {};
      const typeIndices = new Map<string, number>();

      // Clear existing RELATED fields
      const frontmatter = await this.getFrontmatter();
      if (frontmatter) {
        Object.keys(frontmatter).forEach(key => {
          if (key.startsWith('RELATED') || key === 'RELATED') {
            frontmatterUpdates[key] = '';
          }
        });
      }

      // Process each relationship
      for (const relationship of deduplicated) {
        try {
          const type = relationship.getType().toString();
          const contactName = relationship.getTarget().getValue();
          
          const genderlessType = this.convertToGenderlessType(type);
          const currentIndex = typeIndices.get(genderlessType) || 0;
          typeIndices.set(genderlessType, currentIndex + 1);
          
          const resolvedContact = await this.resolveContact(contactName);
          
          if (resolvedContact) {
            const relatedValue = this.formatRelatedValue(
              resolvedContact.uid, 
              resolvedContact.name
            );
            
            const key = currentIndex === 0 
              ? `RELATED.${genderlessType}`
              : `RELATED.${genderlessType}.${currentIndex}`;
            
            frontmatterUpdates[key] = relatedValue;
          } else {
            const key = currentIndex === 0 
              ? `RELATED.${genderlessType}`
              : `RELATED.${genderlessType}.${currentIndex}`;
            
            frontmatterUpdates[key] = `name:${contactName}`;
            errors.push(`Could not resolve contact: ${contactName}`);
          }
        } catch (error: any) {
          const contactName = relationship.getTarget().getValue();
          errors.push(`Error processing relationship ${contactName}: ${error.message}`);
        }
      }

      if (Object.keys(frontmatterUpdates).length > 0) {
        await this.updateMultipleFrontmatterValues(frontmatterUpdates);
      }
      
      if (relationships.length !== deduplicated.length) {
        await this.updateRelatedSectionInContent(
          deduplicated.map(rel => ({
            type: rel.getType().toString(),
            contactName: rel.getTarget().getValue()
          }))
        );
      }

      return { success: true, errors };
    } catch (error: any) {
      errors.push(`Sync operation failed: ${error.message}`);
      return { success: false, errors };
    }
  }

  /**
   * Sync relationships from frontmatter to markdown
   */
  async syncFrontmatterToRelatedList(): Promise<{ 
    success: boolean; 
    errors: string[];
    updatedRelationships?: Array<{ newName: string; uid: string; oldName?: string }>;
  }> {
    const errors: string[] = [];
    const updatedRelationships: Array<{ newName: string; uid: string; oldName?: string }> = [];
    
    try {
      const frontmatterRelationships = await this.parseFrontmatterRelationships();
      const existingMarkdownRelationships = await this.parseRelatedSection();
      
      const markdownRelationships: { type: string; contactName: string }[] = 
        existingMarkdownRelationships.map(rel => ({ 
          type: rel.getType().toString(), 
          contactName: rel.getTarget().getValue() 
        }));

      for (const fmRel of frontmatterRelationships) {
        try {
          if (fmRel.parsedValue) {
            let contactName: string;
            
            if (fmRel.parsedValue.type === 'name') {
              contactName = fmRel.parsedValue.value;
            } else {
              const resolvedContact = await this.findContactByUid(fmRel.parsedValue.value);
              if (resolvedContact) {
                contactName = resolvedContact.name;
                
                const existingRel = existingMarkdownRelationships.find(rel => 
                  rel.getType().toString() === fmRel.type
                );
                if (existingRel && existingRel.getTarget().getValue() !== contactName) {
                  updatedRelationships.push({
                    newName: contactName,
                    uid: fmRel.parsedValue.value,
                    oldName: existingRel.getTarget().getValue()
                  });
                }
              } else {
                contactName = fmRel.parsedValue.value;
                errors.push(`Could not resolve UID/UUID: ${fmRel.parsedValue.value}`);
              }
            }
            
            const genderlessFmType = this.convertToGenderlessType(fmRel.type);
            const alreadyExists = markdownRelationships.some(rel => {
              const genderlessMdType = this.convertToGenderlessType(rel.type);
              return genderlessMdType === genderlessFmType && 
                     rel.contactName.toLowerCase() === contactName.toLowerCase();
            });
            
            if (!alreadyExists) {
              markdownRelationships.push({
                type: fmRel.type,
                contactName: contactName
              });
            }
          } else {
            errors.push(`Could not parse RELATED value: ${fmRel.value}`);
          }
        } catch (error: any) {
          errors.push(`Error processing frontmatter relationship ${fmRel.key}: ${error.message}`);
        }
      }

      await this.updateRelatedSectionInContent(markdownRelationships);

      return { success: true, errors, updatedRelationships };
    } catch (error: any) {
      errors.push(`Frontmatter to markdown sync failed: ${error.message}`);
      return { success: false, errors };
    }
  }

  /**
   * Perform full bidirectional sync between markdown and frontmatter
   */
  async performFullSync(): Promise<{ success: boolean; errors: string[] }> {
    const allErrors: string[] = [];
    let overallSuccess = true;

    try {
      const markdownToFm = await this.syncRelatedListToFrontmatter();
      if (!markdownToFm.success) {
        overallSuccess = false;
      }
      allErrors.push(...markdownToFm.errors);

      const fmToMarkdown = await this.syncFrontmatterToRelatedList();
      if (!fmToMarkdown.success) {
        overallSuccess = false;
      }
      allErrors.push(...fmToMarkdown.errors);

      return { success: overallSuccess, errors: allErrors };
    } catch (error: any) {
      allErrors.push(`Full sync operation failed: ${error.message}`);
      return { success: false, errors: allErrors };
    }
  }

  /**
   * Validate relationship consistency
   */
  async validateRelationshipConsistency(): Promise<{ 
    isConsistent: boolean; 
    issues: string[]; 
    recommendations: string[] 
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      const markdownRels = await this.parseRelatedSection();
      const frontmatterRels = await this.parseFrontmatterRelationships();

      if (markdownRels.length !== frontmatterRels.length) {
        issues.push(`Relationship count mismatch: ${markdownRels.length} in markdown, ${frontmatterRels.length} in frontmatter`);
        recommendations.push('Run full sync to resolve count discrepancies');
      }

      for (const rel of markdownRels) {
        const resolvedContact = await this.resolveContact(rel.contactName);
        if (!resolvedContact) {
          issues.push(`Unresolved contact in markdown: ${rel.contactName}`);
          recommendations.push(`Check if contact file exists for: ${rel.contactName}`);
        }
      }

      for (const fmRel of frontmatterRels) {
        if (fmRel.parsedValue?.type === 'uid' || fmRel.parsedValue?.type === 'uuid') {
          const resolvedContact = await this.findContactByUid(fmRel.parsedValue.value);
          if (!resolvedContact) {
            issues.push(`Orphaned UID in frontmatter: ${fmRel.parsedValue.value}`);
            recommendations.push(`Remove or update orphaned relationship: ${fmRel.key}`);
          }
        }
      }

      return {
        isConsistent: issues.length === 0,
        issues,
        recommendations
      };
    } catch (error: any) {
      issues.push(`Validation failed: ${error.message}`);
      return {
        isConsistent: false,
        issues,
        recommendations: ['Fix validation errors before checking consistency']
      };
    }
  }

  // === Validation Methods ===

  /**
   * Validate contact has required fields
   */
  async validateRequiredFields(): Promise<{
    isValid: boolean;
    issues: string[];
  }> {
    const frontmatter = await this.getFrontmatter();
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
  /**
   * Validate email format
   * @deprecated Use EmailField.validate() entity method directly
   */
  validateEmail(email: string): boolean {
    if (!email || typeof email !== 'string') return true; // Empty is valid
    try {
      const { EmailField } = require('./entities/fields/EmailField');
      const field = EmailField.fromMarkdown(`- ${email}`);
      const result = field?.validate();
      return result?.isValid ?? true;
    } catch {
      // Fallback to basic validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    }
  }

  /**
   * Validate phone number format
   * @deprecated Use TelephoneField.validate() entity method directly
   */
  validatePhoneNumber(phone: string): boolean {
    if (!phone || typeof phone !== 'string') return true; // Empty is valid
    try {
      const { TelephoneField } = require('./entities/fields/TelephoneField');
      const field = TelephoneField.fromMarkdown(`- ${phone}`);
      const result = field?.validate();
      return result?.isValid ?? true;
    } catch {
      // Fallback to basic validation
      const phoneRegex = /^[\+]?[\s\-\(\)0-9]{7,}$/;
      return phoneRegex.test(phone.replace(/\s/g, ''));
    }
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
   * @deprecated Use UrlField.validate() entity method directly
   */
  private validateURL(url: string): boolean {
    if (!url || typeof url !== 'string') return true; // Empty is valid
    try {
      const { UrlField } = require('./entities/fields/UrlField');
      const field = UrlField.fromMarkdown(`- ${url}`);
      const result = field?.validate();
      return result?.isValid ?? true;
    } catch {
      // Fallback to basic validation
      return /^https?:\/\/.+/.test(url);
    }
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
      const frontmatter = await this.getFrontmatter();
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
      const frontmatter = await this.getFrontmatter();
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
    
    const content = await this.getContent();
    
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
    
    await this.updateContent(newContent);
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
    const relationships = await this.parseRelatedSection();
    const frontmatterRelationships = await this.parseFrontmatterRelationships();
    
    const result: Array<{
      type: string;
      contactName: string;
      targetUID?: string;
      linkType: 'uid' | 'name';
      originalType: string;
    }> = [];
    const processedTargets = new Set<string>();
    
    for (const fmRel of frontmatterRelationships) {
      if (fmRel.parsedValue && (fmRel.parsedValue.type === 'uuid' || fmRel.parsedValue.type === 'uid')) {
        const contactName = await this.resolveContactNameByUID(fmRel.parsedValue.value);
        if (contactName) {
          result.push({
            type: fmRel.type,
            contactName,
            targetUID: fmRel.parsedValue.value,
            linkType: 'uid',
            originalType: fmRel.type
          });
          processedTargets.add(contactName.toLowerCase());
        }
      } else if (fmRel.parsedValue && fmRel.parsedValue.type === 'name') {
        const resolved = await this.resolveContact(fmRel.parsedValue.value);
        const obj: {
          type: string;
          contactName: string;
          targetUID?: string;
          linkType: 'uid' | 'name';
          originalType: string;
        } = {
          type: fmRel.type,
          contactName: fmRel.parsedValue.value,
          linkType: resolved?.uid ? 'uid' : 'name',
          originalType: fmRel.type
        };
        if (resolved?.uid) {
          obj.targetUID = resolved.uid;
        }
        result.push(obj);
        processedTargets.add(fmRel.parsedValue.value.toLowerCase());
      }
    }
    
    for (const rel of relationships) {
      const type = rel.getType().toString();
      const contactName = rel.getTarget().getValue();
      
      if (!processedTargets.has(contactName.toLowerCase())) {
        const resolved = await this.resolveContact(contactName);
        const obj: {
          type: string;
          contactName: string;
          targetUID?: string;
          linkType: 'uid' | 'name';
          originalType: string;
        } = {
          type: type,
          contactName: contactName,
          linkType: resolved?.uid ? 'uid' : 'name',
          originalType: type
        };
        if (resolved?.uid) {
          obj.targetUID = resolved.uid;
        }
        result.push(obj);
      }
    }
    
    return result;
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
    // First, check if identifier is a relationship type in frontmatter
    const frontmatter = await this.getFrontmatter();
    if (frontmatter) {
      for (const [key, value] of Object.entries(frontmatter)) {
        if (key.startsWith('RELATED[') && typeof value === 'string') {
          const typeMatch = key.match(/RELATED\[(?:\d+:)?([^\]]+)\]/);
          const relType = typeMatch ? typeMatch[1] : '';
          
          if (relType.toLowerCase() === identifierOrType.toLowerCase()) {
            const parsedValue = this.parseRelatedValue(value);
            if (parsedValue && (parsedValue.type === 'uuid' || parsedValue.type === 'uid')) {
              const result = await this.resolveContactByUID(parsedValue.value);
              if (result) {
                const contactName = result.frontmatter?.FN || result.file.basename;
                return { 
                  file: result.file, 
                  frontmatter: result.frontmatter,
                  type: 'uid', 
                  contactName 
                };
              }
            }
          }
        }
      }
    }
    
    // Check if it's a UID format
    if (identifierOrType.startsWith('urn:uuid:') || UID.validate(identifierOrType)) {
      const result = await this.resolveContactByUID(identifierOrType);
      if (result) {
        const contactName = result.frontmatter?.FN || result.file.basename;
        return { 
          file: result.file, 
          frontmatter: result.frontmatter,
          type: 'uid', 
          contactName 
        };
      }
    }
    
    // Fall back to name resolution
    const file = await this.findContactByName(identifierOrType);
    if (file) {
      const cache = this.app.metadataCache.getFileCache(file);
      return { 
        file, 
        frontmatter: cache?.frontmatter,
        type: 'name', 
        contactName: identifierOrType 
      };
    }
    
    return null;
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
    const result: {
      success: boolean;
      processedRelationships: Array<{
        targetContact: string;
        reverseType: string;
        added: boolean;
        reason?: string;
        error?: string;
      }>;
      errors: string[];
    } = {
      success: true,
      processedRelationships: [],
      errors: []
    };

    try {
      const relationships = await this.parseRelatedSection();
      const sourceContactName = this.getDisplayName();
      const sourceFrontmatter = await this.getFrontmatter();
      const sourceGender = sourceFrontmatter?.GENDER as Gender;
      
      for (const relationship of relationships) {
        const contactName = relationship.getTarget().getValue();
        const relType = relationship.getType().toString();
        
        const targetFile = await this.findContactByName(contactName);
        if (!targetFile) {
          result.processedRelationships.push({
            targetContact: contactName,
            reverseType: '',
            added: false,
            reason: 'target contact not found',
            error: 'Target contact not found'
          });
          continue;
        }

        const targetContact = new ContactNote(this.app, this.settings, targetFile);
        
        // Use entity method to get reciprocal type
        const reciprocalType = relationship.getReciprocalType();
        const reverseType = reciprocalType.toString();
        
        if (!reverseType) {
          result.processedRelationships.push({
            targetContact: contactName,
            reverseType: '',
            added: false,
            reason: 'no reciprocal relationship type available',
            error: 'No reciprocal relationship type available'
          });
          continue;
        }

        const targetRelationships = await targetContact.parseRelatedSection();
        
        const reverseExists = targetRelationships.some((rel: Relationship) => {
          const relContactName = rel.getTarget().getValue();
          const relType = rel.getType().toString();
          const normalizedRelName = relContactName.toLowerCase().replace(/[\s\-]/g, '');
          const normalizedSourceName = sourceContactName.toLowerCase().replace(/[\s\-]/g, '');
          return normalizedRelName === normalizedSourceName && 
            this.areRelationshipTypesEquivalent(relType, reverseType);
        });

        if (!reverseExists) {
          const newRelationships = targetRelationships.map(r => ({
            type: r.getType().toString(),
            contactName: r.getTarget().getValue()
          }));
          newRelationships.push({
            type: reverseType,
            contactName: sourceContactName
          });
          
          await targetContact.updateRelatedSectionInContent(newRelationships);
          
          result.processedRelationships.push({
            targetContact: contactName,
            reverseType,
            added: true
          });
        } else {
          result.processedRelationships.push({
            targetContact: contactName,
            reverseType,
            added: false,
            reason: 'relationship already exists'
          });
        }
      }
    } catch (error: any) {
      result.success = false;
      result.errors.push(`Error processing reverse relationships: ${error.message}`);
    }

    return result;
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
    const result: {
      success: boolean;
      upgradedRelationships: Array<{
        targetUID: string;
        type: string;
        key: string;
      }>;
      errors: string[];
    } = { success: true, upgradedRelationships: [], errors: [] };

    try {
      const frontmatter = await this.getFrontmatter();
      const updates: Record<string, string> = {};
      
      if (frontmatter) {
        for (const [key, value] of Object.entries(frontmatter)) {
          if (key.startsWith('RELATED[') && typeof value === 'string') {
            const parsedValue = this.parseRelatedValue(value);
            if (parsedValue && parsedValue.type === 'name') {
              const targetFile = await this.findContactByName(parsedValue.value);
              if (targetFile) {
                const targetCache = this.app.metadataCache.getFileCache(targetFile);
                const targetUID = targetCache?.frontmatter?.UID;
                
                if (targetUID) {
                  updates[key] = this.formatRelatedValue(targetUID, parsedValue.value);
                  const typeMatch = key.match(/RELATED\[(?:\d+:)?([^\]]+)\]/);
                  const relType = typeMatch ? typeMatch[1] : 'related';
                  result.upgradedRelationships.push({
                    targetUID,
                    type: relType,
                    key
                  });
                }
              }
            }
          }
        }
      }

      const markdownRelationships = await this.parseRelatedSection();
      let relationshipIndex = 0;
      
      for (const relationship of markdownRelationships) {
        const relType = relationship.getType().toString();
        const contactName = relationship.getTarget().getValue();
        
        const hasFrontmatterEntry = frontmatter && Object.keys(frontmatter).some(key => {
          if (!key.startsWith('RELATED[')) return false;
          const typeMatch = key.match(/RELATED\[(?:\d+:)?([^\]]+)\]/);
          const fmRelType = typeMatch ? typeMatch[1] : '';
          return fmRelType.toLowerCase() === relType.toLowerCase();
        });
        
        if (!hasFrontmatterEntry) {
          const targetFile = await this.findContactByName(contactName);
          if (targetFile) {
            const targetCache = this.app.metadataCache.getFileCache(targetFile);
            const targetUID = targetCache?.frontmatter?.UID;
            
            if (targetUID) {
              const key = relationshipIndex === 0 && !hasFrontmatterEntry
                ? `RELATED.${relType}`
                : `RELATED.${relType}.${relationshipIndex}`;
              
              updates[key] = this.formatRelatedValue(targetUID, contactName);
              result.upgradedRelationships.push({
                targetUID,
                type: relType,
                key
              });
              relationshipIndex++;
            }
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        await this.updateMultipleFrontmatterValues(updates);
      }
    } catch (error: any) {
      result.success = false;
      result.errors.push(`Error upgrading relationships: ${error.message}`);
    }

    return result;
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
      const frontmatter = await this.getFrontmatter();
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
        await this.updateMultipleFrontmatterValues(updates);
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
      const frontmatter = await this.getFrontmatter();
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
        await this.updateMultipleFrontmatterValues(updates);
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
  /**
   * Check if two relationship types are equivalent
   */
  private areRelationshipTypesEquivalent(type1: string, type2: string): boolean {
    const genderless1 = this.convertToGenderlessType(type1);
    const genderless2 = this.convertToGenderlessType(type2);
    return genderless1 === genderless2;
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
    return {
      frontmatter: this._frontmatter !== null,
      content: this._content !== null,
      gender: this._gender !== null,
      uid: this._uid !== null,
      displayName: this._displayName !== null
    };
  }

  // === Additional utility methods for backward compatibility ===

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
    const frontmatter = await this.getFrontmatter();
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
  /**
   * Parse Contact section from markdown content
   * Returns ContactField entity objects directly
   */
  async parseContactSection(): Promise<ContactField[]> {
    const content = await this.getContent();
    
    // Extract the Contact section using markdown parsing
    const contactSectionMatch = content.match(/^## Contact\s*\n([\s\S]*?)(?=\n## |\n#Contact|$)/m);
    
    if (!contactSectionMatch) {
      return [];
    }
    
    const contactContent = contactSectionMatch[1];
    const contactSection = ContactSection.fromMarkdown(contactContent, 'Contact', 2);
    return contactSection.getFields();
  }

  /**
   * Generate Contact section markdown from frontmatter
   */
  /**
   * Generate Contact section markdown from frontmatter
   * Uses ContactSection entity to generate markdown
   */
  async generateContactSection(): Promise<string> {
    const frontmatter = await this.getFrontmatter();
    if (!frontmatter) return '';
    
    const fields: ContactField[] = [];
    
    // Create ContactField entities from frontmatter
    // Try to parse EMAIL, TEL, URL, and ADR fields
    for (const [key, value] of Object.entries(frontmatter)) {
      try {
        // Import field types dynamically based on key prefix
        if (key.startsWith('EMAIL') && typeof value === 'string') {
          const { EmailField } = await import('./entities/fields/EmailField');
          const field = EmailField.fromFrontmatter(key, value);
          fields.push(field);
        } else if (key.startsWith('TEL') && typeof value === 'string') {
          const { TelephoneField } = await import('./entities/fields/TelephoneField');
          const field = TelephoneField.fromFrontmatter(key, value);
          fields.push(field);
        } else if (key.startsWith('URL') && typeof value === 'string') {
          const { UrlField } = await import('./entities/fields/UrlField');
          const field = UrlField.fromFrontmatter(key, value);
          fields.push(field);
        }
        // ADR fields are more complex - need to collect components
        // For now, skip ADR in this simplified version
      } catch (error) {
        // Skip fields that fail to parse
        console.debug(`[ContactNote] Failed to parse field ${key}:`, error);
      }
    }
    
    if (fields.length === 0) {
      return '';
    }
    
    // Use ContactSection entity to generate markdown
    const contactSection = ContactSection.fromFields(fields, 'Contact', 2);
    const markdown = contactSection.toMarkdown();
    
    // Extract just the content part (remove header)
    const lines = markdown.split('\n');
    const contentLines = lines.filter(line => !line.match(/^#{2,4}\s+Contact/));
    return contentLines.join('\n').trim();
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
          await this.updateContent(newContent);
          return;
        }
      } else {
        // Correct order - just replace Contact section
        const newContent = content.replace(contactSectionRegex, `$1${contactSection}\n`);
        await this.updateContent(newContent);
        return;
      }
    }
    
    if (contactMatch && !relatedMatch) {
      // Contact exists, no Related - just replace in-place
      const newContent = content.replace(contactSectionRegex, `$1${contactSection}\n`);
      await this.updateContent(newContent);
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
    
    await this.updateContent(newContent);
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