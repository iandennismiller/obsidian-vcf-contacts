/**
 * @fileoverview Relationship management utilities for vCard 4.0 RELATED fields.
 * 
 * This module handles:
 * - Mapping of relationship types to their complementary counterparts
 * - Rendering relationships in human-readable format
 * - Synchronizing relationships between contacts
 * - Converting between vCard RELATED fields and Obsidian markdown
 */

export interface RelationshipType {
  type: string;
  complement?: string;
  isSymmetric?: boolean;
}

/**
 * Mapping of relationship types to their complements.
 * Symmetric relationships map to themselves.
 * Asymmetric relationships have different complements.
 */
export const RELATIONSHIP_TYPES: Record<string, RelationshipType> = {
  // Family relationships
  'parent': { type: 'parent', complement: 'child', isSymmetric: false },
  'child': { type: 'child', complement: 'parent', isSymmetric: false },
  'sibling': { type: 'sibling', complement: 'sibling', isSymmetric: true },
  'spouse': { type: 'spouse', complement: 'spouse', isSymmetric: true },
  'partner': { type: 'partner', complement: 'partner', isSymmetric: true },
  
  // Social relationships
  'friend': { type: 'friend', complement: 'friend', isSymmetric: true },
  'colleague': { type: 'colleague', complement: 'colleague', isSymmetric: true },
  'acquaintance': { type: 'acquaintance', complement: 'acquaintance', isSymmetric: true },
  
  // Professional relationships
  'manager': { type: 'manager', complement: 'subordinate', isSymmetric: false },
  'subordinate': { type: 'subordinate', complement: 'manager', isSymmetric: false },
  'mentor': { type: 'mentor', complement: 'mentee', isSymmetric: false },
  'mentee': { type: 'mentee', complement: 'mentor', isSymmetric: false },
  
  // Extended family
  'grandparent': { type: 'grandparent', complement: 'grandchild', isSymmetric: false },
  'grandchild': { type: 'grandchild', complement: 'grandparent', isSymmetric: false },
  'aunt': { type: 'aunt', complement: 'niece', isSymmetric: false },
  'uncle': { type: 'uncle', complement: 'nephew', isSymmetric: false },
  'niece': { type: 'niece', complement: 'aunt', isSymmetric: false },
  'nephew': { type: 'nephew', complement: 'uncle', isSymmetric: false },
  'cousin': { type: 'cousin', complement: 'cousin', isSymmetric: true },
  
  // Generic
  'related': { type: 'related', complement: 'related', isSymmetric: true },
  'contact': { type: 'contact', complement: 'contact', isSymmetric: true }
};

/**
 * Gets the complement relationship type for a given relationship.
 */
export function getComplementRelationship(relationshipType: string): string {
  const relationship = RELATIONSHIP_TYPES[relationshipType.toLowerCase()];
  return relationship?.complement || 'related';
}

/**
 * Checks if a relationship type is symmetric (both parties have the same relationship).
 */
export function isSymmetricRelationship(relationshipType: string): boolean {
  const relationship = RELATIONSHIP_TYPES[relationshipType.toLowerCase()];
  return relationship?.isSymmetric || false;
}

/**
 * Validates if a relationship type is supported.
 */
export function isValidRelationshipType(relationshipType: string): boolean {
  return relationshipType.toLowerCase() in RELATIONSHIP_TYPES;
}

/**
 * Parses a vCard RELATED field value to extract UID and type.
 * Format: RELATED;TYPE=friend:urn:uuid:03a0e51f-...
 */
export interface ParsedRelation {
  uid: string;
  type: string;
}

export function parseRelatedField(fieldValue: string, fieldType?: string): ParsedRelation | null {
  // Handle URN format: urn:uuid:xxxx-xxxx-xxxx
  let uid = fieldValue;
  if (fieldValue.startsWith('urn:uuid:')) {
    uid = fieldValue.substring(9); // Remove 'urn:uuid:' prefix
  }
  
  // Use the type from the field parameters, defaulting to 'related'
  const type = fieldType || 'related';
  
  return {
    uid: uid.trim(),
    type: type.toLowerCase()
  };
}

/**
 * Formats a relationship for vCard RELATED field.
 * Returns the URN format expected by vCard 4.0.
 */
export function formatRelatedField(uid: string): string {
  // Ensure we have the full URN format
  if (uid.startsWith('urn:uuid:')) {
    return uid;
  }
  return `urn:uuid:${uid}`;
}

/**
 * Renders a relationship in human-readable format for markdown.
 * Format: "[[ContactName]] is the parent of CurrentContact"
 */
export function renderRelationshipMarkdown(
  contactName: string,
  relationshipType: string,
  currentContactName: string
): string {
  const article = ['a', 'e', 'i', 'o', 'u'].includes(relationshipType[0]?.toLowerCase()) ? 'an' : 'a';
  return `- [[${contactName}]] is ${article} ${relationshipType} of ${currentContactName}`;
}

/**
 * Parses a relationship markdown line to extract contact name and relationship type.
 * Handles formats like:
 * - [[ContactName]] is a friend of CurrentContact
 * - [[ContactName]] is the parent of CurrentContact
 */
export function parseRelationshipMarkdown(line: string): { contactName: string; relationshipType: string } | null {
  const match = line.match(/^-\s*\[\[([^\]]+)\]\]\s+is\s+(?:a|an|the)\s+([^\s]+)\s+of\s+(.+)$/);
  if (match) {
    return {
      contactName: match[1].trim(),
      relationshipType: match[2].trim().toLowerCase()
    };
  }
  return null;
}