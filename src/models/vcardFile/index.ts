/**
 * @fileoverview VCard File module exports
 * 
 * This file provides a unified export interface for the VCard file processing system.
 * It exports all classes, types, interfaces, and utilities needed for working with
 * individual VCard files.
 * 
 * The module follows data locality principles by focusing on single-file operations
 * rather than collection management (which is handled by VcardManager).
 * 
 * @module VCardFile
 */

// ============================================================================
// Core Classes
// ============================================================================

export { 
  /** Main class for individual VCard file operations */
  VcardFile 
} from './vcardFile';

export { 
  /** VCard parsing operations and utilities */
  VCardParser 
} from './parsing';

export { 
  /** VCard generation from various sources */
  VCardGenerator 
} from './generation';

export { 
  /** Static file operations for VCards */
  VCardFileOperations 
} from './fileOperations';

// ============================================================================
// Types and Interfaces
// ============================================================================

export * from './types';
export * from '../../interfaces/vcardFile.d';