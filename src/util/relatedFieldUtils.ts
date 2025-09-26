/**
 * Utility functions for handling RELATED field formatting and parsing
 */

/**
 * Format a related value for vCard RELATED field
 * Follows the specification:
 * - urn:uuid: namespace for valid UUIDs
 * - uid: namespace for non-UUID UIDs
 * - name: namespace for contact names
 */
export function formatRelatedValue(targetUid: string, targetName: string): string {
  // Check if it's a valid UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(targetUid)) {
    return `urn:uuid:${targetUid}`;
  } else if (targetUid) {
    return `uid:${targetUid}`;
  } else {
    return `name:${targetName}`;
  }
}

/**
 * Parse a vCard RELATED value to extract UID or name
 */
export function parseRelatedValue(value: string): { type: 'uuid' | 'uid' | 'name'; value: string } | null {
  if (value.startsWith('urn:uuid:')) {
    return { type: 'uuid', value: value.substring(9) };
  } else if (value.startsWith('uid:')) {
    return { type: 'uid', value: value.substring(4) };
  } else if (value.startsWith('name:')) {
    return { type: 'name', value: value.substring(5) };
  }
  return null;
}

/**
 * Extract relationship type from RELATED key format
 */
export function extractRelationshipType(key: string): string {
  const typeMatch = key.match(/RELATED(?:\[(?:\d+:)?([^\]]+)\])?/);
  return typeMatch ? typeMatch[1] || 'related' : 'related';
}