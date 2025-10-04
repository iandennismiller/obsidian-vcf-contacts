/**
 * Field pattern detection utilities for identifying contact field types
 * from string patterns in the Contact section
 */

/**
 * Detects if a string is an email address
 */
export function isEmail(value: string): boolean {
  // RFC 5322 simplified email regex
  const emailPattern = /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailPattern.test(value.trim());
}

/**
 * Detects if a string is a phone number
 * Supports various formats including international numbers
 */
export function isPhoneNumber(value: string): boolean {
  // Remove common formatting characters for validation
  const cleaned = value.replace(/[\s\-\(\)\.]/g, '');
  
  // Check for various phone number patterns:
  // - International format with +: +1234567890, +1-234-567-8900
  // - With parentheses: (123) 456-7890
  // - With hyphens: 123-456-7890
  // - With spaces: 123 456 7890
  // - With dots: 123.456.7890
  // Minimum 7 digits, maximum 15 (international standard)
  const phonePattern = /^[\+]?[0-9]{7,15}$/;
  
  return phonePattern.test(cleaned);
}

/**
 * Detects if a string is a postal/ZIP code
 * Supports US ZIP, Canadian postal codes, and other common formats
 */
export function isPostalCode(value: string): boolean {
  const trimmed = value.trim();
  
  // US ZIP: 12345 or 12345-6789
  const usZip = /^\d{5}(-\d{4})?$/;
  
  // Canadian postal code: A1A 1A1 or A1A1A1
  const canadianPostal = /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i;
  
  // UK postcode: AA9A 9AA or similar variations
  const ukPostal = /^[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}$/i;
  
  // Generic: 3-10 alphanumeric characters (covers many international formats)
  const genericPostal = /^[A-Z0-9]{3,10}$/i;
  
  return usZip.test(trimmed) || 
         canadianPostal.test(trimmed) || 
         ukPostal.test(trimmed) ||
         genericPostal.test(trimmed);
}

/**
 * Detects if a string is a URL/website
 */
export function isUrl(value: string): boolean {
  const trimmed = value.trim();
  
  // Basic URL pattern - must start with http://, https://, or www.
  // or be a valid domain name
  const urlPattern = /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&\/\/=]*)$/;
  
  return urlPattern.test(trimmed);
}

/**
 * Identifies the field type from a value string
 * Returns the field type (EMAIL, TEL, URL) or null if unidentified
 * Note: Does not return 'ADR' - addresses are handled as fallback in parseContactListItem
 */
export function identifyFieldType(value: string): 'EMAIL' | 'TEL' | 'URL' | null {
  if (!value || value.trim().length === 0) {
    return null;
  }
  
  // Order matters - check more specific patterns first
  if (isEmail(value)) {
    return 'EMAIL';
  }
  
  if (isUrl(value)) {
    return 'URL';
  }
  
  if (isPhoneNumber(value)) {
    return 'TEL';
  }
  
  return null;
}

/**
 * Normalizes/formats a phone number to a standard format
 */
export function normalizePhoneNumber(value: string): string {
  // Remove all formatting
  const cleaned = value.replace(/[\s\-\(\)\.]/g, '');
  
  // If it starts with +, keep it as international format but normalize it
  if (cleaned.startsWith('+')) {
    // Check if it's a US number (+1 followed by 10 digits)
    if (cleaned.length === 12 && cleaned.startsWith('+1') && /^\+1\d{10}$/.test(cleaned)) {
      // Format as +1-XXX-XXX-XXXX
      return `+1-${cleaned.slice(2, 5)}-${cleaned.slice(5, 8)}-${cleaned.slice(8)}`;
    }
    // Otherwise return cleaned international format without dashes
    return cleaned;
  }
  
  // If it's 10 digits and looks like a US number, format as +1-XXX-XXX-XXXX
  if (cleaned.length === 10 && /^\d{10}$/.test(cleaned)) {
    return `+1-${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  
  // If it's 11 digits starting with 1, format as +1-XXX-XXX-XXXX
  if (cleaned.length === 11 && cleaned.startsWith('1') && /^\d{11}$/.test(cleaned)) {
    return `+1-${cleaned.slice(1, 4)}-${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  
  // Otherwise return the cleaned version with + prefix if it's international
  return cleaned.length >= 10 ? `+${cleaned}` : cleaned;
}

/**
 * Normalizes/formats a postal code to a standard format
 */
export function normalizePostalCode(value: string): string {
  const trimmed = value.trim().toUpperCase();
  
  // US ZIP - ensure hyphen if extended
  const usZipMatch = trimmed.match(/^(\d{5})(\d{4})$/);
  if (usZipMatch) {
    return `${usZipMatch[1]}-${usZipMatch[2]}`;
  }
  
  // Canadian - ensure space in middle
  const canadianMatch = trimmed.match(/^([A-Z]\d[A-Z])(\d[A-Z]\d)$/);
  if (canadianMatch) {
    return `${canadianMatch[1]} ${canadianMatch[2]}`;
  }
  
  // UK - normalize spacing
  const ukMatch = trimmed.match(/^([A-Z]{1,2}\d{1,2}[A-Z]?)(\d[A-Z]{2})$/);
  if (ukMatch) {
    return `${ukMatch[1]} ${ukMatch[2]}`;
  }
  
  return trimmed;
}

/**
 * Normalizes/formats a URL to include protocol
 */
export function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  
  // If it already has a protocol, return as-is
  if (trimmed.match(/^https?:\/\//i)) {
    return trimmed;
  }
  
  // If it starts with www., add https://
  if (trimmed.match(/^www\./i)) {
    return `https://${trimmed}`;
  }
  
  // If it looks like a domain, add https://
  if (trimmed.match(/^[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}/)) {
    return `https://${trimmed}`;
  }
  
  return trimmed;
}

/**
 * Normalizes a field value based on its type
 */
export function normalizeFieldValue(value: string, fieldType: string): string {
  switch (fieldType) {
    case 'TEL':
      return normalizePhoneNumber(value);
    case 'URL':
      return normalizeUrl(value);
    case 'EMAIL':
      return value.trim().toLowerCase();
    default:
      return value.trim();
  }
}

/**
 * Result of parsing a contact list item
 */
export interface ParsedContactLine {
  /** The detected field type (EMAIL, TEL, URL, ADR) or null if not detected */
  fieldType: 'EMAIL' | 'TEL' | 'URL' | 'ADR' | null;
  /** The kind/type prefix (e.g., "work", "home", "personal") or null if none */
  kind: string | null;
  /** The contact value (email address, phone number, URL, or address) */
  value: string;
}

/**
 * General method for parsing a contact list item
 * Detects field type and extracts optional kind/type prefix
 * 
 * Supports both formats:
 * - Space-separated: "kind value" (e.g., "work contact@example.com")
 * - Colon-separated: "kind: value" (e.g., "HOME: test@example.com")
 * 
 * Examples:
 * - "home 555-555-5555" → { fieldType: 'TEL', kind: 'home', value: '555-555-5555' }
 * - "HOME: test@example.com" → { fieldType: 'EMAIL', kind: 'HOME', value: 'test@example.com' }
 * - "contact@example.com" → { fieldType: 'EMAIL', kind: null, value: 'contact@example.com' }
 * - "work contact@example.com" → { fieldType: 'EMAIL', kind: 'work', value: 'contact@example.com' }
 * - "123 Some street" → { fieldType: 'ADR', kind: null, value: '123 Some street' }
 * - "personal http://example.com" → { fieldType: 'URL', kind: 'personal', value: 'http://example.com' }
 */
export function parseContactListItem(line: string): ParsedContactLine {
  const trimmed = line.trim();
  
  if (!trimmed) {
    return { fieldType: null, kind: null, value: '' };
  }
  
  // Remove list marker if present
  let withoutMarker = trimmed.replace(/^-\s*/, '');
  
  // Remove emoji/icon prefix if present (e.g., "📧 work email@example.com" → "work email@example.com")
  // Match common emoji characters in the range U+1F300 to U+1F9FF (most common emojis)
  // Also match variation selector U+FE0F
  // This is more conservative than \p{Emoji} which incorrectly matches digits
  withoutMarker = withoutMarker.replace(/^[\u{1F300}-\u{1F9FF}\uFE0F]+\s*/u, '');
  
  // First, try to identify if the entire line is a recognized field type
  const wholeLineType = identifyFieldType(withoutMarker);
  if (wholeLineType) {
    // The whole line is a field - no kind prefix
    return { fieldType: wholeLineType, kind: null, value: withoutMarker };
  }
  
  // Check for colon-separated format: "Label: value" or "Label:value"
  // Only match if the label part is purely alphabetic (to avoid matching URLs like http://example.com)
  const colonMatch = withoutMarker.match(/^([a-zA-Z]+)\s*:\s*(.+)$/);
  if (colonMatch) {
    const potentialKind = colonMatch[1].trim();
    const potentialValue = colonMatch[2].trim();
    
    // Check if the value part (after colon) is a recognized field type
    const valueType = identifyFieldType(potentialValue);
    if (valueType) {
      // Found a field type after the colon - label before colon is the kind
      return { fieldType: valueType, kind: potentialKind, value: potentialValue };
    }
    
    // If value doesn't match a known type, treat as address with kind
    return { fieldType: 'ADR', kind: potentialKind, value: potentialValue };
  }
  
  // Split on first space to check if first word might be a kind
  const firstSpaceIndex = withoutMarker.indexOf(' ');
  if (firstSpaceIndex === -1) {
    // No space - single word, not a recognized type
    // Check if it could be an address (fallback)
    return { fieldType: 'ADR', kind: null, value: withoutMarker };
  }
  
  // Try parsing with first word as kind
  const potentialKind = withoutMarker.substring(0, firstSpaceIndex);
  const potentialValue = withoutMarker.substring(firstSpaceIndex + 1).trim();
  
  // Check if the remainder (after removing first word) is a recognized field type
  const valueType = identifyFieldType(potentialValue);
  if (valueType) {
    // Found a field type after removing first word - first word is the kind
    return { fieldType: valueType, kind: potentialKind, value: potentialValue };
  }
  
  // Could not identify field type even after removing first word
  // This is likely an address. Only extract kind if:
  // 1. First word is alphabetic (potential kind label)
  // 2. Value part starts with a digit (typical for addresses)
  if (/^[a-zA-Z]+$/.test(potentialKind) && /^\d/.test(potentialValue)) {
    // Looks like "home 123 Main St" - extract kind
    return { fieldType: 'ADR', kind: potentialKind, value: potentialValue };
  }
  
  // Otherwise, treat the whole line as an address (no kind)
  // This covers cases like "some random text" or "Main Street"
  return { fieldType: 'ADR', kind: null, value: withoutMarker };
}

/**
 * Parse an email line with optional kind prefix
 * 
 * Examples:
 * - "contact@example.com" → { kind: null, value: "contact@example.com" }
 * - "work contact@example.com" → { kind: "work", value: "contact@example.com" }
 * - "personal user+tag@example.com" → { kind: "personal", value: "user+tag@example.com" }
 */
export function parseEmailLine(line: string): { kind: string | null; value: string } {
  const parsed = parseContactListItem(line);
  
  if (parsed.fieldType !== 'EMAIL') {
    // Not an email line
    return { kind: null, value: '' };
  }
  
  return {
    kind: parsed.kind,
    value: parsed.value
  };
}

/**
 * Parse a phone line with optional kind prefix
 * Returns normalized phone number
 * 
 * Examples:
 * - "555-555-5555" → { kind: null, value: "+1-555-555-5555" }
 * - "home 555-555-5555" → { kind: "home", value: "+1-555-555-5555" }
 * - "cell (555) 123-4567" → { kind: "cell", value: "+1-555-123-4567" }
 */
export function parsePhoneLine(line: string): { kind: string | null; value: string } {
  const parsed = parseContactListItem(line);
  
  if (parsed.fieldType !== 'TEL') {
    // Not a phone line
    return { kind: null, value: '' };
  }
  
  return {
    kind: parsed.kind,
    value: normalizePhoneNumber(parsed.value)
  };
}

/**
 * Parse a URL line with optional kind prefix
 * Returns normalized URL with protocol
 * 
 * Examples:
 * - "http://example.com" → { kind: null, value: "http://example.com" }
 * - "example.com" → { kind: null, value: "https://example.com" }
 * - "personal http://example.com" → { kind: "personal", value: "http://example.com" }
 * - "work www.company.com" → { kind: "work", value: "https://www.company.com" }
 */
export function parseUrlLine(line: string): { kind: string | null; value: string } {
  const parsed = parseContactListItem(line);
  
  if (parsed.fieldType !== 'URL') {
    // Not a URL line
    return { kind: null, value: '' };
  }
  
  return {
    kind: parsed.kind,
    value: normalizeUrl(parsed.value)
  };
}

/**
 * Parse an address line with optional kind prefix
 * 
 * Examples:
 * - "123 Some street" → { kind: null, value: "123 Some street" }
 * - "123 Some street, Town" → { kind: null, value: "123 Some street, Town" }
 * - "home 123 Main St" → { kind: "home", value: "123 Main St" }
 */
export function parseAddressLine(line: string): { kind: string | null; value: string } {
  const parsed = parseContactListItem(line);
  
  if (parsed.fieldType !== 'ADR') {
    // Not an address line
    return { kind: null, value: '' };
  }
  
  return {
    kind: parsed.kind,
    value: parsed.value
  };
}
