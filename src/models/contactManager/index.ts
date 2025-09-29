/**
 * @fileoverview ContactManager module exports
 * 
 * This file provides a unified export interface for the contact management system.
 * It exports all classes, types, interfaces, and utilities needed for managing
 * contact notes in the Obsidian vault.
 * 
 * The implementation uses data locality principles for optimal performance and
 * provides comprehensive contact file detection, UID management, and caching.
 * 
 * @module ContactManager
 */

// ============================================================================
// Core Classes
// ============================================================================

export { 
  /** Optimized contact manager with improved data locality and caching */
  ContactManager 
} from './contactManager';

export type { 
  /** Interface defining the contract for contact management operations */
  IContactManager 
} from './contactManager';

export { 
  /** Centralized contact manager data with optimized caching */
  ContactManagerData 
} from './contactManagerData';

export { 
  /** Data consistency operations for maintaining contact integrity */
  ConsistencyOperations 
} from './consistencyOperations';

// ============================================================================
// Utility Functions
// ============================================================================

export { 
  /** Utility functions for contact management operations */
  ContactManagerUtils 
} from './contactManagerUtils';

// Re-export commonly used utility functions for convenience
import { ContactManagerUtils } from './contactManagerUtils';

/** Create a new contact file with the given data */
export const createContactFile = ContactManagerUtils.createContactFile;

/** Handle file creation operations */
export const handleFileCreation = ContactManagerUtils.handleFileCreation;

/** Open a file in the Obsidian editor */
export const openFile = ContactManagerUtils.openFile;

/** Open a newly created contact file */
export const openCreatedFile = ContactManagerUtils.openCreatedFile;

/** Ensure a contact has a proper name field */
export const ensureHasName = ContactManagerUtils.ensureHasName;

/** Extract frontmatter from contact files */
export const getFrontmatterFromFiles = ContactManagerUtils.getFrontmatterFromFiles;

// ============================================================================
// Interfaces
// ============================================================================

export * from '../contactManager.d';