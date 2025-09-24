import { Gender, RelationshipType, GENDERED_RELATIONSHIPS, GENDERED_TERM_TO_TYPE, ParsedRelationship } from './relationshipTypes';

/**
 * Normalize gender value
 */
export function normalizeGender(gender: string | Gender): Gender {
  if (!gender || gender.trim() === '') return '';
  const normalized = gender.toUpperCase().trim();
  
  switch (normalized) {
    case 'M':
    case 'MALE':
      return 'M';
    case 'F':
    case 'FEMALE':
      return 'F';
    case 'NB':
    case 'NON-BINARY':
    case 'NONBINARY':
      return 'NB';
    case 'U':
    case 'UNSPECIFIED':
      return 'U';
    default:
      return '';
  }
}

/**
 * Get gendered term for a relationship type based on target's gender
 */
export function getGenderedTerm(type: RelationshipType, gender?: Gender): string {
  const genderedRel = GENDERED_RELATIONSHIPS[type];
  if (!genderedRel) return type;

  switch (normalizeGender(gender || '')) {
    case 'M':
      return genderedRel.male;
    case 'F':
      return genderedRel.female;
    case 'NB':
      return genderedRel.nonbinary;
    default:
      return genderedRel.unspecified;
  }
}

/**
 * Parse a gendered term to extract relationship type and implied gender
 */
export function parseGenderedTerm(term: string): { type: RelationshipType; gender?: Gender } | null {
  const normalized = term.toLowerCase().trim();
  const mapping = GENDERED_TERM_TO_TYPE[normalized];
  
  if (mapping) {
    return {
      type: mapping.type,
      gender: mapping.gender
    };
  }

  // If not found in mapping, check if it's a valid relationship type
  const allTypes: RelationshipType[] = [
    'parent', 'child', 'sibling', 'spouse', 'friend',
    'colleague', 'relative', 'auncle', 'nibling',
    'grandparent', 'grandchild', 'cousin', 'partner'
  ];

  if (allTypes.includes(normalized as RelationshipType)) {
    return {
      type: normalized as RelationshipType
    };
  }

  return null;
}

/**
 * Format a relationship for display in a markdown list
 */
export function formatRelationshipListItem(type: RelationshipType, contactName: string, gender?: Gender): string {
  const displayTerm = getGenderedTerm(type, gender);
  return `- ${displayTerm} [[${contactName}]]`;
}

/**
 * Parse a relationship from a markdown list item
 */
export function parseRelationshipFromListItem(line: string): ParsedRelationship | null {
  // Match patterns like "- father [[John Doe]]" or "- parent [[Jane Smith]]"
  const match = line.trim().match(/^-\s*(.+?)\s*\[\[(.+?)\]\]$/);
  if (!match) {
    return null;
  }

  const relationTerm = match[1].trim();
  const contactName = match[2].trim();

  const parsed = parseGenderedTerm(relationTerm);
  if (!parsed) {
    return null;
  }

  return {
    type: parsed.type,
    contactName,
    impliedGender: parsed.gender
  };
}

/**
 * Check if a string is a valid UUID
 */
export function isValidUuid(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Format a related value for vCard RELATED field
 */
export function formatRelatedValue(targetUid: string, targetName: string): string {
  if (isValidUuid(targetUid)) {
    return `urn:uuid:${targetUid}`;
  }

  // If UID exists but is not a valid UUID
  if (targetUid && targetUid !== targetName) {
    return `uid:${targetUid}`;
  }

  // Fallback to name
  return `name:${targetName}`;
}

/**
 * Parse a related value from vCard RELATED field
 */
export function parseRelatedValue(value: string): { uid: string; name?: string } | null {
  if (value.startsWith('urn:uuid:')) {
    const uid = value.substring('urn:uuid:'.length);
    return { uid };
  }

  if (value.startsWith('uid:')) {
    const uid = value.substring('uid:'.length);
    return { uid };
  }

  if (value.startsWith('name:')) {
    const name = value.substring('name:'.length);
    return { uid: name, name }; // Use name as UID for stub contacts
  }

  // If no prefix, assume it's a UID
  return { uid: value };
}

/**
 * Generate a front matter key for a RELATED field
 */
export function generateRelatedFrontMatterKey(type: RelationshipType, index: number = 0): string {
  if (index === 0) {
    return `RELATED[${type}]`;
  }
  return `RELATED[${index}:${type}]`;
}

/**
 * Parse a front matter key to extract relationship type and index
 */
export function parseRelatedFrontMatterKey(key: string): { type: RelationshipType; index: number } | null {
  // Match patterns like "RELATED[friend]" or "RELATED[1:parent]"
  const match = key.match(/^RELATED\[(?:(\d+):)?(.+)\]$/);
  if (!match) {
    return null;
  }

  const indexStr = match[1];
  const type = match[2] as RelationshipType;
  const index = indexStr ? parseInt(indexStr, 10) : 0;

  // Validate relationship type
  const validTypes: RelationshipType[] = [
    'parent', 'child', 'sibling', 'spouse', 'friend',
    'colleague', 'relative', 'auncle', 'nibling',
    'grandparent', 'grandchild', 'cousin', 'partner'
  ];

  if (!validTypes.includes(type)) {
    return null;
  }

  return { type, index };
}