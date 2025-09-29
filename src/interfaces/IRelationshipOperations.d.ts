/**
 * @fileoverview Interface definition for relationship operations
 * 
 * This module provides the TypeScript interface that defines the contract
 * for classes that handle contact relationship management.
 * 
 * @module IRelationshipOperations
 */

import { TFile } from 'obsidian';
import { Gender, ParsedRelationship, FrontmatterRelationship, ResolvedContact } from '../models/contactNote/types';

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