/**
 * @fileoverview Interface definitions for ContactNote module classes
 * 
 * This module provides TypeScript interfaces that define the contracts
 * for contact note-related classes. These interfaces improve code intelligence,
 * enable better IDE support, and make testing easier by allowing mock
 * implementations.
 * 
 * @module ContactNoteInterfaces
 */

import { TFile, App } from 'obsidian';
import { ContactsPluginSettings } from '../settings/settings.d';
import { VCardForObsidianRecord } from '../vcardFile';
import { Gender, Contact, ParsedKey, ParsedRelationship, FrontmatterRelationship, ResolvedContact } from './types';

/**
 * Interface for ContactNote operations.
 * Defines the contract for classes that handle individual contact note operations.
 * 
 * @interface IContactNote
 */
export interface IContactNote {
  // === Core File Operations ===
  
  /**
   * Get the TFile object for this contact.
   * @returns The Obsidian TFile reference
   */
  getFile(): TFile;

  /**
   * Get the UID for this contact.
   * @returns Promise resolving to UID string or null if not found
   */
  getUID(): Promise<string | null>;

  /**
   * Get the display name for this contact.
   * @returns The contact's display name
   */
  getDisplayName(): string;

  /**
   * Get the raw file content.
   * @returns Promise resolving to file content string
   */
  getContent(): Promise<string>;

  /**
   * Get the parsed frontmatter data.
   * @returns Promise resolving to frontmatter object or null
   */
  getFrontmatter(): Promise<Record<string, any> | null>;

  /**
   * Invalidate all internal caches.
   */
  invalidateCache(): void;

  // === Gender Operations ===

  /**
   * Parse a gender value from string to standardized Gender type.
   * @param value - Raw gender value to parse
   * @returns Standardized Gender type
   */
  parseGender(value: string): Gender;

  /**
   * Get the gender for this contact.
   * @returns Promise resolving to Gender type
   */
  getGender(): Promise<Gender>;

  /**
   * Update the gender for this contact.
   * @param gender - New gender value
   * @returns Promise that resolves when gender is updated
   */
  updateGender(gender: Gender): Promise<void>;

  // === Frontmatter Operations ===

  /**
   * Update a single frontmatter value.
   * @param key - Frontmatter key to update
   * @param value - New value for the key
   * @returns Promise that resolves when value is updated
   */
  updateFrontmatterValue(key: string, value: string): Promise<void>;

  /**
   * Update multiple frontmatter values at once.
   * @param updates - Object containing key-value pairs to update
   * @returns Promise that resolves when all values are updated
   */
  updateMultipleFrontmatterValues(updates: Record<string, string>): Promise<void>;

  // === Relationship Operations ===

  /**
   * Parse relationships from the Related markdown section.
   * @returns Promise resolving to array of parsed relationships
   */
  parseRelatedSection(): Promise<ParsedRelationship[]>;

  /**
   * Parse relationships from frontmatter RELATED fields.
   * @returns Promise resolving to array of frontmatter relationships
   */
  parseFrontmatterRelationships(): Promise<FrontmatterRelationship[]>;

  /**
   * Update the Related section in the markdown content.
   * @param relationships - Array of relationships to write
   * @returns Promise that resolves when content is updated
   */
  updateRelatedSectionInContent(relationships: { type: string; contactName: string }[]): Promise<void>;

  /**
   * Find a contact file by name.
   * @param contactName - Name of the contact to find
   * @returns Promise resolving to TFile or null if not found
   */
  findContactByName(contactName: string): Promise<TFile | null>;

  /**
   * Resolve a contact reference to complete contact information.
   * @param contactName - Name or reference of the contact to resolve
   * @returns Promise resolving to ResolvedContact or null if not found
   */
  resolveContact(contactName: string): Promise<ResolvedContact | null>;

  /**
   * Format a relationship value for frontmatter storage.
   * @param targetUid - UID of the target contact
   * @param targetName - Name of the target contact
   * @returns Formatted relationship value string
   */
  formatRelatedValue(targetUid: string, targetName: string): string;

  /**
   * Infer gender from a relationship type.
   * @param relationshipType - Type of relationship (spouse, parent, etc.)
   * @returns Inferred Gender or null if not determinable
   */
  inferGenderFromRelationship(relationshipType: string): Gender | null;

  // === Markdown Operations ===

  /**
   * Render contact data as markdown content.
   * @param record - Contact data record
   * @param hashtags - Hashtags to include
   * @param genderLookup - Optional function to look up gender for contacts
   * @returns Rendered markdown string
   */
  mdRender(record: Record<string, any>, hashtags: string, genderLookup?: (contactRef: string) => Gender): string;

  /**
   * Update the contact file with new content.
   * @param content - New content for the file
   * @returns Promise that resolves when content is updated
   */
  updateContent(content: string): Promise<void>;

  // === Synchronization Operations ===

  /**
   * Synchronize frontmatter to the Related list section.
   * @returns Promise resolving to sync result with success status and errors
   */
  syncFrontmatterToRelatedList(): Promise<{ success: boolean; errors: string[] }>;

  /**
   * Synchronize Related list section to frontmatter.
   * @returns Promise resolving to sync result with success status and errors
   */
  syncRelatedListToFrontmatter(): Promise<{ success: boolean; errors: string[] }>;

  /**
   * Synchronize contact data from VCard record.
   * @param vcardData - VCard data to sync from
   * @returns Promise resolving to sync result with success status and changes
   */
  syncFromVcardData(vcardData: Record<string, any>): Promise<{ success: boolean; changes: string[] }>;

  /**
   * Generate VCard data from contact.
   * @returns VCard data object
   */
  generateVcardData(): Record<string, any>;

  // === Utility Operations ===

  /**
   * Get cache status information.
   * @returns Object with cache status for different data types
   */
  getCacheStatus(): { [key: string]: boolean };

  /**
   * Generate a revision timestamp.
   * @returns ISO timestamp string formatted for VCard REV field
   */
  generateRevTimestamp(): string;

  /**
   * Check if contact should be updated from VCF data based on revision timestamps.
   * @param record - VCard record to compare against
   * @returns Promise resolving to true if update should proceed
   */
  shouldUpdateFromVCF(record: Record<string, any>): Promise<boolean>;
}

/**
 * Interface for ContactData operations.
 * Defines the contract for classes that handle centralized contact data management.
 * 
 * @interface IContactData
 */
export interface IContactData {
  /**
   * Get the TFile object for this contact.
   * @returns The Obsidian TFile reference
   */
  getFile(): TFile;

  /**
   * Get the UID for this contact.
   * @returns Promise resolving to UID string or null if not found
   */
  getUID(): Promise<string | null>;

  /**
   * Get the display name for this contact.
   * @returns The contact's display name
   */
  getDisplayName(): string;

  /**
   * Get the raw file content.
   * @returns Promise resolving to file content string
   */
  getContent(): Promise<string>;

  /**
   * Get the parsed frontmatter data.
   * @returns Promise resolving to frontmatter object or null
   */
  getFrontmatter(): Promise<Record<string, any> | null>;

  /**
   * Get the gender for this contact.
   * @returns Promise resolving to Gender type
   */
  getGender(): Promise<Gender>;

  /**
   * Update the gender for this contact.
   * @param gender - New gender value
   * @returns Promise that resolves when gender is updated
   */
  updateGender(gender: Gender): Promise<void>;

  /**
   * Update a single frontmatter value.
   * @param key - Frontmatter key to update
   * @param value - New value for the key
   * @returns Promise that resolves when value is updated
   */
  updateFrontmatterValue(key: string, value: string): Promise<void>;

  /**
   * Update multiple frontmatter values at once.
   * @param updates - Object containing key-value pairs to update
   * @returns Promise that resolves when all values are updated
   */
  updateMultipleFrontmatterValues(updates: Record<string, string>): Promise<void>;

  /**
   * Invalidate all internal caches.
   */
  invalidateAllCaches(): void;

  /**
   * Get cache status information.
   * @returns Object with cache status for different data types
   */
  getCacheStatus(): { [key: string]: boolean };
}

/**
 * Interface for relationship operations.
 * Defines the contract for classes that handle contact relationship management.
 * 
 * @interface IRelationshipOperations
 */
export interface IRelationshipOperations {
  /**
   * Parse relationships from the Related markdown section.
   * @returns Promise resolving to array of parsed relationships
   */
  parseRelatedSection(): Promise<ParsedRelationship[]>;

  /**
   * Parse relationships from frontmatter RELATED fields.
   * @returns Promise resolving to array of frontmatter relationships
   */
  parseFrontmatterRelationships(): Promise<FrontmatterRelationship[]>;

  /**
   * Update the Related section in the markdown content.
   * @param relationships - Array of relationships to write
   * @returns Promise that resolves when content is updated
   */
  updateRelatedSectionInContent(relationships: { type: string; contactName: string }[]): Promise<void>;

  /**
   * Find a contact file by name.
   * @param contactName - Name of the contact to find
   * @returns Promise resolving to TFile or null if not found
   */
  findContactByName(contactName: string): Promise<TFile | null>;

  /**
   * Resolve a contact reference to complete contact information.
   * @param contactName - Name or reference of the contact to resolve
   * @returns Promise resolving to ResolvedContact or null if not found
   */
  resolveContact(contactName: string): Promise<ResolvedContact | null>;

  /**
   * Format a relationship value for frontmatter storage.
   * @param targetUid - UID of the target contact
   * @param targetName - Name of the target contact
   * @returns Formatted relationship value string
   */
  formatRelatedValue(targetUid: string, targetName: string): string;

  /**
   * Infer gender from a relationship type.
   * @param relationshipType - Type of relationship (spouse, parent, etc.)
   * @returns Inferred Gender or null if not determinable
   */
  inferGenderFromRelationship(relationshipType: string): Gender | null;
}

/**
 * Interface for markdown operations.
 * Defines the contract for classes that handle markdown rendering and content updates.
 * 
 * @interface IMarkdownOperations
 */
export interface IMarkdownOperations {
  /**
   * Render contact data as markdown content.
   * @param record - Contact data record
   * @param hashtags - Hashtags to include
   * @param genderLookup - Optional function to look up gender for contacts
   * @returns Rendered markdown string
   */
  mdRender(record: Record<string, any>, hashtags: string, genderLookup?: (contactRef: string) => Gender): string;

  /**
   * Update the contact file with new content.
   * @param content - New content for the file
   * @returns Promise that resolves when content is updated
   */
  updateContent(content: string): Promise<void>;
}

/**
 * Interface for synchronization operations.
 * Defines the contract for classes that handle contact data synchronization.
 * 
 * @interface ISyncOperations
 */
export interface ISyncOperations {
  /**
   * Synchronize frontmatter to the Related list section.
   * @returns Promise resolving to sync result with success status and errors
   */
  syncFrontmatterToRelatedList(): Promise<{ success: boolean; errors: string[] }>;

  /**
   * Synchronize Related list section to frontmatter.
   * @returns Promise resolving to sync result with success status and errors
   */
  syncRelatedListToFrontmatter(): Promise<{ success: boolean; errors: string[] }>;

  /**
   * Synchronize contact data from VCard record.
   * @param vcardData - VCard data to sync from
   * @returns Promise resolving to sync result with success status and changes
   */
  syncFromVcardData(vcardData: Record<string, any>): Promise<{ success: boolean; changes: string[] }>;

  /**
   * Generate VCard data from contact.
   * @returns VCard data object
   */
  generateVcardData(): Record<string, any>;
}

// Re-export types for convenience
export type { Gender, Contact, ParsedKey, ParsedRelationship, FrontmatterRelationship, ResolvedContact };