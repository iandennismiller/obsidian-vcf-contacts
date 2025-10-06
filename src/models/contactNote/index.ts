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

// Export services for advanced usage
export { 
  /** Contact lookup and resolution service */
  ContactResolver,
  /** UID conflict detection and resolution service */
  UIDConflictResolver,
  /** Markdown rendering service for vCard data */
  MarkdownRenderer,
  /** Relationship upgrade service for migrating to UID-based relationships */
  RelationshipUpgradeService
} from './services';

export type {
  /** Resolved contact information from ContactResolver */
  ResolvedContact as ServiceResolvedContact,
  /** UID conflict information */
  UIDConflict,
  /** Result of conflict detection */
  ConflictDetectionResult,
  /** Result of UID update operation */
  UIDUpdateResult,
  /** Result of bulk UID update operation */
  BulkUIDUpdateResult,
  /** Result of relationship upgrade operation */
  RelationshipUpgradeResult
} from './services';

// Export field utilities
export {
  /** Field grouping and sorting utility */
  FieldGrouper,
  /** Field type extraction and validation utility */
  FieldType
} from './entities/fields';

export type {
  /** Grouped vCard fields by category */
  FieldGroups
} from './entities/fields';