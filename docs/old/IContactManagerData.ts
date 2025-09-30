/**
 * @fileoverview Interface definition for ContactManagerData class
 * 
 * Defines the contract for classes that handle contact data storage and caching.
 * 
 * @module IContactManagerData
 */

import { TFile, App } from 'obsidian';
import { ContactsPluginSettings } from './ContactsPluginSettings';

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