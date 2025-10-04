/**
 * Entity module exports
 * 
 * This module exports all domain entities for the ContactNote model.
 */

// Value Objects
export { Gender, UID, Revision } from './valueObjects';

// Fields
export { 
  ContactField, 
  ValidationResult, 
  FrontmatterEntry, 
  EmailField, 
  TelephoneField, 
  AddressField, 
  AddressComponents,
  UrlField 
} from './fields';

// Relationships
export {
  RelationshipType,
  RelationshipReference,
  ReferenceType,
  Relationship,
  RelationshipValidation
} from './relationships';

// Document entities
export {
  Frontmatter,
  FrontmatterValidationResult,
  MarkdownSection,
  SectionValidationResult
} from './document';
