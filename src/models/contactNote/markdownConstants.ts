/**
 * Centralized markdown-related constants for contact notes
 * 
 * This file contains all repeated strings, patterns, and constants used
 * throughout the markdown parsing and rendering code.
 */

// ============================================================================
// Section Names
// ============================================================================

export const SECTION_NAMES = {
  NOTES: 'Notes',
  RELATED: 'Related',
  CONTACT: 'Contact',
} as const;

// ============================================================================
// Heading Levels
// ============================================================================

export const HEADING_LEVELS = {
  SECTION: '##',      // Main sections like Contact, Related
  SUBSECTION: '####', // Sub-sections like Notes
} as const;

// ============================================================================
// Section Templates
// ============================================================================

export const SECTION_TEMPLATES = {
  NOTES: (level: string, name: string) => `${level} ${name}\n`,
  RELATED: (level: string, name: string) => `${level} ${name}\n`,
  CONTACT: (level: string, name: string) => `${level} ${name}\n`,
} as const;

// ============================================================================
// List Formats
// ============================================================================

export const LIST_FORMATS = {
  UNORDERED: '-',
  ORDERED: (n: number) => `${n}.`,
} as const;

// ============================================================================
// Frontmatter Delimiters
// ============================================================================

export const FRONTMATTER = {
  DELIMITER: '---',
  START: '---\n',
  END: '\n---\n',
} as const;

// ============================================================================
// VCard Field Types
// ============================================================================

export const VCARD_FIELD_TYPES = {
  // Contact fields
  EMAIL: 'EMAIL',
  TEL: 'TEL',
  URL: 'URL',
  ADR: 'ADR',
  
  // Name fields
  N: 'N',
  FN: 'FN',
  
  // Organization fields
  ORG: 'ORG',
  TITLE: 'TITLE',
  ROLE: 'ROLE',
  
  // Other fields
  BDAY: 'BDAY',
  PHOTO: 'PHOTO',
  GENDER: 'GENDER',
  RELATED: 'RELATED',
  UID: 'UID',
  VERSION: 'VERSION',
  NOTE: 'NOTE',
  CATEGORIES: 'CATEGORIES',
  REV: 'REV',
} as const;

// ============================================================================
// Field Groups
// ============================================================================

export const FIELD_GROUPS = {
  NAME: ['N', 'FN'],
  PRIORITY: ['EMAIL', 'TEL', 'BDAY', 'URL', 'ORG', 'TITLE', 'ROLE', 'PHOTO', 'RELATED', 'GENDER'],
  ADDRESS: ['ADR'],
  CONTACT: ['EMAIL', 'TEL', 'URL', 'ADR'],
} as const;

// ============================================================================
// Field Display Info
// ============================================================================

export const FIELD_DISPLAY = {
  EMAIL: { icon: '📧', name: 'Email' },
  TEL: { icon: '📞', name: 'Phone' },
  URL: { icon: '🌐', name: 'Website' },
  ADR: { icon: '🏠', name: 'Address' },
} as const;

// ============================================================================
// Obsidian-Specific Patterns (NOT handled by marked)
// ============================================================================

/**
 * Regex patterns for domain-specific parsing
 * Note: Standard markdown parsing should use the marked library
 */
export const REGEX_PATTERNS = {
  // Obsidian-specific patterns (not standard markdown)
  WIKI_LINK: /\[\[([^\]]+)\]\]/,
  WIKI_LINK_GLOBAL: /\[\[([^\]]+)\]\]/g,
  
  // Relationship formats (Obsidian-specific)
  // Note: These patterns work on text that has already had list markers removed by marked
  RELATIONSHIP_FORMATS: {
    TYPE_LINK: /^(\w+)\s+\[\[([^\]]+)\]\]/, // type [[Name]] - canonical (no dash)
    TYPE_COLON_LINK: /^([^:]+):\s*\[\[([^\]]+)\]\]/, // type: [[Name]] - alternative (no dash)
    LINK_TYPE_PARENS: /^\[\[([^\]]+)\]\]\s*\(([^)]+)\)/, // [[Name]] (type) (no dash)
    TYPE_COLON_TEXT: /^([^:]+):\s*(.+)$/, // type: Name - plain text fallback (no dash)
  },
  
  // Relationship formats WITH dash prefix (for fallback/compatibility)
  RELATIONSHIP_FORMATS_WITH_DASH: {
    TYPE_LINK: /^-\s*(\w+)\s+\[\[([^\]]+)\]\]/, // type [[Name]] - with dash
    TYPE_COLON_LINK: /^-\s*([^:]+):\s*\[\[([^\]]+)\]\]/, // type: [[Name]] - with dash
    LINK_TYPE_PARENS: /^-\s*\[\[([^\]]+)\]\]\s*\(([^)]+)\)/, // [[Name]] (type) - with dash
    TYPE_COLON_TEXT: /^-\s*([^:]+):\s*(.+)$/, // type: Name - with dash
  },
  
  // Field parsing (domain-specific, not standard markdown)
  FIELD_FORMATS: {
    LABEL_COLON_VALUE: /^-?\s*([^:]+):\s*(.+)$/,
    LABEL_SPACE_VALUE: /^([A-Za-z]+)\s+(.+)$/,
    LIST_ITEM: /^-\s*(.+)$/,
  },
  
  // Hashtag pattern
  HASHTAG: /#\w+/g,
} as const;
