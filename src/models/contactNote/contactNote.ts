/**
 * Optimized ContactNote class with improved data locality.
 * Groups methods close to the data they operate on for better cache performance.
 */

import { TFile, App } from 'obsidian';
import { ContactsPluginSettings } from '../../settings/settings.d';
import { VCardForObsidianRecord, VCardKind, VCardKinds } from '../vcardFile';
import { Gender, Contact, ParsedKey, ParsedRelationship, FrontmatterRelationship, ResolvedContact } from './types';

// Import the optimized components
import { ContactData } from './contactData';
import { RelationshipOperations } from './relationshipOperations';
import { MarkdownOperations } from './markdownOperations';
import { SyncOperations } from './syncOperations';

// Re-export types for backward compatibility and external use
export type { Contact, ParsedKey, Gender, ParsedRelationship, FrontmatterRelationship, ResolvedContact };

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

  constructor(app: App, settings: ContactsPluginSettings, file: TFile) {
    this.app = app;
    this.settings = settings;
    
    // Initialize centralized data store
    this.contactData = new ContactData(app, file);
    
    // Initialize operation groups that work with the centralized data
    this.relationshipOps = new RelationshipOperations(this.contactData);
    this.markdownOps = new MarkdownOperations(this.contactData);
    this.syncOps = new SyncOperations(this.contactData, this.relationshipOps);
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
  async updateFrontmatterValue(key: string, value: string): Promise<void> {
    return this.contactData.updateFrontmatterValue(key, value);
  }

  /**
   * Update multiple frontmatter values in a single operation
   */
  async updateMultipleFrontmatterValues(updates: Record<string, string>): Promise<void> {
    return this.contactData.updateMultipleFrontmatterValues(updates);
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
  async findContactByName(contactName: string): Promise<TFile | null> {
    return this.relationshipOps.findContactByName(contactName);
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

  /**
   * Extract specific sections from markdown content
   */
  async extractMarkdownSections(): Promise<Map<string, string>> {
    return this.markdownOps.extractMarkdownSections();
  }

  /**
   * Update a specific section in the markdown content
   */
  async updateMarkdownSection(sectionName: string, newContent: string): Promise<void> {
    return this.markdownOps.updateMarkdownSection(sectionName, newContent);
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
  async syncFrontmatterToRelatedList(): Promise<{ success: boolean; errors: string[] }> {
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
    
    const result = [];
    
    // Process markdown relationships
    for (const rel of relationships) {
      const resolved = await this.resolveContact(rel.contactName);
      result.push({
        type: rel.type,
        contactName: rel.contactName,
        targetUID: resolved?.uid,
        linkType: resolved?.uid ? 'uid' : 'name',
        originalType: rel.originalType
      });
    }
    
    // Process frontmatter relationships that may have UIDs
    for (const fmRel of frontmatterRelationships) {
      if (fmRel.parsedValue.type === 'uid') {
        const contactName = await this.resolveContactNameByUID(fmRel.parsedValue.value);
        if (contactName) {
          result.push({
            type: fmRel.genderlessType,
            contactName,
            targetUID: fmRel.parsedValue.value,
            linkType: 'uid',
            originalType: fmRel.genderlessType
          });
        }
      }
    }
    
    return result;
  }

  /**
   * Resolve a contact by UID
   */
  async resolveContactByUID(uid: string): Promise<TFile | null> {
    const allFiles = this.app.vault.getMarkdownFiles();
    
    for (const file of allFiles) {
      if (!file.path.startsWith(this.settings.contactsFolder)) continue;
      
      const cache = this.app.metadataCache.getFileCache(file);
      if (cache?.frontmatter?.UID === uid) {
        return file;
      }
    }
    
    return null;
  }

  /**
   * Resolve contact name by UID
   */
  async resolveContactNameByUID(uid: string): Promise<string | null> {
    const file = await this.resolveContactByUID(uid);
    if (!file) return null;
    
    const cache = this.app.metadataCache.getFileCache(file);
    return cache?.frontmatter?.FN || file.basename;
  }

  /**
   * Resolve relationship target (by UID or name)
   */
  async resolveRelationshipTarget(identifier: string): Promise<{
    file: TFile | null;
    type: 'uid' | 'name';
    contactName: string;
  } | null> {
    // Check if it's a UID format
    if (identifier.startsWith('urn:uuid:') || ContactNote.isValidUID(identifier)) {
      const file = await this.resolveContactByUID(identifier);
      if (file) {
        const cache = this.app.metadataCache.getFileCache(file);
        const contactName = cache?.frontmatter?.FN || file.basename;
        return { file, type: 'uid', contactName };
      }
    }
    
    // Fall back to name resolution
    const file = await this.findContactByName(identifier);
    if (file) {
      return { file, type: 'name', contactName: identifier };
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
      error?: string;
    }>;
    errors: string[];
  }> {
    const result = {
      success: true,
      processedRelationships: [],
      errors: []
    };

    try {
      const relationships = await this.parseRelatedSection();
      const sourceContactName = this.getDisplayName();
      
      for (const relationship of relationships) {
        const reverseType = this.getReciprocalRelationshipType(relationship.type);
        if (!reverseType) continue;
        
        const targetFile = await this.findContactByName(relationship.contactName);
        if (!targetFile) {
          result.processedRelationships.push({
            targetContact: relationship.contactName,
            reverseType,
            added: false,
            error: 'Target contact not found'
          });
          continue;
        }

        // Check if reverse relationship already exists
        const targetContact = new ContactNote(this.app, this.settings, targetFile);
        const targetRelationships = await targetContact.parseRelatedSection();
        
        const reverseExists = targetRelationships.some(rel => 
          rel.contactName === sourceContactName && 
          this.areRelationshipTypesEquivalent(rel.type, reverseType)
        );

        if (!reverseExists) {
          // Add reverse relationship
          const newRelationships = [...targetRelationships, {
            type: reverseType,
            contactName: sourceContactName,
            originalType: reverseType
          }];
          
          await targetContact.updateRelatedSectionInContent(newRelationships);
          
          result.processedRelationships.push({
            targetContact: relationship.contactName,
            reverseType,
            added: true
          });
        } else {
          result.processedRelationships.push({
            targetContact: relationship.contactName,
            reverseType,
            added: false
          });
        }
      }
    } catch (error) {
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
    upgraded: number;
    errors: string[];
  }> {
    const result = { success: true, upgraded: 0, errors: [] };

    try {
      const frontmatter = await this.getFrontmatter();
      if (!frontmatter) return result;

      const updates: Record<string, string> = {};
      
      for (const [key, value] of Object.entries(frontmatter)) {
        if (key.startsWith('RELATED[') && typeof value === 'string') {
          // Check if it's currently name-based
          if (!value.startsWith('urn:uuid:') && !ContactNote.isValidUID(value)) {
            const targetFile = await this.findContactByName(value);
            if (targetFile) {
              const targetCache = this.app.metadataCache.getFileCache(targetFile);
              const targetUID = targetCache?.frontmatter?.UID;
              
              if (targetUID) {
                updates[key] = targetUID;
                result.upgraded++;
              }
            }
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        await this.updateMultipleFrontmatterValues(updates);
      }
    } catch (error) {
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
    const result = { hasConflicts: false, conflicts: [] };
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
  async updateRelationshipUID(oldUID: string, newUID: string): Promise<boolean> {
    try {
      const frontmatter = await this.getFrontmatter();
      if (!frontmatter) return false;

      const updates: Record<string, string> = {};
      let hasUpdates = false;

      for (const [key, value] of Object.entries(frontmatter)) {
        if (key.startsWith('RELATED[') && value === oldUID) {
          updates[key] = newUID;
          hasUpdates = true;
        }
      }

      if (hasUpdates) {
        await this.updateMultipleFrontmatterValues(updates);
        return true;
      }
    } catch (error) {
      console.error(`Error updating relationship UID: ${error.message}`);
    }
    
    return false;
  }

  /**
   * Bulk update relationship UIDs
   */
  async bulkUpdateRelationshipUIDs(uidMappings: Record<string, string>): Promise<{
    success: boolean;
    updated: number;
    errors: string[];
  }> {
    const result = { success: true, updated: 0, errors: [] };
    
    try {
      const frontmatter = await this.getFrontmatter();
      if (!frontmatter) return result;

      const updates: Record<string, string> = {};

      for (const [key, value] of Object.entries(frontmatter)) {
        if (key.startsWith('RELATED[') && typeof value === 'string') {
          const newUID = uidMappings[value];
          if (newUID && newUID !== value) {
            updates[key] = newUID;
            result.updated++;
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        await this.updateMultipleFrontmatterValues(updates);
      }
    } catch (error) {
      result.success = false;
      result.errors.push(`Error in bulk update: ${error.message}`);
    }

    return result;
  }

  // === Helper Methods for Relationship Operations ===

  /**
   * Get reciprocal relationship type
   */
  private getReciprocalRelationshipType(relationshipType: string): string | null {
    const reciprocalMap: Record<string, string> = {
      'father': 'child',
      'mother': 'child', 
      'parent': 'child',
      'son': 'parent',
      'daughter': 'parent',
      'child': 'parent',
      'brother': 'sibling',
      'sister': 'sibling',
      'sibling': 'sibling',
      'spouse': 'spouse',
      'husband': 'wife',
      'wife': 'husband',
      'friend': 'friend',
      'colleague': 'colleague',
      'manager': 'employee',
      'employee': 'manager',
      'mentor': 'mentee',
      'mentee': 'mentor'
    };
    
    return reciprocalMap[relationshipType.toLowerCase()] || null;
  }

  /**
   * Check if two relationship types are equivalent
   */
  private areRelationshipTypesEquivalent(type1: string, type2: string): boolean {
    const genderless1 = this.convertToGenderlessType(type1);
    const genderless2 = this.convertToGenderlessType(type2);
    return genderless1 === genderless2;
  }

  // === Static Utility Methods ===

  /**
   * Validate UID format
   */
  static isValidUID(uid: string): boolean {
    if (!uid || typeof uid !== 'string') return false;
    
    // Check for urn:uuid: format
    if (uid.startsWith('urn:uuid:')) {
      const uuidPart = uid.slice(9);
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuidPart);
    }
    
    // Check for direct UUID format
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uid)) {
      return true;
    }
    
    // Allow other valid UID formats (alphanumeric with dashes, at least 3 chars)
    return /^[a-zA-Z0-9\-_.]{3,}$/.test(uid);
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
    return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  }

  /**
   * Check if contact should be updated from VCF based on REV timestamp
   */
  async shouldUpdateFromVCF(record: Record<string, any>): Promise<boolean> {
    const frontmatter = await this.getFrontmatter();
    if (!frontmatter) return true;

    const contactRev = frontmatter.REV;
    const vcfRev = record.REV;

    // If either timestamp is missing, allow update
    if (!contactRev || !vcfRev) return true;

    // Compare timestamps - allow update if VCF is newer
    try {
      const contactTime = new Date(contactRev).getTime();
      const vcfTime = new Date(vcfRev).getTime();
      return vcfTime > contactTime;
    } catch {
      // If timestamp parsing fails, allow update
      return true;
    }
  }
}

// === Standalone Utility Functions (for backward compatibility) ===

/**
 * Parse a frontmatter key into its components
 */
export function parseKey(key: string): ParsedKey {
  const match = key.match(/^([^[]+)(?:\[([^\]]*)\])?(?:\.(.+))?$/);
  if (!match) {
    return { key };
  }

  const [, baseKey, indexOrType, subkey] = match;
  
  // Check if the bracket contains a number (index) or type
  let index: string | undefined;
  let type: string | undefined;
  
  if (indexOrType) {
    if (indexOrType.includes(':')) {
      [index, type] = indexOrType.split(':', 2);
    } else if (/^\d+$/.test(indexOrType)) {
      index = indexOrType;
    } else {
      type = indexOrType;
    }
  }

  return {
    key: baseKey,
    index,
    type,
    subkey
  };
}

/**
 * Render markdown from vCard record data (standalone function for compatibility)
 */
export function mdRender(record: Record<string, any>, hashtags: string, genderLookup?: (contactRef: string) => Gender): string {
  // Create a temporary ContactData for rendering
  const tempApp = require('obsidian').App;
  const tempFile = { basename: 'temp' } as TFile;
  const tempContactData = new ContactData(tempApp, tempFile);
  const markdownOps = new MarkdownOperations(tempContactData);
  
  return markdownOps.mdRender(record, hashtags, genderLookup);
}

// === Legacy Utility Functions ===

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
    throw new Error("No name found for record");
  }

  return sanitizeFileName(fileName);
}

export function createContactSlug(record: VCardForObsidianRecord): string {
  return createNameSlug(record);
}

export function isKind(record: VCardForObsidianRecord, kind: VCardKind): boolean {
  return record.KIND === kind || (!record.KIND && kind === VCardKinds.Individual);
}

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

// Additional utility functions for compatibility
export function fileId(file: TFile): string {
  return file.path.replace(/[^\w]/g, '_');
}

export function getUiName(contact: Contact): string {
  const frontmatter = contact.data;
  return frontmatter?.["N.GN"] + " " + frontmatter?.["N.FN"] || frontmatter?.["FN"] || contact.file.basename;
}

export function uiSafeString(input: string): string {
  return input.replace(/[<>&"]/g, (match) => {
    const escapeMap: Record<string, string> = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      '"': '&quot;'
    };
    return escapeMap[match];
  });
}

export function getSortName(contact: Contact): string {
  const frontmatter = contact.data;
  return frontmatter?.["N.FN"] + ", " + frontmatter?.["N.GN"] || frontmatter?.["FN"] || contact.file.basename;
}

export function createFileName(record: VCardForObsidianRecord): string {
  try {
    return createNameSlug(record) + '.md';
  } catch {
    return 'contact.md';
  }
}