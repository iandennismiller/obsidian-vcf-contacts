/**
 * Core types and interfaces for the relationship management system
 */

import { TFile } from 'obsidian';

/**
 * Gender types as specified in vCard 4.0 GENDER field
 */
export type Gender = 'M' | 'F' | 'NB' | 'U' | '';

/**
 * Genderless relationship types used internally in the graph and storage
 */
export type GenderlessKind = 
  | 'parent' | 'child' | 'sibling' | 'spouse' | 'friend' 
  | 'colleague' | 'relative' | 'auncle' | 'nibling' 
  | 'grandparent' | 'grandchild' | 'cousin' | 'partner';

/**
 * All possible relationship types including gendered variants for parsing
 */
export type RelationshipType = GenderlessKind 
  | 'mother' | 'father' | 'mom' | 'dad'
  | 'son' | 'daughter' | 'boy' | 'girl'
  | 'brother' | 'sister' | 'bro' | 'sis'
  | 'wife' | 'husband'
  | 'aunt' | 'uncle' | 'nephew' | 'niece'
  | 'grandmother' | 'grandfather' | 'grandson' | 'granddaughter'
  | 'boyfriend' | 'girlfriend';

/**
 * Node attributes for contacts in the relationship graph
 */
export interface ContactNode {
  uid: string;
  fullName: string;
  gender?: Gender;
}

/**
 * Edge attributes for relationships
 */
export interface RelationshipEdge {
  type: GenderlessKind;
  source: string;
  target: string;
}

/**
 * RELATED field value format for vCard
 */
export interface RelatedField {
  type: GenderlessKind;
  value: string; // urn:uuid:..., uid:..., or name:...
}

/**
 * Contact note representation
 */
export interface ContactNote {
  file: TFile;
  frontMatter: Record<string, any>;
  content: string;
  uid: string;
  fullName: string;
  gender?: Gender;
}

/**
 * Relationship item in the Related markdown list
 */
export interface RelatedListItem {
  type: RelationshipType;
  targetName: string;
  impliedGender?: Gender;
}

/**
 * Relationship update operation
 */
export interface RelationshipUpdate {
  sourceUid: string;
  targetUid: string;
  kind: GenderlessKind;
}

/**
 * Consistency check result
 */
export interface ConsistencyCheckResult {
  totalContacts: number;
  inconsistentContacts: string[];
  missingBacklinks: Array<{
    sourceUid: string;
    targetUid: string;
    kind: GenderlessKind;
  }>;
  orphanedRelationships: Array<{
    sourceUid: string;
    targetUid: string;
    kind: GenderlessKind;
  }>;
}

/**
 * vCard record structure
 */
export interface VCard {
  UID: string;
  'N.GN'?: string; // Given Name
  'N.FN'?: string; // Family Name
  'N.MN'?: string; // Middle Name
  'N.PREFIX'?: string;
  'N.SUFFIX'?: string;
  FN?: string; // Full Name
  GENDER?: Gender;
  REV?: string; // Revision timestamp
  VERSION: string;
  [key: string]: any; // For other vCard fields including RELATED
}