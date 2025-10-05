/**
 * Optimized ContactNote class with improved data locality.
 * Groups methods close to the data they operate on for better cache performance.
 */

import { TFile, App } from 'obsidian';
import { ContactsPluginSettings } from 'src/plugin/settings';
import { Gender, Contact, ParsedRelationship, FrontmatterRelationship, ResolvedContact } from './types';

// Import the optimized components
import { ContactData } from './contactData';
import { RelationshipOperations } from './relationshipOperations';
import { MarkdownOperations } from './markdownOperations';
import { SyncOperations } from './syncOperations';
import { ValidationOperations } from './validationOperations';
import { AdvancedRelationshipOperations } from './advancedRelationshipOperations';
import { RelationshipHelpers } from './relationshipHelpers';

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
  private relationshipOps: RelationshipOperations;
  private markdownOps: MarkdownOperations;
  private syncOps: SyncOperations;
  private validationOps: ValidationOperations;
  private advancedRelationshipOps: AdvancedRelationshipOperations;
  private relationshipHelpers: RelationshipHelpers;

  constructor(app: App, settings: ContactsPluginSettings, file: TFile) {
    this.app = app;
    this.settings = settings;
    
    // Initialize centralized data store
    this.contactData = new ContactData(app, file);
    
    // Initialize operation groups that work with the centralized data
    this.relationshipOps = new RelationshipOperations(this.contactData);
    this.markdownOps = new MarkdownOperations(this.contactData);
    this.syncOps = new SyncOperations(this.contactData, this.relationshipOps);
    this.validationOps = new ValidationOperations(this.contactData);
    this.advancedRelationshipOps = new AdvancedRelationshipOperations(app, settings, this.contactData, this.relationshipOps);
    this.relationshipHelpers = new RelationshipHelpers();
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
   * Parse RELATED fields from frontmatter
   */
  async parseFrontmatterRelationships(): Promise<FrontmatterRelationship[]> {
    const frontmatter = await this.getFrontmatter();
    if (!frontmatter) return [];
    
    const relationships: FrontmatterRelationship[] = [];
    
    // Parse RELATED fields from frontmatter
    for (const [key, value] of Object.entries(frontmatter)) {
      if (key.startsWith('RELATED[')) {
        // Extract type from key: RELATED[spouse] -> spouse
        const typeMatch = key.match(/^RELATED\[([^\]]+)\]$/);
        if (typeMatch && typeof value === 'string') {
          const type = typeMatch[1];
          
          // Parse the value to determine if it's UID or name
          const parsedValue = this.parseRelatedValue(value);
          
          relationships.push({
            key,
            type,
            value,
            parsedValue: parsedValue || undefined
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
    
    // Convert simple relationship format to Relationship entities
    const relationshipEntities: Relationship[] = [];
    for (const rel of relationships) {
      const relType = RelationshipType.fromString(rel.type);
      const target = RelationshipReference.fromString(rel.contactName);
      relationshipEntities.push(Relationship.create(relType, target));
    }
    
    // Create RelatedSection from relationships
    const relatedSection = RelatedSection.fromRelationships(relationshipEntities, 'Related', 2);
    const sectionMarkdown = relatedSection.toMarkdown();
    
    // Find and replace the Related section if it exists
    const relatedSectionRegex = /^(#{2,4} Related\s*\n)([\s\S]*?)(?=\n#{2,4} |\n#\w+|$)/m;
    
    if (relatedSectionRegex.test(content)) {
      // Replace existing Related section
      const newContent = content.replace(relatedSectionRegex, sectionMarkdown + '\n');
      await this.contactData.updateContent(newContent);
    } else {
      // Add Related section before hashtags or at end
      const hashtagMatch = content.match(/\n(#\w+)/);
      let newContent: string;
      
      if (hashtagMatch) {
        // Insert before hashtags
        const insertPos = content.indexOf(hashtagMatch[0]);
        newContent = content.slice(0, insertPos) + `\n${sectionMarkdown}\n` + content.slice(insertPos);
      } else {
        // Add at end
        newContent = content + `\n\n${sectionMarkdown}\n`;
      }
      
      await this.contactData.updateContent(newContent);
    }
  }

  /**
   * Find contact by name in the contacts folder
   */
  /**
   * Find contact by name (override to handle test environment)
   */
  async findContactByName(contactName: string): Promise<TFile | null> {
    try {
      // First try the delegated method
      return this.relationshipOps.findContactByName(contactName);
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
    return this.relationshipOps.resolveContact(contactName);
  }

  /**
   * Format a related value for vCard RELATED field
   */
  formatRelatedValue(targetUid: string, targetName: string): string {
    // Format as UID reference: uid:xxx
    if (targetUid) {
      return `uid:${targetUid}`;
    }
    // Fallback to name
    return targetName;
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
    return this.markdownOps.mdRender(record, hashtags, genderLookup);
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
    return this.validationOps.validateRequiredFields();
  }

  /**
   * Validate email format
   */
  validateEmail(email: string): boolean {
    return this.validationOps.validateEmail(email);
  }

  /**
   * Validate phone number format
   */
  validatePhoneNumber(phone: string): boolean {
    return this.validationOps.validatePhoneNumber(phone);
  }

  /**
   * Validate date format
   */
  validateDate(dateStr: string): boolean {
    return this.validationOps.validateDate(dateStr);
  }

  /**
   * Sanitize user input to prevent XSS
   */
  sanitizeInput(input: string): string {
    return this.validationOps.sanitizeInput(input);
  }

  /**
   * Identify invalid frontmatter fields
   * Returns list of invalid fields with their values and reasons
   */
  async identifyInvalidFrontmatterFields(): Promise<{
    invalidFields: Array<{ key: string; value: string; reason: string }>;
    errors: string[];
  }> {
    return this.validationOps.identifyInvalidFrontmatterFields();
  }

  /**
   * Remove specified fields from frontmatter
   * Used after user confirmation
   */
  async removeFieldsFromFrontmatter(keysToRemove: string[]): Promise<{
    removed: string[];
    errors: string[];
  }> {
    return this.validationOps.removeFieldsFromFrontmatter(keysToRemove);
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
    return this.relationshipHelpers.getReciprocalRelationshipType(relationshipType, targetGender);
  }

  /**
   * Check if two relationship types are equivalent
   */
  private areRelationshipTypesEquivalent(type1: string, type2: string): boolean {
    return this.relationshipHelpers.areRelationshipTypesEquivalent(type1, type2, this.convertToGenderlessType.bind(this));
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