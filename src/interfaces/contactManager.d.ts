/**
 * @fileoverview Interface definitions for ContactManager module classes
 * 
 * This module provides TypeScript interfaces that define the contracts
 * for contact management-related classes. These interfaces improve code intelligence,
 * enable better IDE support, and make testing easier by allowing mock
 * implementations.
 * 
 * @module ContactManagerInterfaces
 */

import { TFile, App } from 'obsidian';
import { ContactsPluginSettings } from '../settings/settings.d';
import { Contact } from './contactNote';

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
   * Get the contacts folder path.
   * @returns The contacts folder path from settings
   */
  getContactsFolder(): string;

  /**
   * Add a contact file to the cache.
   * @param uid - The contact UID
   * @param file - The TFile to add to cache
   */
  addToCache(uid: string, file: TFile): void;

  /**
   * Remove a contact file from the cache.
   * @param uid - The UID of the contact to remove
   */
  removeFromCache(uid: string): void;

  /**
   * Update the cache when a file is renamed.
   * @param uid - The contact UID
   * @param newFile - The renamed TFile
   */
  updateCacheForRename(uid: string, newFile: TFile): void;

  /**
   * Set up event listeners for automatic syncing when navigating away from contact files.
   */
  setupEventListeners(): void;

  /**
   * Clean up event listeners.
   */
  cleanupEventListeners(): void;

  /**
   * Ensure consistency of contact data by processing through curator processors.
   * @param maxIterations - Maximum number of consistency check iterations
   * @returns Promise that resolves when consistency is ensured
   */
  ensureContactDataConsistency(maxIterations?: number): Promise<void>;

  /**
   * Update the settings reference.
   * @param settings - New settings object
   */
  updateSettings(settings: ContactsPluginSettings): void;

  /**
   * Get a contact by its file.
   * @param file - The TFile to get contact data for
   * @returns Promise resolving to Contact or null if not found
   */
  getContactByFile(file: TFile): Promise<Contact | null>;
}

/**
 * Interface for contact manager data operations.
 * Defines the contract for classes that handle contact data storage and caching.
 * 
 * @interface IContactManagerData
 */
export interface IContactManagerData {
  /**
   * Get the Obsidian App instance.
   * @returns The App instance
   */
  getApp(): App;

  /**
   * Get the plugin settings.
   * @returns The current settings
   */
  getSettings(): ContactsPluginSettings;

  /**
   * Update the settings reference.
   * @param settings - New settings object
   */
  updateSettings(settings: ContactsPluginSettings): void;

  /**
   * Get the contacts folder path.
   * @returns The contacts folder path
   */
  getContactsFolder(): string;

  /**
   * Get all contact files from the vault.
   * @returns Array of TFile objects
   */
  getAllContactFiles(): TFile[];

  /**
   * Check if a file is a contact file.
   * @param file - The TFile to check
   * @returns True if the file is a contact file
   */
  isContactFile(file: TFile): boolean;

  /**
   * Get the UID cache.
   * @returns Map of UIDs to TFiles
   */
  getUidCache(): Map<string, TFile>;

  /**
   * Clear the UID cache.
   */
  clearUidCache(): void;

  /**
   * Add entry to UID cache.
   * @param uid - The UID
   * @param file - The TFile
   */
  addToUidCache(uid: string, file: TFile): void;

  /**
   * Remove entry from UID cache.
   * @param uid - The UID to remove
   */
  removeFromUidCache(uid: string): void;
}

/**
 * Interface for contact consistency operations.
 * Defines the contract for classes that handle contact data consistency checks.
 * 
 * @interface IConsistencyOperations
 */
export interface IConsistencyOperations {
  /**
   * Ensure consistency of contact data by processing through curator processors.
   * @param maxIterations - Maximum number of consistency check iterations
   * @returns Promise that resolves when consistency is ensured
   */
  ensureContactDataConsistency(maxIterations?: number): Promise<void>;

  /**
   * Process contacts with curator service.
   * @param contacts - Array of contacts to process
   * @returns Promise that resolves when processing is complete
   */
  processContactsWithCurator(contacts: Contact[]): Promise<void>;
}

/**
 * Interface for contact manager utility operations.
 * Defines the contract for static utility functions used in contact management.
 * 
 * @interface IContactManagerUtils
 */
export interface IContactManagerUtils {
  /**
   * Create a contact file in the specified folder with the given content.
   * @param app - Obsidian App instance
   * @param folderPath - Path to the folder where the contact should be created
   * @param content - Content for the new contact file
   * @param filename - Name for the new contact file
   * @returns Promise that resolves when file is created
   */
  createContactFile(app: App, folderPath: string, content: string, filename: string): Promise<void>;

  /**
   * Handle file creation operations.
   * @param app - Obsidian App instance
   * @param content - File content
   * @param filePath - Path for the new file
   * @returns Promise that resolves when file is handled
   */
  handleFileCreation(app: App, content: string, filePath: string): Promise<void>;

  /**
   * Open a file in the Obsidian editor.
   * @param app - Obsidian App instance
   * @param file - The TFile to open
   * @returns Promise that resolves when file is opened
   */
  openFile(app: App, file: TFile): Promise<void>;

  /**
   * Open a newly created contact file.
   * @param app - Obsidian App instance
   * @param filePath - Path to the created file
   * @returns Promise that resolves when file is opened
   */
  openCreatedFile(app: App, filePath: string): Promise<void>;

  /**
   * Ensure a contact has a proper name field.
   * @param frontmatter - The contact frontmatter data
   * @returns Updated frontmatter with name field
   */
  ensureHasName(frontmatter: Record<string, any>): Record<string, any>;

  /**
   * Extract frontmatter from contact files.
   * @param contactFiles - Array of contact TFiles
   * @param app - Obsidian App instance
   * @returns Promise resolving to array of frontmatter objects
   */
  getFrontmatterFromFiles(contactFiles: TFile[], app: App): Promise<Record<string, any>[]>;
}