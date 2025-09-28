/**
 * Index file for ContactNote module components
 * Exports both the individual component classes and the main ContactNote class
 */

// Export component classes
export { GenderOperations, Gender } from './gender';
export { FrontmatterOperations, parseKey } from './frontmatter';
export { VaultOperations, ResolvedContact } from './vault';
export { MarkdownOperations } from './markdown';
export { RelatedFieldOperations } from './relatedField';
export { RelatedListOperations, ParsedRelationship, FrontmatterRelationship } from './relatedList';
export { SyncOperations } from './sync';
export { NamingOperations } from './naming';

// Export main ContactNote class and related types/utilities
export { 
  ContactNote, 
  Contact, 
  ParsedKey,
  mdRender,
  createNameSlug,
  createContactSlug,
  isKind
} from './contactNote';