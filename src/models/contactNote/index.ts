/**
 * ContactNote module - Unified interface for interacting with contact notes in Obsidian
 * 
 * This module provides a comprehensive set of tools for managing contact notes,
 * including frontmatter operations, relationship management, gender operations,
 * markdown rendering, and synchronization capabilities.
 * 
 * @module ContactNote
 */

// Export the optimized ContactNote as the canonical implementation
export { ContactNote } from './contactNote';
export type { 
  /** Contact data structure containing file and data properties */
  Contact, 
  /** Gender enumeration for contact classification */
  Gender 
} from './contactNote';

export type { 
  /** Parsed relationship data structure */
  ParsedRelationship, 
  /** Frontmatter relationship structure */
  FrontmatterRelationship, 
  /** Resolved contact information */
  ResolvedContact 
} from './contactNote';

// Export optimized component classes for advanced usage
export { 
  /** Centralized contact data management with improved cache locality */
  ContactData 
} from './contactData';

export {
  /** Synchronization operations for contact data */
  SyncOperations
} from './syncOperations';

export {
  /** Advanced relationship operations */
  AdvancedRelationshipOperations
} from './advancedRelationshipOperations';

// Export utility functions for backward compatibility
export { 
  mdRender,
  createNameSlug,
  createContactSlug,
  isKind,
  fileId,
  getUiName,
  uiSafeString,
  getSortName,
  createFileName
} from './utilityFunctions';

// Export field pattern detection utilities
export {
  isEmail,
  isPhoneNumber,
  isPostalCode,
  isUrl,
  identifyFieldType,
  normalizePhoneNumber,
  normalizePostalCode,
  normalizeUrl,
  normalizeFieldValue,
  parseContactListItem,
  parseEmailLine,
  parsePhoneLine,
  parseUrlLine,
  parseAddressLine
} from './fieldPatternDetection';

export type {
  /** Result of parsing a contact list item */
  ParsedContactLine
} from './fieldPatternDetection';