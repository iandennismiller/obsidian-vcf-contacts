/**
 * @fileoverview Interface definition for synchronization operations
 * 
 * This module provides the TypeScript interface that defines the contract
 * for classes that handle contact data synchronization.
 * 
 * @module ISyncOperations
 */

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