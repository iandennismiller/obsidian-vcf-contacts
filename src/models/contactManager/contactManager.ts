import { App, TFile } from 'obsidian';
import { ContactsPluginSettings } from '../../settings/settings.d';
import { ContactCache } from './contactCache';
import { ContactFileOperations } from './contactFileOperations';
import { ContactEventHandlers } from './contactEventHandlers';
import { ContactDataConsistency } from './contactDataConsistency';

/**
 * Interface for managing contact notes in the Obsidian vault.
 * Provides methods for contact file detection, UID management, and caching.
 */
export interface IContactManager {
  /**
   * Extract UID from a contact file
   */
  extractUIDFromFile(file: TFile): Promise<string | null>;

  /**
   * Find a contact file by its UID
   */
  findContactFileByUID(uid: string): Promise<TFile | null>;

  /**
   * Initialize the cache of existing contact UIDs
   */
  initializeCache(): Promise<void>;

  /**
   * Clear the internal cache
   */
  clearCache(): void;

  /**
   * Get all contact files from the vault
   */
  getAllContactFiles(): TFile[];

  /**
   * Check if a file is a contact file
   */
  isContactFile(file: TFile): boolean;

  /**
   * Get the contacts folder path
   */
  getContactsFolder(): string;

  /**
   * Add a contact file to the cache
   */
  addToCache(uid: string, file: TFile): void;

  /**
   * Remove a contact file from the cache
   */
  removeFromCache(uid: string): void;

  /**
   * Update the cache when a file is renamed
   */
  updateCacheForRename(uid: string, newFile: TFile): void;

  /**
   * Set up event listeners for automatic syncing when navigating away from contact files
   */
  setupEventListeners(): void;

  /**
   * Clean up event listeners
   */
  cleanupEventListeners(): void;

  /**
   * Ensure consistency of contact data by processing through insight processors
   */
  ensureContactDataConsistency(maxIterations?: number): Promise<void>;
}

/**
 * Manages the collection of contact notes in the Obsidian vault.
 * Provides an interface for contact file detection, UID management, and caching.
 * 
 * This class orchestrates multiple specialized components:
 * - ContactCache: Handles UID caching and mapping
 * - ContactFileOperations: Handles file operations and detection
 * - ContactEventHandlers: Manages workspace events
 * - ContactDataConsistency: Handles data consistency operations
 */
export class ContactManager implements IContactManager {
  private app: App;
  private settings: ContactsPluginSettings;
  private cache: ContactCache;
  private fileOperations: ContactFileOperations;
  private eventHandlers: ContactEventHandlers;
  private dataConsistency: ContactDataConsistency;

  constructor(app: App, settings: ContactsPluginSettings) {
    this.app = app;
    this.settings = settings;
    
    // Initialize components
    this.cache = new ContactCache(app, settings);
    this.fileOperations = new ContactFileOperations(app, settings, this.cache);
    this.eventHandlers = new ContactEventHandlers(app);
    this.dataConsistency = new ContactDataConsistency(app, settings);
  }

  /**
   * Update settings reference across all components
   */
  updateSettings(settings: ContactsPluginSettings): void {
    this.settings = settings;
    this.cache.updateSettings(settings);
    this.fileOperations.updateSettings(settings);
    this.dataConsistency.updateSettings(settings);
  }

  /**
   * Get the effective contacts folder path
   */
  getContactsFolder(): string {
    return this.fileOperations.getContactsFolder();
  }

  /**
   * Extract UID from a contact file
   */
  async extractUIDFromFile(file: TFile): Promise<string | null> {
    return this.fileOperations.extractUIDFromFile(file);
  }

  /**
   * Find a contact file by its UID
   */
  async findContactFileByUID(uid: string): Promise<TFile | null> {
    return this.fileOperations.findContactFileByUID(uid);
  }

  /**
   * Initialize the cache of existing contact UIDs
   */
  async initializeCache(): Promise<void> {
    return this.cache.initializeCache(this.extractUIDFromFile.bind(this));
  }

  /**
   * Clear the internal cache
   */
  clearCache(): void {
    this.cache.clearCache();
  }

  /**
   * Check if a UID exists in the cache
   */
  hasUID(uid: string): boolean {
    return this.cache.hasUID(uid);
  }

  /**
   * Get all contact files from the vault
   */
  getAllContactFiles(): TFile[] {
    return this.fileOperations.getAllContactFiles();
  }

  /**
   * Check if a file is a contact file
   */
  isContactFile(file: TFile): boolean {
    return this.fileOperations.isContactFile(file);
  }

  /**
   * Add a contact file to the cache
   */
  addToCache(uid: string, file: TFile): void {
    this.cache.addToCache(uid, file);
  }

  /**
   * Remove a contact file from the cache
   */
  removeFromCache(uid: string): void {
    this.cache.removeFromCache(uid);
  }

  /**
   * Update the cache when a file is renamed
   */
  updateCacheForRename(uid: string, newFile: TFile): void {
    this.cache.updateCacheForRename(uid, newFile);
  }

  /**
   * Get cache statistics for debugging
   */
  getCacheStats(): { uidCount: number; fileCount: number } {
    return this.cache.getCacheStats();
  }

  /**
   * Set up event listeners for automatic syncing when navigating away from contact files
   */
  setupEventListeners(): void {
    this.eventHandlers.setupEventListeners();
  }

  /**
   * Clean up event listeners
   */
  cleanupEventListeners(): void {
    this.eventHandlers.cleanupEventListeners();
  }

  /**
   * Get the currently active file
   */
  getCurrentActiveFile(): TFile | null {
    return this.eventHandlers.getCurrentActiveFile();
  }

  /**
   * Ensure consistency of contact data by processing through insight processors
   */
  async ensureContactDataConsistency(maxIterations?: number): Promise<void> {
    return this.dataConsistency.ensureContactDataConsistency(
      this.getAllContactFiles.bind(this),
      this.extractUIDFromFile.bind(this),
      maxIterations
    );
  }

  /**
   * Find all contact files in a folder
   */
  findContactFiles(contactsFolder: any): TFile[] {
    return this.fileOperations.findContactFiles(contactsFolder);
  }
}