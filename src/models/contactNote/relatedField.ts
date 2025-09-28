/**
 * Handles parsing and operations for related field formats
 */

export class RelatedFieldOperations {
  /**
   * Format a related value for vCard RELATED field
   */
  formatRelatedValue(targetUid: string, targetName: string): string {
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
  parseRelatedValue(value: string): { type: 'uuid' | 'uid' | 'name'; value: string } | null {
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
  extractRelationshipType(key: string): string {
    const typeMatch = key.match(/RELATED(?:\[(?:\d+:)?([^\]]+)\])?/);
    return typeMatch ? typeMatch[1] || 'related' : 'related';
  }
}