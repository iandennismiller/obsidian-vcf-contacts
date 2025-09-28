/**
 * Unified interface for interacting with a contact note in Obsidian.
 * Consolidates functionality from genderUtils, relatedFieldUtils, relatedListSync,
 * contactMdTemplate, revisionUtils, contactFrontmatter, and contactDataKeys.
 */

import { TFile, App } from 'obsidian';
import { ContactsPluginSettings } from '../settings/settings.d';
import { VCardForObsidianRecord, VCardKind, VCardKinds } from './vcardFile';
import { getApp } from '../context/sharedAppContext';
import { getSettings } from '../context/sharedSettingsContext';

// Import all the extracted classes and types
import {
  GenderOperations,
  Gender,
  FrontmatterOperations,
  parseKey,
  VaultOperations,
  ResolvedContact,
  MarkdownOperations,
  RelatedFieldOperations,
  RelatedListOperations,
  ParsedRelationship,
  FrontmatterRelationship,
  SyncOperations,
  NamingOperations
} from './contactNote/index';

export type Contact = {
  data: Record<string, any>;
  file: TFile;
}

// Re-export types that were previously exported from utility modules
export type { Gender } from './contactNote/index';

export interface ParsedKey {
  key: string;
  index?: string;
  type?: string;
  subkey?: string;
}

// Re-export interfaces from the extracted modules
export type { ParsedRelationship, ResolvedContact, FrontmatterRelationship } from './contactNote/index';

/**
 * Unified class for interacting with a contact note in Obsidian.
 * Provides methods for managing frontmatter, relationships, gender, and markdown rendering.
 */
export class ContactNote {
  private app: App;
  private settings: ContactsPluginSettings;
  private file: TFile;
  
  // Delegate classes
  private genderOps: GenderOperations;
  private frontmatterOps: FrontmatterOperations;
  private vaultOps: VaultOperations;
  private markdownOps: MarkdownOperations;
  private relatedFieldOps: RelatedFieldOperations;
  private relatedListOps: RelatedListOperations;
  private syncOps: SyncOperations;

  constructor(app: App, settings: ContactsPluginSettings, file: TFile) {
    this.app = app;
    this.settings = settings;
    this.file = file;
    
    // Initialize delegate classes
    this.genderOps = new GenderOperations();
    this.frontmatterOps = new FrontmatterOperations(app, file);
    this.vaultOps = new VaultOperations(app, settings, file);
    this.markdownOps = new MarkdownOperations(this.genderOps);
    this.relatedFieldOps = new RelatedFieldOperations();
    this.relatedListOps = new RelatedListOperations(
      app, 
      file, 
      this.vaultOps, 
      this.frontmatterOps, 
      this.genderOps,
      this.relatedFieldOps
    );
    this.syncOps = new SyncOperations(
      app,
      settings,
      file,
      this.genderOps,
      this.frontmatterOps,
      this.vaultOps,
      this.relatedFieldOps,
      this.relatedListOps
    );
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
    return this.vaultOps.getContent();
  }

  /**
   * Get the frontmatter, with caching
   */
  async getFrontmatter(): Promise<Record<string, any> | null> {
    return this.frontmatterOps.getFrontmatter();
  }

  /**
   * Invalidate caches when file is modified externally
   */
  invalidateCache(): void {
    this.frontmatterOps.invalidateCache();
    this.vaultOps.invalidateContentCache();
  }

  // === Gender Operations ===

  /**
   * Parse GENDER field value from vCard
   */
  parseGender(value: string): Gender {
    return this.genderOps.parseGender(value);
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
    return this.genderOps.getGenderedRelationshipTerm(relationshipType, contactGender);
  }

  /**
   * Infer gender from a gendered relationship term
   */
  inferGenderFromRelationship(relationshipType: string): Gender {
    return this.genderOps.inferGenderFromRelationship(relationshipType);
  }

  /**
   * Convert gendered relationship term to genderless equivalent
   */
  convertToGenderlessType(relationshipType: string): string {
    return this.genderOps.convertToGenderlessType(relationshipType);
  }

  // === Related Field Operations ===

  /**
   * Format a related value for vCard RELATED field
   */
  formatRelatedValue(targetUid: string, targetName: string): string {
    return this.relatedFieldOps.formatRelatedValue(targetUid, targetName);
  }

  /**
   * Parse a vCard RELATED value to extract UID or name
   */
  parseRelatedValue(value: string): { type: 'uuid' | 'uid' | 'name'; value: string } | null {
    return this.relatedFieldOps.parseRelatedValue(value);
  }

  /**
   * Extract relationship type from RELATED key format
   */
  extractRelationshipType(key: string): string {
    return this.relatedFieldOps.extractRelationshipType(key);
  }

  // === Frontmatter Operations ===

  /**
   * Update a single frontmatter value
   */
  async updateFrontmatterValue(key: string, value: string): Promise<void> {
    await this.frontmatterOps.updateFrontmatterValue(key, value);
  }

  /**
   * Update multiple frontmatter values in a single operation
   */
  async updateMultipleFrontmatterValues(updates: Record<string, string>): Promise<void> {
    await this.frontmatterOps.updateMultipleFrontmatterValues(updates);
  }

  // === Related List Parsing and Management ===

  /**
   * Parse Related section from markdown content
   */
  async parseRelatedSection(): Promise<ParsedRelationship[]> {
    return this.relatedListOps.parseRelatedSection();
  }

  /**
   * Parse RELATED fields from frontmatter
   */
  async parseFrontmatterRelationships(): Promise<FrontmatterRelationship[]> {
    return this.relatedListOps.parseFrontmatterRelationships();
  }

  /**
   * Update Related section in markdown content
   */
  async updateRelatedSectionInContent(relationships: { type: string; contactName: string }[]): Promise<void> {
    await this.relatedListOps.updateRelatedSectionInContent(relationships);
  }

  /**
   * Find contact by name in the contacts folder
   */
  async findContactByName(contactName: string): Promise<TFile | null> {
    return this.vaultOps.findContactByName(contactName);
  }

  /**
   * Resolve contact information from contact name
   */
  async resolveContact(contactName: string): Promise<ResolvedContact | null> {
    return this.vaultOps.resolveContact(contactName, this.genderOps);
  }

  // === Markdown Template Operations ===

  /**
   * Render the contact as markdown from vCard record data
   */
  mdRender(record: Record<string, any>, hashtags: string, genderLookup?: (contactRef: string) => Gender): string {
    return this.markdownOps.mdRender(record, hashtags, genderLookup);
  }

  // === Relationship Sync Operations ===

  /**
   * Sync Related list from markdown to frontmatter
   */
  async syncRelatedListToFrontmatter(): Promise<{ success: boolean; errors: string[] }> {
    return this.syncOps.syncRelatedListToFrontmatter();
  }

  /**
   * Sync frontmatter RELATED fields to Related list in markdown
   */
  async syncFrontmatterToRelatedList(): Promise<{ success: boolean; errors: string[] }> {
    return this.syncOps.syncFrontmatterToRelatedList();
  }
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

// Name utility functions - delegated to NamingOperations

/**
 * Creates a name slug from vCard records. FN is a mandatory field in the spec so we fall back to that.
 * Migrated from src/util/nameUtils.ts
 */
export function createNameSlug(record: VCardForObsidianRecord): string {
  return NamingOperations.createNameSlug(record);
}

/**
 * Creates a kebab-case slug from vCard records for use as identifiers
 */
export function createContactSlug(record: VCardForObsidianRecord): string {
  return NamingOperations.createContactSlug(record);
}

// Re-export utility functions that are now in extracted modules
export { parseKey } from './contactNote/index';

/**
 * Check if record is of a specific kind
 * Migrated from src/util/nameUtils.ts
 */
export function isKind(record: VCardForObsidianRecord, kind: VCardKind): boolean {
  return NamingOperations.isKind(record, kind);
}