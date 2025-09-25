/**
 * Utilities for parsing and formatting relationship data
 */

import { RelatedListItem, RelationshipType, GenderlessKind, Gender, RelatedField } from './types';
import { GenderManager } from './genderManager';

const genderManager = new GenderManager();

/**
 * Parse RELATED fields from front matter
 */
export function parseRelatedFromFrontMatter(frontMatter: Record<string, any>): RelatedField[] {
  const related: RelatedField[] = [];
  
  for (const [key, value] of Object.entries(frontMatter)) {
    if (key.startsWith('RELATED[') || key === 'RELATED') {
      let relationshipType: string;
      
      if (key === 'RELATED') {
        // Single RELATED field without array notation
        relationshipType = 'friend'; // Default type
      } else {
        // Extract type from RELATED[type] or RELATED[1:type] format
        const match = key.match(/RELATED\[(?:\d+:)?(.+)\]$/);
        if (!match) continue;
        relationshipType = match[1];
      }
      
      // Normalize to genderless type
      const genderlessType = genderManager.encodeToGenderless(relationshipType as RelationshipType);
      
      related.push({
        type: genderlessType,
        value: String(value)
      });
    }
  }
  
  // Sort by type then by value for consistency
  return related.sort((a, b) => {
    const typeCompare = a.type.localeCompare(b.type);
    if (typeCompare !== 0) return typeCompare;
    return a.value.localeCompare(b.value);
  });
}

/**
 * Convert RELATED fields to front matter format
 */
export function relatedFieldsToFrontMatter(fields: RelatedField[]): Record<string, string> {
  const frontMatter: Record<string, string> = {};
  
  // Sort fields by type then by value to ensure deterministic output
  const sortedFields = [...fields].sort((a, b) => {
    const typeCompare = a.type.localeCompare(b.type);
    if (typeCompare !== 0) return typeCompare;
    return a.value.localeCompare(b.value);
  });
  
  // Group by type to handle array notation
  const groupedByType: Partial<Record<GenderlessKind, RelatedField[]>> = {};
  for (const field of sortedFields) {
    if (!groupedByType[field.type]) {
      groupedByType[field.type] = [];
    }
    groupedByType[field.type]!.push(field);
  }
  
  // Generate front matter keys
  for (const [type, typeFields] of Object.entries(groupedByType)) {
    if (typeFields.length === 1) {
      // Single field: RELATED[type]
      frontMatter[`RELATED[${type}]`] = typeFields[0].value;
    } else {
      // Multiple fields: RELATED[type], RELATED[1:type], RELATED[2:type], etc.
      typeFields.forEach((field, index) => {
        if (index === 0) {
          frontMatter[`RELATED[${type}]`] = field.value;
        } else {
          frontMatter[`RELATED[${index}:${type}]`] = field.value;
        }
      });
    }
  }
  
  return frontMatter;
}

/**
 * Parse a Related section from markdown content
 */
export function parseRelatedSection(content: string): RelatedListItem[] {
  const items: RelatedListItem[] = [];
  const lines = content.split('\n');
  
  let inRelatedSection = false;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Check for Related heading
    if (/^#{1,6}\s*related\s*$/i.test(trimmedLine)) {
      inRelatedSection = true;
      continue;
    }
    
    // Check for next section (any other heading)
    if (inRelatedSection && /^#{1,6}\s+/.test(trimmedLine)) {
      break;
    }
    
    // Parse relationship list items
    if (inRelatedSection && trimmedLine.startsWith('- ')) {
      const match = trimmedLine.match(/^-\s*(\w+)\s*\[\[(.+?)\]\]/);
      if (match) {
        const [, relationshipType, targetName] = match;
        
        // Analyze for gender implications
        const genderInfo = genderManager.inferGenderFromRelationship(relationshipType as RelationshipType);
        
        items.push({
          type: relationshipType as RelationshipType,
          targetName: targetName.trim(),
          impliedGender: genderInfo.inferredGender
        });
      }
    }
  }
  
  return items;
}

/**
 * Find the Related section in markdown content
 */
export function extractRelatedSection(content: string): string | null {
  const lines = content.split('\n');
  let start = -1;
  let end = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const trimmedLine = lines[i].trim();
    
    // Find Related heading
    if (/^#{1,6}\s*related\s*$/i.test(trimmedLine)) {
      start = i;
      continue;
    }
    
    // Find end of Related section (next heading or end of file)
    if (start !== -1 && /^#{1,6}\s+/.test(trimmedLine)) {
      end = i;
      break;
    }
  }
  
  if (start === -1) return null;
  if (end === -1) end = lines.length;
  
  return lines.slice(start, end).join('\n');
}

/**
 * Format a relationship list item for markdown
 */
export function formatRelationshipListItem(
  type: GenderlessKind, 
  targetName: string, 
  targetGender?: Gender
): string {
  // Convert to gendered form for display if gender is known
  const displayType = genderManager.decodeToGendered(type, targetGender);
  return `- ${displayType} [[${targetName}]]`;
}

/**
 * Update or create a Related section in markdown content
 */
export function updateRelatedSection(content: string, items: RelatedListItem[]): string {
  const lines = content.split('\n');
  let relatedStart = -1;
  let relatedEnd = -1;
  
  // Find existing Related section
  for (let i = 0; i < lines.length; i++) {
    const trimmedLine = lines[i].trim();
    
    if (/^#{1,6}\s*related\s*$/i.test(trimmedLine)) {
      relatedStart = i;
      
      // Find end of section
      for (let j = i + 1; j < lines.length; j++) {
        if (/^#{1,6}\s+/.test(lines[j].trim())) {
          relatedEnd = j;
          break;
        }
      }
      if (relatedEnd === -1) relatedEnd = lines.length;
      break;
    }
  }
  
  // Generate new Related section content
  const relatedContent: string[] = [];
  if (items.length > 0) {
    relatedContent.push('## Related');
    relatedContent.push('');
    
    // Sort items by type then by name for consistency
    const sortedItems = [...items].sort((a, b) => {
      const genderlessA = genderManager.encodeToGenderless(a.type);
      const genderlessB = genderManager.encodeToGenderless(b.type);
      const typeCompare = genderlessA.localeCompare(genderlessB);
      if (typeCompare !== 0) return typeCompare;
      return a.targetName.localeCompare(b.targetName);
    });
    
    for (const item of sortedItems) {
      relatedContent.push(formatRelationshipListItem(
        genderManager.encodeToGenderless(item.type),
        item.targetName,
        item.impliedGender
      ));
    }
    relatedContent.push('');
  } else {
    relatedContent.push('## Related');
    relatedContent.push('');
    relatedContent.push('');
  }
  
  // Update content
  if (relatedStart !== -1) {
    // Replace existing section
    const before = lines.slice(0, relatedStart);
    const after = lines.slice(relatedEnd);
    return [...before, ...relatedContent, ...after].join('\n');
  } else {
    // Add new section at the end
    return content + '\n' + relatedContent.join('\n');
  }
}

/**
 * Clean up duplicate Related headings and empty sections
 */
export function cleanupRelatedSections(content: string): string {
  const lines = content.split('\n');
  const cleanedLines: string[] = [];
  const relatedSections: Array<{start: number, end: number, hasContent: boolean}> = [];
  
  // Find all Related sections
  for (let i = 0; i < lines.length; i++) {
    const trimmedLine = lines[i].trim();
    
    if (/^#{1,6}\s*related\s*$/i.test(trimmedLine)) {
      let end = lines.length;
      let hasContent = false;
      
      // Find end and check for content
      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j].trim();
        if (/^#{1,6}\s+/.test(nextLine)) {
          end = j;
          break;
        }
        if (nextLine.startsWith('- ') && nextLine.includes('[[') && nextLine.includes(']]')) {
          hasContent = true;
        }
      }
      
      relatedSections.push({start: i, end, hasContent});
    }
  }
  
  // Keep only one Related section (prefer the one with content)
  let keepSection = -1;
  if (relatedSections.length > 1) {
    // Find section with content, or keep the first one
    keepSection = relatedSections.findIndex(s => s.hasContent);
    if (keepSection === -1) keepSection = 0;
  } else if (relatedSections.length === 1) {
    keepSection = 0;
  }
  
  // Copy lines, skipping duplicate sections
  let skipUntil = -1;
  for (let i = 0; i < lines.length; i++) {
    if (i < skipUntil) continue;
    
    const sectionIndex = relatedSections.findIndex(s => s.start === i);
    if (sectionIndex !== -1) {
      if (sectionIndex === keepSection) {
        // Keep this section, but fix the heading capitalization
        const section = relatedSections[sectionIndex];
        cleanedLines.push('## Related');
        // Copy the rest of the section
        for (let j = i + 1; j < section.end; j++) {
          cleanedLines.push(lines[j]);
        }
        skipUntil = section.end;
      } else {
        // Skip this section
        skipUntil = relatedSections[sectionIndex].end;
      }
    } else {
      cleanedLines.push(lines[i]);
    }
  }
  
  return cleanedLines.join('\n');
}

/**
 * Generate REV timestamp in vCard format
 */
export function generateRevTimestamp(): string {
  return new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/**
 * Check if front matter has meaningful changes (not just reordering)
 */
export function hasMeaningfulChanges(
  oldFrontMatter: Record<string, any>, 
  newFrontMatter: Record<string, any>
): boolean {
  const oldRelated = parseRelatedFromFrontMatter(oldFrontMatter);
  const newRelated = parseRelatedFromFrontMatter(newFrontMatter);
  
  // Compare sorted arrays to ignore ordering differences
  const oldSorted = oldRelated.sort((a, b) => `${a.type}:${a.value}`.localeCompare(`${b.type}:${b.value}`));
  const newSorted = newRelated.sort((a, b) => `${a.type}:${a.value}`.localeCompare(`${b.type}:${b.value}`));
  
  if (oldSorted.length !== newSorted.length) return true;
  
  for (let i = 0; i < oldSorted.length; i++) {
    if (oldSorted[i].type !== newSorted[i].type || oldSorted[i].value !== newSorted[i].value) {
      return true;
    }
  }
  
  return false;
}