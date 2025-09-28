/**
 * Index file for ContactNote module components
 * Exports both the individual component classes and the main ContactNote class
 */

// Export component classes
export { GenderOperations } from './gender';
export type { Gender } from './gender';
export { FrontmatterOperations, parseKey } from './frontmatter';
export { VaultOperations } from './vault';
export type { ResolvedContact } from './vault';
export { MarkdownOperations } from './markdown';
export { RelatedFieldOperations } from './relatedField';
export { RelatedListOperations } from './relatedList';
export type { ParsedRelationship, FrontmatterRelationship } from './relatedList';
export { SyncOperations } from './sync';
export { NamingOperations } from './naming';

// Export main ContactNote class and related types/utilities
export { 
  ContactNote, 
  mdRender,
  createNameSlug,
  createContactSlug,
  isKind
} from './contactNote';

export type { Contact, ParsedKey } from './contactNote';

// Export helper utilities
export { fileId, getUiName, uiSafeString, getSortName, createFileName } from './contactNote';