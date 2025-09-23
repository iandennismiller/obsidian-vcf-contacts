/**
 * @fileoverview RELATED field utilities for vCard 4.0 support
 */

import { RelationshipTriple, GENDERED_TO_NEUTRAL, GENDER_INFERRING_TERMS } from './types';

export interface ParsedRelatedField {
  relationshipType: string;
  contactReference: string;
  namespace: 'uuid' | 'uid' | 'name';
  originalValue: string;
}

/**
 * Parse a RELATED field value from vCard format
 * Format: RELATED;TYPE=friend:urn:uuid:03a0e51f-d1aa-4385-8a53-e29025acd8af
 * Or: RELATED;TYPE=parent:name:John Doe
 * Or: RELATED;TYPE=sibling:uid:custom-uid-123
 */
export function parseRelatedField(fieldValue: string, fieldKey: string): ParsedRelatedField | null {
  try {
    // Extract TYPE parameter from the key (e.g., RELATED;TYPE=friend -> friend)
    const typeMatch = fieldKey.match(/TYPE=([^;,\]]+)/i);
    if (!typeMatch) {
      return null;
    }
    
    const relationshipType = typeMatch[1].toLowerCase();
    const normalizedType = GENDERED_TO_NEUTRAL[relationshipType] || relationshipType;

    // Parse the value to extract namespace and reference
    let namespace: 'uuid' | 'uid' | 'name';
    let contactReference: string;

    if (fieldValue.startsWith('urn:uuid:')) {
      namespace = 'uuid';
      contactReference = fieldValue.substring('urn:uuid:'.length);
    } else if (fieldValue.startsWith('uid:')) {
      namespace = 'uid';
      contactReference = fieldValue.substring('uid:'.length);
    } else if (fieldValue.startsWith('name:')) {
      namespace = 'name';
      contactReference = fieldValue.substring('name:'.length);
    } else {
      // Default to name if no namespace prefix
      namespace = 'name';
      contactReference = fieldValue;
    }

    return {
      relationshipType: normalizedType,
      contactReference,
      namespace,
      originalValue: fieldValue
    };
  } catch (error) {
    console.warn('Failed to parse RELATED field:', fieldKey, fieldValue, error);
    return null;
  }
}

/**
 * Format a relationship triple back to vCard RELATED field format
 */
export function formatRelatedField(relationshipKind: string, contactUid: string, contactName?: string): { key: string; value: string } {
  // Determine the best namespace to use
  let value: string;
  
  if (contactUid && isValidUUID(contactUid)) {
    value = `urn:uuid:${contactUid}`;
  } else if (contactUid && contactUid !== contactName) {
    value = `uid:${contactUid}`;
  } else if (contactName) {
    value = `name:${contactName}`;
  } else {
    value = `name:Unknown Contact`;
  }

  return {
    key: `RELATED;TYPE=${relationshipKind}`,
    value: value
  };
}

/**
 * Check if a string is a valid UUID
 */
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Convert front matter RELATED fields to relationship triples
 */
export function frontMatterToRelationships(frontMatter: Record<string, any>, subjectUid: string): RelationshipTriple[] {
  const relationships: RelationshipTriple[] = [];

  Object.keys(frontMatter).forEach(key => {
    if (key.startsWith('RELATED')) {
      const value = frontMatter[key];
      const parsed = parseRelatedField(value, key);
      
      if (parsed) {
        relationships.push({
          subject: subjectUid,
          relationshipKind: parsed.relationshipType,
          object: parsed.contactReference
        });
      }
    }
  });

  return relationships;
}

/**
 * Convert relationship triples to front matter RELATED fields with proper indexing
 */
export function relationshipsToFrontMatter(relationships: RelationshipTriple[], subjectUid: string): Record<string, string> {
  const frontMatter: Record<string, string> = {};
  
  // Group relationships by type
  const relationshipsByType: { [type: string]: RelationshipTriple[] } = {};
  
  relationships
    .filter(rel => rel.subject === subjectUid)
    .forEach(rel => {
      if (!relationshipsByType[rel.relationshipKind]) {
        relationshipsByType[rel.relationshipKind] = [];
      }
      relationshipsByType[rel.relationshipKind].push(rel);
    });

  // Convert to front matter format with proper indexing
  Object.keys(relationshipsByType).forEach(relationshipKind => {
    const relationsOfType = relationshipsByType[relationshipKind];
    
    // Sort by object to ensure deterministic order
    relationsOfType.sort((a, b) => a.object.localeCompare(b.object));
    
    relationsOfType.forEach((rel, index) => {
      const { key, value } = formatRelatedField(relationshipKind, rel.object);
      
      let frontMatterKey: string;
      if (index === 0) {
        frontMatterKey = `RELATED[${relationshipKind}]`;
      } else {
        frontMatterKey = `RELATED[${index}:${relationshipKind}]`;
      }
      
      frontMatter[frontMatterKey] = value;
    });
  });

  return frontMatter;
}

/**
 * Extract inferred gender from a relationship term
 */
export function extractInferredGender(relationshipTerm: string): 'M' | 'F' | null {
  return GENDER_INFERRING_TERMS[relationshipTerm.toLowerCase()] || null;
}