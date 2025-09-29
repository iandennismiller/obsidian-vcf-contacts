/**
 * @fileoverview Interface definition for ContactNote class
 * 
 * Defines the contract for classes that handle individual contact note operations.
 * 
 * @module IContactNote
 */

import { TFile, App } from 'obsidian';
import { ContactsPluginSettings } from '../settings/settings.d';
import { VCardForObsidianRecord } from '../models/vcardFile';
import { Gender, Contact, ParsedKey, ParsedRelationship, FrontmatterRelationship, ResolvedContact } from './types';

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
   * Update the file content.
   * @param content - New content for the file
   * @returns Promise that resolves when content is updated
   */
  updateContent(content: string): Promise<void>;

  /**
   * Get the frontmatter data.
   * @returns Object containing frontmatter key-value pairs
   */
  getFrontmatter(): Record<string, any>;

  /**
   * Update a specific frontmatter value.
   * @param key - Frontmatter key to update
   * @param value - New value for the key
   * @returns Promise that resolves when update is complete
   */
  updateFrontmatterValue(key: string, value: any): Promise<void>;

  /**
   * Remove a frontmatter key.
   * @param key - Key to remove from frontmatter
   * @returns Promise that resolves when removal is complete
   */
  removeFrontmatterKey(key: string): Promise<void>;

  // === Gender Operations ===
  
  /**
   * Get the inferred gender for this contact.
   * @returns Promise resolving to Gender or null
   */
  getGender(): Promise<Gender | null>;

  /**
   * Set the gender for this contact.
   * @param gender - Gender to set
   * @returns Promise that resolves when gender is set
   */
  setGender(gender: Gender): Promise<void>;

  // === Relationship Operations ===
  
  /**
   * Get all relationships for this contact.
   * @returns Promise resolving to array of relationships
   */
  getRelationships(): Promise<FrontmatterRelationship[]>;

  /**
   * Add a relationship to this contact.
   * @param relationship - Relationship to add
   * @returns Promise that resolves when relationship is added
   */
  addRelationship(relationship: FrontmatterRelationship): Promise<void>;

  /**
   * Remove a relationship from this contact.
   * @param relationship - Relationship to remove
   * @returns Promise that resolves when relationship is removed
   */
  removeRelationship(relationship: FrontmatterRelationship): Promise<void>;

  /**
   * Update relationships list.
   * @param relationships - New relationships array
   * @returns Promise that resolves when relationships are updated
   */
  updateRelationships(relationships: FrontmatterRelationship[]): Promise<void>;

  // === VCard Integration ===
  
  /**
   * Get VCard data for this contact.
   * @returns Promise resolving to VCard data object
   */
  getVCardData(): Promise<VCardForObsidianRecord>;

  /**
   * Update contact from VCard data.
   * @param vcardData - VCard data to import
   * @returns Promise that resolves when import is complete
   */
  updateFromVCard(vcardData: VCardForObsidianRecord): Promise<void>;

  /**
   * Export contact to VCard format.
   * @returns Promise resolving to VCard string
   */
  exportToVCard(): Promise<string>;

  // === Utility Operations ===
  
  /**
   * Get the last modified date of the contact file.
   * @returns Promise resolving to Date object
   */
  getLastModified(): Promise<Date>;

  /**
   * Check if the contact has been modified since last sync.
   * @returns Promise resolving to boolean
   */
  hasBeenModified(): Promise<boolean>;

  /**
   * Mark the contact as synced.
   * @returns Promise that resolves when sync mark is set
   */
  markAsSynced(): Promise<void>;

  /**
   * Validate the contact data integrity.
   * @returns Promise resolving to validation results
   */
  validate(): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }>;

  /**
   * Get contact statistics.
   * @returns Object containing contact statistics
   */
  getStats(): {
    hasUID: boolean;
    hasGender: boolean;
    relationshipCount: number;
    frontmatterKeys: string[];
    contentLength: number;
  };
}