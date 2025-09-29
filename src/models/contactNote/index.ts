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
  /** Parsed key structure for frontmatter field parsing */  
  ParsedKey 
} from './contactNote';

export type { 
  /** Gender enumeration for contact classification */
  Gender, 
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
  /** Relationship operations with data locality optimization */
  RelationshipOperations 
} from './relationshipOperations';

export { 
  /** Markdown operations optimized for contact rendering */
  MarkdownOperations 
} from './markdownOperations';

export { 
  /** Synchronization operations for contact data */
  SyncOperations 
} from './syncOperations';

// Export utility functions for backward compatibility
export { 
  parseKey,
  mdRender,
  createNameSlug,
  createContactSlug,
  isKind,
  fileId,
  getUiName,
  uiSafeString,
  getSortName,
  createFileName
} from './contactNote';

// ============================================================================
// Interfaces
// ============================================================================

export * from '../contactNote.d';