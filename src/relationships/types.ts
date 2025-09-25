import { TFile } from 'obsidian';

/**
 * Gender types as specified in vCard 4.0 GENDER field
 */
export type Gender = 'M' | 'F' | 'NB' | 'U' | '';

/**
 * Relationship types (genderless internally)
 */
export type RelationshipType = 
  | 'parent' | 'child' | 'sibling' | 'spouse' | 'friend' 
  | 'colleague' | 'relative' | 'auncle' | 'nibling' 
  | 'grandparent' | 'grandchild' | 'cousin' | 'partner';

/**
 * Node attributes for contacts in the relationship graph
 */
export interface ContactNode {
  uid: string;
  fullName: string;
  gender?: Gender;
  file?: TFile;
}

/**
 * Edge attributes for relationships
 */
export interface RelationshipEdge {
  type: RelationshipType;
  source: string;
  target: string;
}

/**
 * RELATED field value format for vCard
 */
export interface RelatedField {
  type: RelationshipType;
  value: string; // urn:uuid:..., uid:..., or name:...
}

/**
 * Contact note representation
 */
export interface ContactNote {
  file: TFile;
  frontMatter: Record<string, any>;
  content: string;
  uid?: string;
  fullName?: string;
}

/**
 * Related list item in markdown
 */
export interface RelatedListItem {
  type: RelationshipType;
  contactName: string;
  impliedGender?: Gender;
}

/**
 * Relationship update descriptor
 */
export interface RelationshipUpdate {
  sourceUid: string;
  targetUid: string;
  relationshipType: RelationshipType;
  operation: 'add' | 'remove';
}

/**
 * Consistency check result
 */
export interface ConsistencyCheckResult {
  totalContacts: number;
  inconsistentContacts: string[];
  missingReciprocals: Array<{
    sourceUid: string;
    targetUid: string;
    relationshipType: RelationshipType;
    reciprocalType: RelationshipType;
  }>;
  duplicateEdges: Array<{
    sourceUid: string;
    targetUid: string;
    relationshipType: RelationshipType;
  }>;
}

/**
 * Contact relationship info
 */
export interface ContactRelationship {
  type: RelationshipType;
  targetUid: string;
  targetName: string;
}