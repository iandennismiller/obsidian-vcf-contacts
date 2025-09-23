/**
 * Utilities for handling namespace formats in RELATED field values
 */

/**
 * Check if a string is a valid UUID
 */
export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Parse a namespace value and extract the identifier and type
 */
export function parseNamespaceValue(value: string): { type: 'urn:uuid' | 'uid' | 'name'; identifier: string } | null {
  if (value.startsWith('urn:uuid:')) {
    return {
      type: 'urn:uuid',
      identifier: value.substring('urn:uuid:'.length)
    };
  }
  
  if (value.startsWith('uid:')) {
    return {
      type: 'uid',
      identifier: value.substring('uid:'.length)
    };
  }
  
  if (value.startsWith('name:')) {
    return {
      type: 'name',
      identifier: value.substring('name:'.length)
    };
  }
  
  return null;
}

/**
 * Create a namespace value for a contact based on its UID and name
 */
export function createNamespaceValue(uid: string | undefined, fullName: string, contactExists: boolean): string {
  // If contact doesn't exist in Obsidian, use name namespace
  if (!contactExists) {
    return `name:${fullName}`;
  }
  
  // If we have a UID
  if (uid && uid.trim()) {
    // Check if it's a valid UUID
    if (isValidUUID(uid)) {
      return `urn:uuid:${uid}`;
    } else {
      // UID exists but is not a valid UUID
      return `uid:${uid}`;
    }
  }
  
  // Fallback to name if no UID
  return `name:${fullName}`;
}

/**
 * Extract the display name from a namespace value
 */
export function extractDisplayName(namespaceValue: string): string {
  const parsed = parseNamespaceValue(namespaceValue);
  if (parsed && parsed.type === 'name') {
    return parsed.identifier;
  }
  
  // For uid and urn:uuid types, we need to resolve the name separately
  // This will be handled by the calling code that has access to the contact graph
  return namespaceValue;
}

/**
 * Find a contact in the graph by namespace value
 */
export function findContactByNamespace(
  namespaceValue: string,
  getContactByUid: (uid: string) => any | null,
  getContactByName: (name: string) => any | null
): any | null {
  const parsed = parseNamespaceValue(namespaceValue);
  
  if (!parsed) {
    return null;
  }
  
  switch (parsed.type) {
    case 'urn:uuid':
    case 'uid':
      return getContactByUid(parsed.identifier);
    case 'name':
      return getContactByName(parsed.identifier);
    default:
      return null;
  }
}