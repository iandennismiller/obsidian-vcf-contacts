/**
 * Unified interface for interacting with a contact note in Obsidian.
 * Consolidates functionality from genderUtils, relatedFieldUtils, relatedListSync,
 * contactMdTemplate, revisionUtils, contactFrontmatter, and contactDataKeys.
 */

import { TFile, App } from 'obsidian';
import { ContactsPluginSettings } from '../../settings/settings.d';
import { VCardForObsidianRecord, VCardKind, VCardKinds } from '../vcardFile';
import { getApp } from '../../context/sharedAppContext';
import { getSettings } from '../../context/sharedSettingsContext';

// Import all the extracted classes and types directly to avoid circular dependencies
import { GenderOperations, Gender } from './gender';
import { FrontmatterOperations, parseKey } from './frontmatter';
import { VaultOperations, ResolvedContact } from './vault';
import { MarkdownOperations } from './markdown';
import { RelatedFieldOperations } from './relatedField';
import { RelatedListOperations, ParsedRelationship, FrontmatterRelationship } from './relatedList';
import { SyncOperations } from './sync';
import { NamingOperations } from './naming';

export type Contact = {
  data: Record<string, any>;
  file: TFile;
}

// Re-export types that were previously exported from utility modules
export type { Gender };

export interface ParsedKey {
  key: string;
  index?: string;
  type?: string;
  subkey?: string;
}

// Re-export interfaces from the extracted modules
export type { ParsedRelationship, ResolvedContact, FrontmatterRelationship };

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

  // --- Revision / VCF helpers ---

  /**
   * Generate a REV timestamp string compatible with existing plugin format.
   * Example: 20250928T123456Z (no separators)
   */
  generateRevTimestamp(): string {
    return new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  }

  /**
   * Parse a REV timestamp string into a Date or null.
   */
  parseRevisionDate(value: string | null): Date | null {
    if (!value) return null;
    try {
      let normalized = value;
      // support YYYYMMDDTHHMMSSZ and ISO formats
      if (/^\d{8}T\d{6}Z?$/.test(value)) {
        // YYYYMMDDTHHMMSSZ -> YYYY-MM-DDTHH:MM:SSZ
        normalized = `${value.substring(0,4)}-${value.substring(4,6)}-${value.substring(6,8)}T${value.substring(9,11)}:${value.substring(11,13)}:${value.substring(13,15)}Z`;
      }
      const d = new Date(normalized);
      if (isNaN(d.getTime())) return null;
      return d;
    } catch (e) {
      return null;
    }
  }

  /**
   * Update the frontmatter REV timestamp for this contact
   */
  async updateRevTimestamp(): Promise<void> {
    const ts = this.generateRevTimestamp();
    await this.updateFrontmatterValue('REV', ts);
  }

  /**
   * Decide whether a contact should be updated from a VCF record based on REV timestamps.
   */
  async shouldUpdateFromVCF(record: Record<string, any>): Promise<boolean> {
    const vcfRev = record['REV'] || null;
    const currentFrontmatter = await this.getFrontmatter();
    const currentRev = currentFrontmatter?.REV || null;

    const vcfDate = this.parseRevisionDate(vcfRev);
    const currentDate = this.parseRevisionDate(currentRev);

    if (!vcfDate) return false;
    if (!currentDate) return true;
    return vcfDate.getTime() > currentDate.getTime();
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
export { parseKey };

/**
 * Check if record is of a specific kind
 * Migrated from src/util/nameUtils.ts
 */
export function isKind(record: VCardForObsidianRecord, kind: VCardKind): boolean {
  return NamingOperations.isKind(record, kind);
}

// --- UI / helper utilities ---

/**
 * Produce a DOM-friendly id for a contact file.
 * Uses the file.path but replaces slashes with `--` so it is a valid id.
 */
export function fileId(file: TFile): string {
  if (!file) return '';
  return `contact-${String(file.path).replace(/[\/]/g, '--')}`;
}

/**
 * Return a UI-friendly display name for a contact vCard data object.
 */
export function getUiName(data: Record<string, any>): string {
  if (!data) return '';
  if (data['FN']) return String(data['FN']);
  if (data['N.FN']) return String(data['N.FN']);

  const parts = [data['N.PREFIX'], data['N.GN'], data['N.MN'], data['N.FN'], data['N.SUFFIX']]
    .filter(Boolean)
    .map((p) => String(p).trim())
    .filter(Boolean);
  if (parts.length) return parts.join(' ');

  // Fallbacks
  if (data['ORG']) return String(data['ORG']);
  return '';
}

/**
 * Safely convert a value to a UI string or return undefined for missing values.
 */
export function uiSafeString(value: any): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) {
    const joined = value.map((v) => (v === undefined || v === null ? '' : String(v))).join(' ');
    return joined === '' ? undefined : joined;
  }
  const s = String(value).trim();
  return s === '' ? undefined : s;
}

/**
 * Get a stable sortable name string from vCard data.
 * Uses FN or N.FN where available and lowercases for consistent sorting.
 */
export function getSortName(data: Record<string, any>): string {
  if (!data) return '';
  const name = data['N.FN'] || data['FN'] || '';
  return String(name).toLowerCase();
}

/**
 * Create a filesystem-friendly file name for a new contact record.
 * Delegates to createNameSlug and appends `.md`.
 */
export function createFileName(record: any): string {
  try {
    const slug = createNameSlug(record as VCardForObsidianRecord);
    return `${slug}.md`;
  } catch (e) {
    // Fallback: a timestamp-based filename
    const fallback = `contact-${Date.now()}`;
    return `${fallback}.md`;
  }
}