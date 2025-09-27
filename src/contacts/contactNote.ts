/**
 * Unified interface for interacting with a contact note in Obsidian.
 * Consolidates functionality from genderUtils, relatedFieldUtils, relatedListSync,
 * contactMdTemplate, revisionUtils, contactFrontmatter, and contactDataKeys.
 */

import { TFile, App, parseYaml, stringifyYaml } from 'obsidian';
import { ContactsPluginSettings } from '../settings/settings.d';
import { VCardForObsidianRecord, VCardKind, VCardKinds } from './vcardFile';
import { loggingService } from '../services/loggingService';
import { getApp } from '../context/sharedAppContext';
import { getSettings } from '../context/sharedSettingsContext';

export type Contact = {
  data: Record<string, any>;
  file: TFile;
}

// Re-export types that were previously exported from utility modules
export type Gender = 'M' | 'F' | 'NB' | 'U' | null;

export interface ParsedKey {
  key: string;
  index?: string;
  type?: string;
  subkey?: string;
}

export interface ParsedRelationship {
  type: string;
  contactName: string;
  originalType: string;
}

export interface ResolvedContact {
  name: string;
  uid: string;
  file: TFile;
  gender: Gender;
}

export interface FrontmatterRelationship {
  type: string;
  value: string;
  parsedValue: {
    type: 'uuid' | 'uid' | 'name';
    value: string;
  };
}

/**
 * Unified class for interacting with a contact note in Obsidian.
 * Provides methods for managing frontmatter, relationships, gender, and markdown rendering.
 */
export class ContactNote {
  private app: App;
  private settings: ContactsPluginSettings;
  private file: TFile;
  private _frontmatter: Record<string, any> | null = null;
  private _content: string | null = null;

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
    const frontmatter = await this.getFrontmatter();
    return frontmatter?.UID || null;
  }

  /**
   * Get the contact's display name
   */
  getDisplayName(): string {
    return this.file.basename;
  }

  /**
   * Get the file content, with caching
   */
  async getContent(): Promise<string> {
    if (this._content === null) {
      this._content = await this.app.vault.read(this.file);
    }
    return this._content;
  }

  /**
   * Get the frontmatter, with caching
   */
  async getFrontmatter(): Promise<Record<string, any> | null> {
    if (this._frontmatter === null) {
      // Try metadata cache first (most efficient)
      const cache = this.app.metadataCache.getFileCache(this.file);
      if (cache?.frontmatter) {
        this._frontmatter = cache.frontmatter;
        return this._frontmatter;
      }

      // Fallback: parse from content
      const content = await this.getContent();
      const match = content.match(/^---\n([\s\S]*?)\n---/);
      if (match) {
        try {
          this._frontmatter = parseYaml(match[1]) || {};
        } catch (error) {
          loggingService.error(`[ContactNote] Error parsing frontmatter for ${this.file.path}: ${error.message}`);
          this._frontmatter = {};
        }
      } else {
        this._frontmatter = {};
      }
    }
    return this._frontmatter;
  }

  /**
   * Invalidate caches when file is modified externally
   */
  invalidateCache(): void {
    this._frontmatter = null;
    this._content = null;
  }

  // === Gender Operations ===

  /**
   * Parse GENDER field value from vCard
   */
  parseGender(value: string): Gender {
    if (!value || value.trim() === '') {
      return null;
    }
    
    const normalized = value.trim().toUpperCase();
    switch (normalized) {
      case 'M':
      case 'MALE':
        return 'M';
      case 'F':
      case 'FEMALE':
        return 'F';
      case 'NB':
      case 'NON-BINARY':
      case 'NONBINARY':
        return 'NB';
      case 'U':
      case 'UNSPECIFIED':
        return 'U';
      default:
        return null;
    }
  }

  /**
   * Get the contact's gender from frontmatter
   */
  async getGender(): Promise<Gender> {
    const frontmatter = await this.getFrontmatter();
    const genderValue = frontmatter?.GENDER;
    return genderValue ? this.parseGender(genderValue) : null;
  }

  /**
   * Update the contact's gender in frontmatter
   */
  async updateGender(gender: Gender): Promise<void> {
    if (gender) {
      await this.updateFrontmatterValue('GENDER', gender);
    } else {
      await this.updateFrontmatterValue('GENDER', '');
    }
  }

  /**
   * Get the display term for a relationship based on the contact's gender
   */
  getGenderedRelationshipTerm(relationshipType: string, contactGender: Gender): string {
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
      acquaintance: { M: 'acquaintance', F: 'acquaintance', default: 'acquaintance' },
      neighbor: { M: 'neighbor', F: 'neighbor', default: 'neighbor' },
    };
    
    const mappingData = mapping[relationshipType.toLowerCase()];
    if (!mappingData) {
      return relationshipType;
    }
    
    if (contactGender === 'M') {
      return mappingData.M;
    } else if (contactGender === 'F') {
      return mappingData.F;
    } else {
      return mappingData.default;
    }
  }

  /**
   * Infer gender from a gendered relationship term
   */
  inferGenderFromRelationship(relationshipType: string): Gender {
    const type = relationshipType.toLowerCase();
    
    const maleTerms = ['father', 'dad', 'daddy', 'uncle', 'brother', 'son', 'husband', 'grandfather', 'grandson'];
    if (maleTerms.includes(type)) {
      return 'M';
    }
    
    const femaleTerms = ['mother', 'mom', 'mommy', 'aunt', 'sister', 'daughter', 'wife', 'grandmother', 'granddaughter'];
    if (femaleTerms.includes(type)) {
      return 'F';
    }
    
    return null;
  }

  /**
   * Convert gendered relationship term to genderless equivalent
   */
  convertToGenderlessType(relationshipType: string): string {
    const type = relationshipType.toLowerCase();
    
    if (['father', 'dad', 'daddy', 'mother', 'mom', 'mommy'].includes(type)) {
      return 'parent';
    }
    if (['aunt', 'uncle'].includes(type)) {
      return 'auncle';
    }
    if (['son', 'daughter'].includes(type)) {
      return 'child';
    }
    if (['brother', 'sister'].includes(type)) {
      return 'sibling';
    }
    if (['husband', 'wife'].includes(type)) {
      return 'spouse';
    }
    if (['grandfather', 'grandmother'].includes(type)) {
      return 'grandparent';
    }
    if (['grandson', 'granddaughter'].includes(type)) {
      return 'grandchild';
    }
    
    return relationshipType;
  }

  // === Related Field Operations ===

  /**
   * Format a related value for vCard RELATED field
   */
  formatRelatedValue(targetUid: string, targetName: string): string {
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
  extractRelationshipType(key: string): string {
    const typeMatch = key.match(/RELATED(?:\[(?:\d+:)?([^\]]+)\])?/);
    return typeMatch ? typeMatch[1] || 'related' : 'related';
  }

  // === Key Parsing Operations ===

  /**
   * Parse a string in the format: key[index:type].subkey
   */
  parseKey(input: string): ParsedKey {
    const extractSubkey = (input: string): { main: string; subkey?: string } => {
      const dotIndex = input.indexOf('.');
      if (dotIndex === -1) {
        return { main: input, subkey: '' };
      }
      return {
        main: input.substring(0, dotIndex),
        subkey: input.substring(dotIndex + 1)
      };
    };

    const parseBracketContent = (content: string): { index?: string; type?: string } => {
      if (content.includes(':')) {
        const [index, type] = content.split(':');
        return { index, type };
      }
      return { type: content };
    };

    const parseKeyPart = (main: string): { key: string; index?: string; type?: string } => {
      const openBracketIndex = main.indexOf('[');
      if (openBracketIndex === -1) {
        return { key: main };
      }

      const key = main.substring(0, openBracketIndex);
      const closeBracketIndex = main.indexOf(']', openBracketIndex);
      if (closeBracketIndex === -1) {
        throw new Error('Invalid vcard property key encountered please correct.');
      }

      const bracketContent = main.substring(openBracketIndex + 1, closeBracketIndex);
      const { index, type } = parseBracketContent(bracketContent);

      return { key, index, type };
    };

    const { main, subkey } = extractSubkey(input);
    const { key, index, type } = parseKeyPart(main);
    return { key, index, type, subkey };
  }

  // === Frontmatter Operations ===

  /**
   * Update a single frontmatter value
   */
  async updateFrontmatterValue(key: string, value: string): Promise<void> {
    const content = await this.getContent();
    const match = content.match(/^---\n([\s\S]*?)\n---\n?/);

    let yamlObj: any = {};
    let body = content;

    if (match) {
      yamlObj = parseYaml(match[1]) || {};
      body = content.slice(match[0].length);
    }

    if (value === '') {
      delete yamlObj[key];
    } else {
      yamlObj[key] = value;
    }

    const newFrontMatter = '---\n' + stringifyYaml(yamlObj) + '---\n';
    const newContent = newFrontMatter + body;

    await this.app.vault.modify(this.file, newContent);
    this.invalidateCache(); // Invalidate cache after modification
  }

  /**
   * Update multiple frontmatter values in a single operation
   */
  async updateMultipleFrontmatterValues(updates: Record<string, string>): Promise<void> {
    const content = await this.getContent();
    const match = content.match(/^---\n([\s\S]*?)\n---\n?/);

    let yamlObj: any = {};
    let body = content;

    if (match) {
      yamlObj = parseYaml(match[1]) || {};
      body = content.slice(match[0].length);
    }

    // Apply all updates
    for (const [key, value] of Object.entries(updates)) {
      if (value === '') {
        delete yamlObj[key];
      } else {
        yamlObj[key] = value;
      }
    }

    const newFrontMatter = '---\n' + stringifyYaml(yamlObj) + '---\n';
    const newContent = newFrontMatter + body;

    await this.app.vault.modify(this.file, newContent);
    this.invalidateCache(); // Invalidate cache after modification
  }

  // === Revision Operations ===

  /**
   * Generate a revision timestamp in VCF format
   */
  generateRevTimestamp(): string {
    return new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  }

  /**
   * Update the REV timestamp in frontmatter
   */
  async updateRevTimestamp(): Promise<void> {
    const revTimestamp = this.generateRevTimestamp();
    await this.updateFrontmatterValue('REV', revTimestamp);
  }

  /**
   * Parse a revision date string from VCF REV field
   */
  parseRevisionDate(revString?: string): Date | null {
    if (!revString) return null;
    
    try {
      let dateString = revString;
      
      // Handle vCard format: YYYYMMDDTHHMMSSZ
      if (/^\d{8}T\d{6}Z?$/.test(revString)) {
        const year = revString.substring(0, 4);
        const month = revString.substring(4, 6);
        const day = revString.substring(6, 8);
        const hour = revString.substring(9, 11);
        const minute = revString.substring(11, 13);
        const second = revString.substring(13, 15);
        
        const monthNum = parseInt(month, 10);
        const dayNum = parseInt(day, 10);
        
        if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) {
          return null;
        }
        
        dateString = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
      }
      
      const date = new Date(dateString);
      
      if (isNaN(date.getTime())) {
        return null;
      }
      
      // Additional validation for adjusted dates
      if (dateString.includes('-') && dateString.includes('T')) {
        const originalParts = dateString.split('T')[0].split('-');
        if (originalParts.length === 3) {
          const originalMonth = parseInt(originalParts[1], 10);
          const originalDay = parseInt(originalParts[2], 10);
          
          if (date.getUTCMonth() + 1 !== originalMonth || date.getUTCDate() !== originalDay) {
            return null;
          }
        }
      }
      
      return date;
    } catch (error) {
      loggingService.debug(`[ContactNote] Error parsing REV date: ${revString} - ${error.message}`);
      return null;
    }
  }

  /**
   * Check if this contact should be updated based on revision timestamps
   */
  async shouldUpdateFromVCF(vcfRecord: VCardForObsidianRecord): Promise<boolean> {
    try {
      const frontmatter = await this.getFrontmatter();
      const existingRev = frontmatter?.REV;
      const vcfRev = vcfRecord.REV;

      if (!existingRev || !vcfRev) {
        return false;
      }

      const existingRevDate = this.parseRevisionDate(existingRev);
      const vcfRevDate = this.parseRevisionDate(vcfRev);

      if (!existingRevDate || !vcfRevDate) {
        return false;
      }

      return vcfRevDate > existingRevDate;
    } catch (error) {
      loggingService.debug(`[ContactNote] Error comparing REV fields: ${error.message}`);
      return false;
    }
  }

  // === Related List Parsing and Management ===

  /**
   * Parse Related section from markdown content
   */
  async parseRelatedSection(): Promise<ParsedRelationship[]> {
    const content = await this.getContent();
    const relationships: ParsedRelationship[] = [];
    
    const relatedMatch = content.match(/##\s*Related\s*(?:\r?\n)((?:^\s*-\s*.*(?:\r?\n)?)*)/m);
    if (!relatedMatch) {
      return relationships;
    }
    
    const relatedSection = relatedMatch[1];
    const lines = relatedSection.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      const match = line.match(/^\s*-\s*([^\[\]]+)\s*\[\[([^\[\]]+)\]\]/);
      if (match) {
        const type = match[1].trim();
        const contactName = match[2].trim();
        
        if (type.length === 0) {
          continue;
        }
        
        relationships.push({
          type,
          contactName,
          originalType: type
        });
      }
    }
    
    return relationships;
  }

  /**
   * Parse RELATED fields from frontmatter
   */
  async parseFrontmatterRelationships(): Promise<FrontmatterRelationship[]> {
    const frontmatter = await this.getFrontmatter();
    const relationships: FrontmatterRelationship[] = [];
    
    if (!frontmatter) return relationships;
    
    for (const [key, value] of Object.entries(frontmatter)) {
      if (key.startsWith('RELATED') && value) {
        const type = this.extractRelationshipType(key);
        const parsedValue = this.parseRelatedValue(value);
        
        if (parsedValue) {
          relationships.push({
            type,
            value,
            parsedValue
          });
        }
      }
    }
    
    return relationships;
  }

  /**
   * Update Related section in markdown content
   */
  async updateRelatedSectionInContent(relationships: { type: string; contactName: string }[]): Promise<void> {
    const content = await this.getContent();
    const relatedMatch = content.match(/^(#{1,6})\s*Related\s*(?:\r?\n)((?:^\s*-\s*.*(?:\r?\n)?)*)/m);
    
    const relatedListItems = relationships.map(rel => 
      `- ${rel.type} [[${rel.contactName}]]`
    );
    
    const relatedSection = relatedListItems.length > 0 
      ? `## Related\n${relatedListItems.join('\n')}\n`
      : `## Related\n\n`;
    
    let newContent: string;
    if (relatedMatch) {
      newContent = content.replace(relatedMatch[0], relatedSection);
    } else {
      const firstSectionMatch = content.match(/^#{1,6}\s+/m);
      if (firstSectionMatch) {
        const insertPos = content.indexOf(firstSectionMatch[0]);
        newContent = content.slice(0, insertPos) + relatedSection + '\n' + content.slice(insertPos);
      } else {
        newContent = content.trimEnd() + '\n\n' + relatedSection;
      }
    }
    
    await this.app.vault.modify(this.file, newContent);
    this.invalidateCache();
  }

  /**
   * Find contact by name in the contacts folder
   */
  async findContactByName(contactName: string): Promise<TFile | null> {
    const contactsFolder = this.settings.contactsFolder || '/';
    const contactFile = this.app.vault.getAbstractFileByPath(`${contactsFolder}/${contactName}.md`);
    
    if (contactFile && (contactFile instanceof TFile || ('basename' in contactFile && contactFile.basename !== undefined))) {
      return contactFile as TFile;
    }
    
    const folder = this.app.vault.getAbstractFileByPath(contactsFolder);
    if (!folder || !('children' in folder)) {
      return null;
    }
    
    for (const child of (folder as any).children) {
      if (child && (child instanceof TFile || ('basename' in child && child.basename !== undefined)) && child.basename === contactName) {
        return child as TFile;
      }
    }
    
    return null;
  }

  /**
   * Resolve contact information from contact name
   */
  async resolveContact(contactName: string): Promise<ResolvedContact | null> {
    const file = await this.findContactByName(contactName);
    if (!file) {
      return null;
    }
    
    const cache = this.app.metadataCache.getFileCache(file);
    const frontmatter = cache?.frontmatter;
    
    if (!frontmatter) {
      return null;
    }
    
    const uid = frontmatter.UID;
    if (!uid) {
      return null;
    }
    
    const genderValue = frontmatter.GENDER;
    const gender = genderValue ? this.parseGender(genderValue) : null;
    
    return {
      name: contactName,
      uid,
      file,
      gender
    };
  }

  // === Relationship Sync Operations ===

  /**
   * Sync Related list from markdown to frontmatter
   */
  async syncRelatedListToFrontmatter(): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    try {
      const relationships = await this.parseRelatedSection();
      
      if (relationships.length === 0) {
        loggingService.info(`No relationships found in Related section for ${this.file.basename}`);
        return { success: true, errors: [] };
      }
      
      const currentFrontmatter = await this.getFrontmatter();
      const frontmatterUpdates: Record<string, string> = {};
      const processedContacts = new Set<string>();
      const typeIndexes: Record<string, number> = {};
      
      for (const relationship of relationships) {
        try {
          const genderlessType = this.convertToGenderlessType(relationship.type);
          const resolvedContact = await this.resolveContact(relationship.contactName);
          
          if (!resolvedContact) {
            const contactKey = `${genderlessType}:${relationship.contactName}`;
            
            if (processedContacts.has(contactKey)) {
              continue;
            }
            processedContacts.add(contactKey);
            
            const relatedValue = this.formatRelatedValue('', relationship.contactName);
            
            const existingMatchingKey = Object.keys(currentFrontmatter || {}).find(key => {
              const keyType = this.extractRelationshipType(key);
              return keyType === genderlessType && (currentFrontmatter as any)[key] === relatedValue;
            });
            
            if (existingMatchingKey) {
              continue;
            }
            
            let key = this.generateRelatedKey(genderlessType, typeIndexes, currentFrontmatter || {}, frontmatterUpdates);
            frontmatterUpdates[key] = relatedValue;
            
          } else {
            const relatedValue = this.formatRelatedValue(resolvedContact.uid, resolvedContact.name);
            const contactKey = `${genderlessType}:${resolvedContact.uid}`;
            
            if (processedContacts.has(contactKey)) {
              continue;
            }
            processedContacts.add(contactKey);
            
            const existingMatchingKey = Object.keys(currentFrontmatter || {}).find(key => {
              const keyType = this.extractRelationshipType(key);
              return keyType === genderlessType && (currentFrontmatter as any)[key] === relatedValue;
            });
            
            if (existingMatchingKey) {
              continue;
            }
            
            let key = this.generateRelatedKey(genderlessType, typeIndexes, currentFrontmatter || {}, frontmatterUpdates);
            frontmatterUpdates[key] = relatedValue;
            
            // Infer and update gender if needed
            const inferredGender = this.inferGenderFromRelationship(relationship.type);
            if (inferredGender && !resolvedContact.gender) {
              try {
                const targetContact = new ContactNote(this.app, this.settings, resolvedContact.file);
                await targetContact.updateGender(inferredGender);
                loggingService.info(`Inferred and updated gender for ${resolvedContact.name}: ${inferredGender}`);
              } catch (error) {
                errors.push(`Failed to update gender for ${resolvedContact.name}: ${error.message}`);
              }
            }
          }
        } catch (error) {
          errors.push(`Error processing relationship ${relationship.type} -> ${relationship.contactName}: ${error.message}`);
        }
      }
      
      if (Object.keys(frontmatterUpdates).length > 0) {
        await this.updateMultipleFrontmatterValues(frontmatterUpdates);
        loggingService.info(`Updated ${Object.keys(frontmatterUpdates).length} relationships in ${this.file.basename}`);
      } else {
        loggingService.info(`No new relationships to add for ${this.file.basename}`);
      }
      
      return { success: true, errors };
      
    } catch (error) {
      const errorMsg = `Failed to sync Related list for ${this.file.basename}: ${error.message}`;
      loggingService.error(errorMsg);
      errors.push(errorMsg);
      return { success: false, errors };
    }
  }

  /**
   * Sync frontmatter RELATED fields to Related list in markdown
   */
  async syncFrontmatterToRelatedList(): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    try {
      const frontmatterRelationships = await this.parseFrontmatterRelationships();
      
      if (frontmatterRelationships.length === 0) {
        loggingService.info(`No relationships found in frontmatter for ${this.file.basename}`);
        return { success: true, errors: [] };
      }
      
      const existingRelationships = await this.parseRelatedSection();
      const missingRelationships: { type: string; contactName: string }[] = [];
      
      for (const fmRel of frontmatterRelationships) {
        let contactName = '';
        
        if (fmRel.parsedValue.type === 'name') {
          contactName = fmRel.parsedValue.value;
        } else {
          const resolvedContact = await this.resolveContact(fmRel.parsedValue.value);
          if (resolvedContact) {
            contactName = resolvedContact.name;
          } else {
            const allFiles = this.app.vault.getMarkdownFiles();
            for (const otherFile of allFiles) {
              const otherCache = this.app.metadataCache.getFileCache(otherFile);
              if (otherCache?.frontmatter?.UID === fmRel.parsedValue.value) {
                contactName = otherFile.basename;
                break;
              }
            }
            
            if (!contactName) {
              contactName = fmRel.parsedValue.value;
              errors.push(`Could not resolve contact name for UID: ${fmRel.parsedValue.value}`);
            }
          }
        }
        
        const relationshipExists = existingRelationships.some(existing => 
          existing.contactName === contactName && 
          this.areRelationshipTypesEquivalent(existing.type, fmRel.type)
        );
        
        if (!relationshipExists) {
          missingRelationships.push({
            type: fmRel.type,
            contactName
          });
        }
      }
      
      if (missingRelationships.length === 0) {
        loggingService.info(`No missing relationships to sync for ${this.file.basename}`);
        return { success: true, errors };
      }
      
      const allRelationships = [
        ...existingRelationships.map(rel => ({ type: rel.type, contactName: rel.contactName })),
        ...missingRelationships
      ];
      
      await this.updateRelatedSectionInContent(allRelationships);
      loggingService.info(`Synced ${missingRelationships.length} missing relationships to Related section in: ${this.file.basename}`);
      
      return { success: true, errors };
      
    } catch (error) {
      const errorMsg = `Failed to sync frontmatter to Related list for ${this.file.basename}: ${error.message}`;
      loggingService.error(errorMsg);
      errors.push(errorMsg);
      return { success: false, errors };
    }
  }

  // === Markdown Template Operations ===

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

    return `---\n${stringifyYaml(frontmatter)}---\n#### Notes\n${myNote}\n${relatedSection}\n\n${hashtags} ${additionalTags}\n`;
  }

  // === Private Helper Methods ===

  private generateRelatedKey(
    genderlessType: string, 
    typeIndexes: Record<string, number>, 
    currentFrontmatter: Record<string, any>, 
    frontmatterUpdates: Record<string, string>
  ): string {
    const baseKey = `RELATED[${genderlessType}]`;
    let key = baseKey;
    
    if (currentFrontmatter[baseKey] || frontmatterUpdates[baseKey]) {
      if (!typeIndexes[genderlessType]) {
        typeIndexes[genderlessType] = 1;
      }
      key = `RELATED[${typeIndexes[genderlessType]}:${genderlessType}]`;
      typeIndexes[genderlessType]++;
    }
    
    while (currentFrontmatter[key] || frontmatterUpdates[key]) {
      if (!typeIndexes[genderlessType]) {
        typeIndexes[genderlessType] = 1;
      }
      key = `RELATED[${typeIndexes[genderlessType]}:${genderlessType}]`;
      typeIndexes[genderlessType]++;
    }
    
    return key;
  }

  private areRelationshipTypesEquivalent(type1: string, type2: string): boolean {
    if (type1 === type2) {
      return true;
    }
    
    const genderless1 = this.convertToGenderlessType(type1.toLowerCase());
    const genderless2 = this.convertToGenderlessType(type2.toLowerCase());
    
    return genderless1 === genderless2;
  }

  private groupVCardFields(record: Record<string, any>) {
    const nameKeys = ["N", "FN"];
    const priorityKeys = [
      "EMAIL", "TEL", "BDAY", "URL",
      "ORG", "TITLE", "ROLE", "PHOTO", "RELATED", "GENDER"
    ];
    const addressKeys = ["ADR"];

    const groups = {
      name: {} as Record<string, any>,
      priority: {} as Record<string, any>,
      address: {} as Record<string, any>,
      other: {} as Record<string, any>
    };

    for (const [key, value] of Object.entries(record)) {
      const baseKey = this.extractBaseKey(key);
      
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

  private extractBaseKey(key: string): string {
    if (key.includes("[")) {
      return key.split("[")[0];
    } else if (key.includes(".")) {
      return key.split(".")[0];
    }
    return key;
  }

  private sortNameItems(nameItems: Record<string, any>): Record<string, any> {
    return Object.fromEntries(
      Object.entries(nameItems).sort(([keyA], [keyB]) => {
        const order = ["N", "FN"];
        const indexA = order.indexOf(keyA.split('.')[0]);
        const indexB = order.indexOf(keyB.split('.')[0]);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
      })
    );
  }

  private sortedPriorityItems(priorityItems: Record<string, any>): Record<string, any> {
    return Object.fromEntries(
      Object.entries(priorityItems).sort(([keyA], [keyB]) => {
        const order = ["EMAIL", "TEL", "BDAY", "URL", "ORG", "TITLE", "ROLE", "PHOTO", "RELATED", "GENDER"];
        const indexA = order.indexOf(keyA.split('.')[0]);
        const indexB = order.indexOf(keyB.split('.')[0]);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
      })
    );
  }

  private generateRelatedList(record: Record<string, any>, genderLookup?: (contactRef: string) => Gender): string {
    const relatedFields = Object.entries(record).filter(([key]) => 
      this.extractBaseKey(key) === 'RELATED'
    );
    
    if (relatedFields.length === 0) {
      return '';
    }

    const relationships: { type: string; contact: string }[] = [];
    
    relatedFields.forEach(([key, value]) => {
      const typeMatch = key.match(/RELATED(?:\[(?:\d+:)?([^\]]+)\])?/);
      const type = typeMatch ? typeMatch[1] || 'related' : 'related';
      
      let contact = '';
      if (typeof value === 'string') {
        if (value.startsWith('urn:uuid:')) {
          contact = value.substring(9);
        } else if (value.startsWith('uid:')) {
          contact = value.substring(4);
        } else if (value.startsWith('name:')) {
          contact = value.substring(5);
        } else {
          contact = value;
        }
        
        // Apply gender lookup if provided
        let displayType = type;
        if (genderLookup) {
          const gender = genderLookup(contact);
          displayType = this.getGenderedRelationshipTerm(type, gender);
        }
        
        relationships.push({ type: displayType, contact });
      }
    });

    if (relationships.length === 0) {
      return '';
    }

    const relationshipList = relationships
      .map(rel => `- ${rel.type} [[${rel.contact}]]`)
      .join('\n');

    return `\n## Related\n${relationshipList}\n`;
  }
}

/**
 * Utility function to get frontmatter data from multiple files and create Contact objects
 * This is a static utility function that doesn't require a ContactNote instance
 */
export async function getFrontmatterFromFiles(files: TFile[]): Promise<Contact[]> {
  const { metadataCache } = getApp();
  const contactsData: Contact[] = [];
  for (const file of files) {
    const frontMatter = metadataCache.getFileCache(file)?.frontmatter;
    if ((frontMatter?.['N.GN'] && frontMatter?.['N.FN']) || frontMatter?.['FN']) {
      contactsData.push({
        file,
        data: frontMatter,
      });
    }
  }
  return contactsData;
}

/**
 * Utility function to parse a vCard property key in the format: key[index:type].subkey
 * This is a static utility function that doesn't require a ContactNote instance
 */
export function parseKey(input: string): ParsedKey {
  const extractSubkey = (input: string): { main: string; subkey?: string } => {
    const dotIndex = input.indexOf('.');
    if (dotIndex === -1) {
      return { main: input, subkey: '' };
    }
    return {
      main: input.substring(0, dotIndex),
      subkey: input.substring(dotIndex + 1)
    };
  };

  const parseBracketContent = (content: string): { index?: string; type?: string } => {
    if (content.includes(':')) {
      const [index, type] = content.split(':');
      return { index, type };
    }
    return { type: content };
  };

  const parseKeyPart = (main: string): { key: string; index?: string; type?: string } => {
    const openBracketIndex = main.indexOf('[');
    if (openBracketIndex === -1) {
      return { key: main };
    }

    const key = main.substring(0, openBracketIndex);
    const closeBracketIndex = main.indexOf(']', openBracketIndex);
    if (closeBracketIndex === -1) {
      throw new Error('Invalid vcard property key encountered please correct.');
    }

    const bracketContent = main.substring(openBracketIndex + 1, closeBracketIndex);
    const { index, type } = parseBracketContent(bracketContent);

    return { key, index, type };
  };

  const { main, subkey } = extractSubkey(input);
  const { key, index, type } = parseKeyPart(main);
  return { key, index, type, subkey };
}

/**
 * Utility function to render contact markdown from vCard record data
 * This is a static utility function that uses ContactNote internally
 */
export function mdRender(record: Record<string, any>, hashtags: string, genderLookup?: (contactRef: string) => Gender): string {
  // Create a temporary ContactNote instance just for the helper methods
  const tempContactNote = new ContactNote(getApp(), getSettings(), null as any);
  return tempContactNote.mdRender(record, hashtags, genderLookup);
}

// Name utility functions migrated from src/util/nameUtils.ts

/**
 * Doing our best for the user with minimal code to clean up the filename.
 */
function sanitizeFileName(input: string): string {
  const illegalRe = /[\/\?<>\\:\*\|"]/g;
  const controlRe = /[\x00-\x1f\x80-\x9f]/g;
  const reservedRe = /^\.+$/;
  const windowsReservedRe = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
  const windowsTrailingRe = /[\. ]+$/;
  const multipleSpacesRe = /\s+/g;
  return input
    .replace(illegalRe, ' ')
    .replace(controlRe, ' ')
    .replace(reservedRe, ' ')
    .replace(windowsReservedRe, ' ')
    .replace(windowsTrailingRe, ' ')
    .replace(multipleSpacesRe, " ")
    .trim();
}

/**
 * Creates a name slug from vCard records. FN is a mandatory field in the spec so we fall back to that.
 * Migrated from src/util/nameUtils.ts
 */
export function createNameSlug(record: VCardForObsidianRecord): string {
  let fileName: string | undefined = undefined;
  if (isKind(record, VCardKinds.Individual)) {
    fileName = [
      record["N.PREFIX"],
      record["N.GN"],
      record["N.MN"],
      record["N.FN"],
      record["N.SUFFIX"],
    ]
      .map((part) => part?.trim())
      .filter((part) => part)
      .join(" ") || undefined;
  }

  if (!fileName && record["FN"]) {
    fileName = record["FN"];
  }

  if (!fileName) {
    throw new Error(`Failed to update, create file name due to missing FN property"`);
  }

  return sanitizeFileName(fileName);
}

/**
 * Get sort name for contact sorting
 * Migrated from src/util/nameUtils.ts
 */
export function getSortName(contact: VCardForObsidianRecord): string {
  if (isKind(contact, VCardKinds.Individual)) {
    const name = contact["N.GN"] + contact["N.FN"];
    if (!name) {
      return contact["FN"];
    }
    return name;
  }
  return contact["FN"];
}

/**
 * Convert input to UI-safe string
 * Migrated from src/util/nameUtils.ts
 */
export function uiSafeString(input: unknown): string | undefined {
  if (input === null || input === undefined) {
    return undefined;
  }

  if (typeof input === 'string') {
    return input.trim();
  } else if (typeof input === 'number' || input instanceof Date || typeof input === 'boolean') {
    return input.toString();
  } else {
    return undefined;
  }
}

/**
 * Get UI display name for contact
 * Migrated from src/util/nameUtils.ts
 */
export function getUiName(contact: VCardForObsidianRecord): string {
  if (isKind(contact, VCardKinds.Individual)) {
    const myName = [
      contact["N.PREFIX"],
      contact["N.GN"],
      contact["N.MN"],
      contact["N.FN"],
      contact["N.SUFFIX"]
    ]
      .map(uiSafeString)
      .filter((value) => value !== undefined)
      .join(' ');

    if (myName.length > 0) {
      return myName;
    }
  }
  return uiSafeString(contact["FN"]) || '';
}

/**
 * Check if record is of a specific kind
 * Migrated from src/util/nameUtils.ts
 */
export function isKind(record: VCardForObsidianRecord, kind: VCardKind): boolean {
  const myKind = record["KIND"] || VCardKinds.Individual;
  return myKind === kind;
}

// File utility functions migrated from src/file/file.ts

/**
 * Generate a unique ID from a file path
 * Migrated from src/file/file.ts
 */
export function fileId(file: TFile): string {
  let hash = 0;
  for (let i = 0; i < file.path.length; i++) {
    hash = (hash << 5) - hash + file.path.charCodeAt(i);
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(); // Ensure it's positive
}

/**
 * Create filename from contact records
 * Migrated from src/file/file.ts
 */
export function createFileName(records: Record<string, string>): string {
  const nameSlug = createNameSlug(records);

  if (!nameSlug) {
    console.error('No name found for record', records);
    throw new Error('No name found for record');
  }

  return nameSlug + '.md';
}

// Reciprocal relationship utilities migrated from src/util/reciprocalRelationships.ts

/**
 * Represents a missing reciprocal relationship
 */
export interface MissingReciprocal {
  /** Contact file that is missing the reciprocal */
  targetFile: TFile;
  /** Name of the target contact */
  targetName: string;
  /** The reciprocal relationship type that should be added */
  reciprocalType: string;
  /** Name of the source contact (the one with the original relationship) */
  sourceContactName: string;
}

/**
 * Result of checking reciprocal relationships
 */
export interface ReciprocalCheckResult {
  /** Whether all relationships have proper reciprocals */
  allReciprocalExists: boolean;
  /** List of missing reciprocal relationships */
  missingReciprocals: MissingReciprocal[];
  /** Any errors encountered during the check */
  errors: string[];
}

/**
 * Result of fixing missing reciprocal relationships
 */
export interface FixReciprocalResult {
  /** Whether all reciprocals were successfully fixed */
  success: boolean;
  /** Number of reciprocal relationships that were added */
  addedCount: number;
  /** Any errors encountered during the fix operation */
  errors: string[];
}

/**
 * Get the reciprocal relationship type for a given type
 * Migrated from src/util/reciprocalRelationships.ts
 */
export function getReciprocalRelationshipType(relationshipType: string): string | null {
  // Convert to genderless form for consistent mapping
  const tempContactNote = new ContactNote(getApp(), getSettings(), null as any);
  const genderlessType = tempContactNote.convertToGenderlessType(relationshipType.toLowerCase());
  
  const reciprocalMap: Record<string, string> = {
    'parent': 'child',
    'child': 'parent',
    'sibling': 'sibling',
    'spouse': 'spouse',
    'partner': 'partner',
    'friend': 'friend',
    'colleague': 'colleague',
    'relative': 'relative',
    'auncle': 'nibling',  // aunt/uncle -> nibling (niece/nephew)
    'nibling': 'auncle',  // nibling (niece/nephew) -> aunt/uncle
    'grandparent': 'grandchild',
    'grandchild': 'grandparent',
    'cousin': 'cousin'
  };
  
  return reciprocalMap[genderlessType] || null;
}

/**
 * Check if a relationship type is symmetric (has the same reciprocal)
 * Migrated from src/util/reciprocalRelationships.ts
 */
export function isSymmetricRelationship(relationshipType: string): boolean {
  const tempContactNote = new ContactNote(getApp(), getSettings(), null as any);
  const genderlessType = tempContactNote.convertToGenderlessType(relationshipType.toLowerCase());
  const symmetricTypes = ['sibling', 'spouse', 'partner', 'friend', 'colleague', 'relative', 'cousin'];
  return symmetricTypes.includes(genderlessType);
}

/**
 * Check if two relationship types are equivalent (considering gender variations)
 * Migrated from src/util/reciprocalRelationships.ts
 */
export function areRelationshipTypesEquivalent(type1: string, type2: string): boolean {
  if (type1 === type2) {
    return true;
  }
  
  const tempContactNote = new ContactNote(getApp(), getSettings(), null as any);
  const genderless1 = tempContactNote.convertToGenderlessType(type1.toLowerCase());
  const genderless2 = tempContactNote.convertToGenderlessType(type2.toLowerCase());
  
  return genderless1 === genderless2;
}

// For now, re-export the complex reciprocal relationship functions
// These will be fully migrated in a future refactoring
export { 
  findMissingReciprocalRelationships, 
  fixMissingReciprocalRelationships 
} from '../util/reciprocalRelationships';