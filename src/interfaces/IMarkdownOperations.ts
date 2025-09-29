/**
 * @fileoverview Interface definition for markdown operations
 * 
 * This module provides the TypeScript interface that defines the contract
 * for classes that handle markdown rendering and content updates.
 * 
 * @module IMarkdownOperations
 */

import { Gender } from '../models/contactNote/types';

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