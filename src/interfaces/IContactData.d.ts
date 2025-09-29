/**
 * @fileoverview Interface definition for ContactData class
 * 
 * This module provides the TypeScript interface that defines the contract
 * for the ContactData class, which handles centralized contact data management.
 * 
 * @module IContactData
 */

import { TFile } from 'obsidian';
import { Gender } from '../models/contactNote/types';

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