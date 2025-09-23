/**
 * @fileoverview Markdown relationship list management
 */

import { RelationshipTriple, RELATIONSHIP_GENDER_MAPPING } from './types';

export interface ParsedRelatedListItem {
  relationshipKind: string;
  contactName: string;
  isValid: boolean;
  rawLine: string;
}

/**
 * Parse a markdown list item from the Related section
 * Expected format: "- relationship_kind [[Contact Name]]"
 */
export function parseRelatedListItem(line: string): ParsedRelatedListItem {
  const trimmed = line.trim();
  
  // Check if it's a list item
  if (!trimmed.startsWith('- ')) {
    return {
      relationshipKind: '',
      contactName: '',
      isValid: false,
      rawLine: line
    };
  }

  const content = trimmed.substring(2).trim();
  
  // Look for the pattern: relationship_kind [[Contact Name]]
  const match = content.match(/^(\w+)\s+\[\[([^\]]+)\]\]$/);
  
  if (!match) {
    return {
      relationshipKind: '',
      contactName: '',
      isValid: false,
      rawLine: line
    };
  }

  return {
    relationshipKind: match[1].toLowerCase(),
    contactName: match[2],
    isValid: true,
    rawLine: line
  };
}

/**
 * Format a relationship as a markdown list item
 */
export function formatRelatedListItem(relationshipKind: string, contactName: string, gender?: string): string {
  // Try to render with appropriate gendered term if gender is known
  let displayKind = relationshipKind;
  
  if (gender && RELATIONSHIP_GENDER_MAPPING[relationshipKind]) {
    const genderMap = RELATIONSHIP_GENDER_MAPPING[relationshipKind];
    if (gender === 'M' || gender === 'MALE') {
      displayKind = genderMap.male;
    } else if (gender === 'F' || gender === 'FEMALE') {
      displayKind = genderMap.female;
    } else {
      displayKind = genderMap.neutral;
    }
  }

  return `- ${displayKind} [[${contactName}]]`;
}

/**
 * Extract the Related section from markdown content
 */
export function extractRelatedSection(content: string): { 
  beforeSection: string; 
  relatedLines: string[]; 
  afterSection: string;
  hasRelatedHeading: boolean;
  relatedHeadingLine: string;
} {
  const lines = content.split('\n');
  let relatedHeadingIndex = -1;
  let relatedEndIndex = -1;
  
  // Find the Related heading (case insensitive, any depth)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^(#+)\s*related\s*$/i);
    if (match) {
      relatedHeadingIndex = i;
      break;
    }
  }

  if (relatedHeadingIndex === -1) {
    return {
      beforeSection: content,
      relatedLines: [],
      afterSection: '',
      hasRelatedHeading: false,
      relatedHeadingLine: ''
    };
  }

  // Find the end of the Related section (next heading or end of file)
  relatedEndIndex = lines.length;
  for (let i = relatedHeadingIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.match(/^#+\s/)) {  // Another heading
      relatedEndIndex = i;
      break;
    }
  }

  // Extract the sections
  const beforeSection = lines.slice(0, relatedHeadingIndex).join('\n');
  const relatedHeading = lines[relatedHeadingIndex];
  const relatedContent = lines.slice(relatedHeadingIndex + 1, relatedEndIndex);
  const afterSection = lines.slice(relatedEndIndex).join('\n');

  // Clean up the related content - remove empty lines at start and end
  const cleanedRelatedLines: string[] = [];
  let inContent = false;
  
  for (const line of relatedContent) {
    if (line.trim() || inContent) {
      cleanedRelatedLines.push(line);
      if (line.trim()) {
        inContent = true;
      }
    }
  }

  // Remove trailing empty lines
  while (cleanedRelatedLines.length > 0 && !cleanedRelatedLines[cleanedRelatedLines.length - 1].trim()) {
    cleanedRelatedLines.pop();
  }

  return {
    beforeSection: beforeSection.trim() ? beforeSection + '\n' : '',
    relatedLines: cleanedRelatedLines,
    afterSection: afterSection.trim() ? '\n' + afterSection : '',
    hasRelatedHeading: true,
    relatedHeadingLine: relatedHeading
  };
}

/**
 * Build the complete markdown content with the Related section
 */
export function buildMarkdownWithRelatedSection(
  beforeSection: string,
  relatedItems: string[],
  afterSection: string,
  existingHeadingLine?: string
): string {
  let content = beforeSection.trim();
  
  // Add the Related heading (fix capitalization if needed)
  const headingLine = existingHeadingLine?.replace(/related/i, 'Related') || '## Related';
  
  if (content) {
    content += '\n\n';
  }
  content += headingLine + '\n';

  // Add related items
  if (relatedItems.length > 0) {
    content += '\n' + relatedItems.join('\n') + '\n';
  }

  // Add the rest of the content
  if (afterSection.trim()) {
    content += afterSection;
  }

  return content;
}

/**
 * Parse all relationships from a Related section
 */
export function parseAllRelatedItems(relatedLines: string[]): ParsedRelatedListItem[] {
  return relatedLines.map(parseRelatedListItem);
}

/**
 * Check if a contact note needs a Related section added
 */
export function needsRelatedSection(content: string, hasRelationships: boolean): boolean {
  const { hasRelatedHeading } = extractRelatedSection(content);
  return hasRelationships && !hasRelatedHeading;
}

/**
 * Clean up duplicate or conflicting Related headings
 */
export function cleanupDuplicateRelatedHeadings(content: string): string {
  const lines = content.split('\n');
  const relatedHeadings: number[] = [];
  
  // Find all Related headings
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^#+\s*related\s*$/i)) {
      relatedHeadings.push(i);
    }
  }

  if (relatedHeadings.length <= 1) {
    return content;  // No duplicates
  }

  // Keep the first one that has content, or the last one if none have content
  let keepIndex = relatedHeadings[relatedHeadings.length - 1];  // Default to last
  
  for (const index of relatedHeadings) {
    // Check if this heading has content after it
    let hasContent = false;
    for (let i = index + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.match(/^#+\s/)) break;  // Next heading
      if (line.trim().startsWith('- ')) {
        hasContent = true;
        break;
      }
    }
    
    if (hasContent) {
      keepIndex = index;
      break;
    }
  }

  // Remove all other Related headings
  const filteredLines = lines.filter((line, index) => {
    return !relatedHeadings.includes(index) || index === keepIndex;
  });

  return filteredLines.join('\n');
}