/**
 * Relationship Management Module
 * 
 * This module implements vCard 4.0 RELATED field support for managing
 * relationships between contacts in Obsidian.
 */

export { RelationshipGraph } from './relationshipGraph';
export type { Gender, RelationshipType, ContactNode, RelationshipEdge, RelatedField } from './relationshipGraph';
export { RelationshipManager } from './relationshipManager';
export { RelationshipSyncManager } from './relationshipSyncManager';
export { RelationshipEventHandler } from './relationshipEventHandler';
export { RelationshipContentParser } from './relationshipContentParser';
export { RelationshipSet } from './relationshipSet';
export { ContactUtils } from './contactUtils';
export { 
  getReciprocalType, 
  renderRelationshipType, 
  formatRelationshipListItem, 
  parseRelationshipListItem,
  isSymmetricRelationship,
  isValidRelationshipType 
} from './relationshipUtils';