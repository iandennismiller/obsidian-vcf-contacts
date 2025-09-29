/**
 * @fileoverview Interface definition for contact manager utility operations
 * 
 * This module provides the TypeScript interface that defines the contract
 * for static utility functions used in contact management.
 * 
 * @module IContactManagerUtils
 */

import { TFile, App } from 'obsidian';

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