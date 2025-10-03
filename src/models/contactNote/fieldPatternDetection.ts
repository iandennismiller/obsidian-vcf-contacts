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
 * Returns the field type (EMAIL, TEL, ADR, URL) or null if unidentified
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
  
  // If it starts with +, keep it as international format
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  
  // If it's 10 digits and looks like a US number, format as +1-XXX-XXX-XXXX
  if (cleaned.length === 10 && /^\d{10}$/.test(cleaned)) {
    return `+1-${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  
  // If it's 11 digits starting with 1, format as +1-XXX-XXX-XXXX
  if (cleaned.length === 11 && cleaned.startsWith('1') && /^\d{11}$/.test(cleaned)) {
    return `+${cleaned.slice(0, 1)}-${cleaned.slice(1, 4)}-${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
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
