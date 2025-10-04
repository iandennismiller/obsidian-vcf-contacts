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
import { ContactSectionOperations } from './contactSectionOperations';

// Import entities
import { UID } from './entities/valueObjects/UID';
import { Revision } from './entities/valueObjects/Revision';

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
  private contactSectionOps: ContactSectionOperations;

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
    this.contactSectionOps = new ContactSectionOperations(this.contactData, settings);
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

  // === Relationship Operations (delegated to RelationshipOperations) ===

  /**
   * Parse Related section from markdown content
   */
  async parseRelatedSection(): Promise<ParsedRelationship[]> {
    return this.relationshipOps.parseRelatedSection();
  }

  /**
   * Parse RELATED fields from frontmatter
   */
  async parseFrontmatterRelationships(): Promise<FrontmatterRelationship[]> {
    return this.relationshipOps.parseFrontmatterRelationships();
  }

  /**
   * Update Related section in markdown content
   */
  async updateRelatedSectionInContent(relationships: { type: string; contactName: string }[]): Promise<void> {
    return this.relationshipOps.updateRelatedSectionInContent(relationships);
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
    return this.relationshipOps.formatRelatedValue(targetUid, targetName);
  }

  /**
   * Parse a vCard RELATED value to extract UID or name
   */
  parseRelatedValue(value: string): { type: 'uuid' | 'uid' | 'name'; value: string } | null {
    return this.relationshipOps.parseRelatedValue(value);
  }

  /**
   * Extract relationship type from RELATED key format
   */
  extractRelationshipType(key: string): string {
    return this.relationshipOps.extractRelationshipType(key);
  }

  /**
   * Get the display term for a relationship based on the contact's gender
   */
  getGenderedRelationshipTerm(relationshipType: string, contactGender: Gender): string {
    return this.relationshipOps.getGenderedRelationshipTerm(relationshipType, contactGender);
  }

  /**
   * Infer gender from a gendered relationship term
   */
  inferGenderFromRelationship(relationshipType: string): Gender {
    return this.relationshipOps.inferGenderFromRelationship(relationshipType);
  }

  /**
   * Convert gendered relationship term to genderless equivalent
   */
  convertToGenderlessType(relationshipType: string): string {
    return this.relationshipOps.convertToGenderlessType(relationshipType);
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
   */
  async parseContactSection() {
    return this.contactSectionOps.parseContactSection();
  }

  /**
   * Generate Contact section markdown from frontmatter
   */
  async generateContactSection(): Promise<string> {
    return this.contactSectionOps.generateContactSection();
  }

  /**
   * Update Contact section in markdown content
   */
  async updateContactSectionInContent(contactSection: string): Promise<void> {
    return this.contactSectionOps.updateContactSectionInContent(contactSection);
  }

  /**
   * Validate contact fields
   */
  validateContactFields(fields: any[]): string[] {
    return this.contactSectionOps.validateContactFields(fields);
  }
}