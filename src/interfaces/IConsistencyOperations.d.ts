/**
 * @fileoverview Interface definition for contact consistency operations
 * 
 * This module provides the TypeScript interface that defines the contract
 * for classes that handle contact data consistency checks.
 * 
 * @module IConsistencyOperations
 */

import { Contact } from '../models/contactNote/types';

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