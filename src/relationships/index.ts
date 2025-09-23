export { RelationshipGraph } from './relationshipGraph';
export type { RelationshipEdge, ContactNode } from './relationshipGraph';
export { RelationshipService } from './relationshipService';
export { 
  normalizeRelationshipKind, 
  renderRelationshipKind, 
  isGenderedRelationship, 
  inferGenderFromRelationship,
  RELATIONSHIP_MAPPING,
  GENDERED_RELATIONSHIPS
} from './relationshipMapping';
export type { Gender } from './relationshipMapping';
export {
  parseRelatedFromFrontMatter,
  relationshipsToFrontMatter,
  syncContactToFrontMatter,
  syncFrontMatterToGraph,
  getContactIdentifier,
  createContactNodeFromFrontMatter
} from './frontMatterSync';
export type { RelationshipFrontMatterEntry } from './frontMatterSync';
export {
  parseRelatedSection,
  parseRelatedListItem,
  renderRelatedSection,
  updateRelatedSection,
  cleanupRelatedHeadings
} from './markdownParser';
export type { RelatedListItem } from './markdownParser';