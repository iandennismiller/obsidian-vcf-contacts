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
 * Parses a vCard RELATED field value to extract UID/name and type.
 * Format: RELATED;TYPE=friend:urn:uuid:03a0e51f-... (UID-based)
 * Format: RELATED;TYPE=friend:name:John Smith (name-based for missing contacts)
 */
export interface ParsedRelation {
  uid?: string;
  name?: string;
  type: string;
  isNameBased: boolean;
}

export function parseRelatedField(fieldValue: string, fieldType?: string): ParsedRelation | null {
  // Handle URN format: urn:uuid:xxxx-xxxx-xxxx
  if (fieldValue.startsWith('urn:uuid:')) {
    const uid = fieldValue.substring(9); // Remove 'urn:uuid:' prefix
    const type = fieldType || 'related';
    return {
      uid: uid.trim(),
      type: type.toLowerCase(),
      isNameBased: false
    };
  }
  
  // Handle name-based format: name:John Smith
  if (fieldValue.startsWith('name:')) {
    const name = fieldValue.substring(5); // Remove 'name:' prefix
    const type = fieldType || 'related';
    return {
      name: name.trim(),
      type: type.toLowerCase(),
      isNameBased: true
    };
  }
  
  // Legacy handling - assume it's a UID without urn:uuid prefix
  const type = fieldType || 'related';
  return {
    uid: fieldValue.trim(),
    type: type.toLowerCase(),
    isNameBased: false
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
 * Formats a name-based relationship for vCard RELATED field.
 * Used when the target contact doesn't exist yet.
 */
export function formatNameBasedRelatedField(name: string): string {
  return `name:${name}`;
}

/**
 * Renders a relationship in human-readable format for markdown.
 * Format: "- Friend [[ContactName]]"
 */
export function renderRelationshipMarkdown(
  contactName: string,
  relationshipType: string,
  currentContactName: string
): string {
  // Capitalize the first letter of the relationship type
  const capitalizedType = relationshipType.charAt(0).toUpperCase() + relationshipType.slice(1).toLowerCase();
  return `- ${capitalizedType} [[${contactName}]]`;
}

/**
 * Parses a relationship markdown line to extract contact name and relationship type.
 * Handles formats like:
 * - Friend [[ContactName]]
 * - Parent [[ContactName]]
 */
export function parseRelationshipMarkdown(line: string): { contactName: string; relationshipType: string } | null {
  const match = line.match(/^-\s*([^\s\[]+)\s*\[\[([^\]]+)\]\]$/);
  if (match) {
    return {
      contactName: match[2].trim(),
      relationshipType: match[1].trim().toLowerCase()
    };
  }
  return null;
}