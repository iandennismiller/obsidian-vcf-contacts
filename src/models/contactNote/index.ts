/**
 * Index file for ContactNote module components
 * Exports the optimized data-locality structure and maintains backward compatibility
 */

// Export the optimized ContactNote class and related components
export { ContactNote } from './optimizedContactNote';
export type { Contact, ParsedKey } from './optimizedContactNote';
export type { Gender, ParsedRelationship, FrontmatterRelationship, ResolvedContact } from './optimizedContactNote';

// Export optimized component classes for advanced usage
export { ContactData } from './contactData';
export { RelationshipOperations } from './relationshipOperations';
export { MarkdownOperations } from './markdownOperations';
export { SyncOperations } from './syncOperations';

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
} from './optimizedContactNote';

// Re-export legacy component classes for backward compatibility (deprecated)
export { GenderOperations } from './gender';
export { FrontmatterOperations } from './frontmatter';
export { VaultOperations } from './vault';
export { MarkdownOperations as LegacyMarkdownOperations } from './markdown';
export { RelatedFieldOperations } from './relatedField';
export { RelatedListOperations } from './relatedList';
export { SyncOperations as LegacySyncOperations } from './sync';
export { NamingOperations } from './naming';