/**
 * Optimized ContactNote class with improved data locality.
 * Groups methods close to the data they operate on for better cache performance.
 */

import { TFile, App } from 'obsidian';
import { ContactsPluginSettings } from 'src/plugin/settings';
import { Gender, Contact, ParsedKey, ParsedRelationship, FrontmatterRelationship, ResolvedContact } from './types';

// Import the optimized components
import { ContactData } from './contactData';
import { RelationshipOperations } from './relationshipOperations';
import { MarkdownOperations } from './markdownOperations';
import { SyncOperations } from './syncOperations';
import { ValidationOperations } from './validationOperations';
import { RevisionOperations } from './revisionOperations';
import { UIDOperations } from './uidOperations';
import { AdvancedRelationshipOperations } from './advancedRelationshipOperations';
import { RelationshipHelpers } from './relationshipHelpers';
import { ContactSectionOperations } from './contactSectionOperations';

// Re-export types for backward compatibility and external use
export type { Contact, ParsedKey, Gender, ParsedRelationship, FrontmatterRelationship, ResolvedContact };

// Re-export utility functions
export { parseKey, mdRender, createNameSlug, createContactSlug, isKind, fileId, getUiName, uiSafeString, getSortName, createFileName } from './utilityFunctions';

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
  private revisionOps: RevisionOperations;
  private uidOps: UIDOperations;
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
    this.revisionOps = new RevisionOperations(this.contactData);
    this.uidOps = new UIDOperations(app, settings, this.contactData);
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
    return this.uidOps.resolveContactByUID(uid);
  }

  /**
   * Resolve contact file by UID - returns just the TFile
   */
  async resolveContactFileByUID(uid: string): Promise<TFile | null> {
    return this.uidOps.resolveContactFileByUID(uid);
  }

  /**
   * Resolve contact name by UID
   */
  async resolveContactNameByUID(uid: string): Promise<string | null> {
    return this.uidOps.resolveContactNameByUID(uid);
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
      UIDOperations.isValidUID,
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
    return this.uidOps.detectUIDConflicts();
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
    return this.uidOps.updateRelationshipUID(
      oldUID,
      newUID,
      this.parseRelatedValue.bind(this),
      this.formatRelatedValue.bind(this)
    );
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
    return this.uidOps.bulkUpdateRelationshipUIDs(
      uidMappings,
      this.parseRelatedValue.bind(this),
      this.formatRelatedValue.bind(this)
    );
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
    return UIDOperations.isValidUID(uid);
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
    return this.revisionOps.parseRevDate(revString);
  }

  /**
   * Check if contact should be updated from vcard based on REV timestamp
   */
  async shouldUpdateFromVcard(record: Record<string, any>): Promise<boolean> {
    return this.revisionOps.shouldUpdateFromVcard(record);
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