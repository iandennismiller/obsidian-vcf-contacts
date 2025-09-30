/**
 * @fileoverview Interface definition for ContactManager class
 * 
 * This module provides TypeScript interface that defines the contract
 * for contact management operations. This interface improves code intelligence,
 * enables better IDE support, and makes testing easier by allowing mock
 * implementations.
 * 
 * @module IContactManager
 */

import { TFile, App } from 'obsidian';
import { ContactsPluginSettings } from './ContactsPluginSettings';
import { Contact } from '../models/contactNote/types';

/**
 * Interface for managing contact notes in the Obsidian vault.
 * Defines the contract for classes that provide contact file detection, UID management, and caching.
 * 
 * @interface IContactManager
 */
export interface IContactManager {
  /**
   * Extract UID from a contact file.
   * @param file - The TFile to extract UID from
   * @returns Promise resolving to UID string or null if not found
   */
  extractUIDFromFile(file: TFile): Promise<string | null>;

  /**
   * Find a contact file by its UID.
   * @param uid - The UID to search for
   * @returns Promise resolving to TFile or null if not found
   */
  findContactFileByUID(uid: string): Promise<TFile | null>;

  /**
   * Initialize the cache of existing contact UIDs.
   * @returns Promise that resolves when cache is initialized
   */
  initializeCache(): Promise<void>;

  /**
   * Clear the internal cache.
   */
  clearCache(): void;

  /**
   * Get all contact files from the vault.
   * @returns Array of TFile objects for all contacts
   */
  getAllContactFiles(): TFile[];

  /**
   * Check if a file is a contact file.
   * @param file - The TFile to check
   * @returns True if the file is a contact file
   */
  isContactFile(file: TFile): boolean;

  /**
   * Get the contacts folder path from settings.
   * @returns The contacts folder path
   */
  getContactsFolder(): string;

  /**
   * Update the settings reference.
   * @param settings - New settings object
   */
  updateSettings(settings: ContactsPluginSettings): void;

  /**
   * Process a specific contact file to update its relationships.
   * @param file - The contact file to process
   * @returns Promise that resolves when processing is complete
   */
  processContactFile(file: TFile): Promise<void>;

  /**
   * Get contact information by UID.
   * @param uid - The UID to look up
   * @returns Promise resolving to Contact or null if not found
   */
  getContactByUID(uid: string): Promise<Contact | null>;

  /**
   * Get all contacts from the vault.
   * @returns Promise resolving to array of Contact objects
   */
  getAllContacts(): Promise<Contact[]>;

  /**
   * Refresh the contact cache.
   * @returns Promise that resolves when cache is refreshed
   */
  refreshCache(): Promise<void>;

  /**
   * Get contact statistics.
   * @returns Object containing various contact statistics
   */
  getContactStats(): {
    totalContacts: number;
    contactsWithUID: number;
    contactsWithoutUID: number;
    cacheSize: number;
  };

  /**
   * Validate contact data consistency.
   * @returns Promise resolving to validation results
   */
  validateContacts(): Promise<{
    valid: Contact[];
    invalid: { contact: Contact; errors: string[] }[];
  }>;

  /**
   * Setup event listeners for contact file changes.
   */
  setupEventListeners(): void;

  /**
   * Cleanup event listeners.
   */
  cleanupEventListeners(): void;

  /**
   * Handle file creation events.
   * @param file - The created file
   */
  onFileCreate(file: TFile): Promise<void>;

  /**
   * Handle file modification events.
   * @param file - The modified file
   */
  onFileModify(file: TFile): Promise<void>;

  /**
   * Handle file deletion events.
   * @param file - The deleted file
   */
  onFileDelete(file: TFile): Promise<void>;

  /**
   * Handle file rename events.
   * @param file - The renamed file
   * @param oldPath - The old file path
   */
  onFileRename(file: TFile, oldPath: string): Promise<void>;
}