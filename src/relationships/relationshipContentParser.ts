import { App } from 'obsidian';
import { RelationshipType, ParsedRelationship, Gender, RelatedField } from './relationshipTypes';
import { parseRelationshipFromListItem, formatRelationshipListItem, parseRelatedFrontMatterKey, generateRelatedFrontMatterKey } from './relationshipUtils';
import { loggingService } from '../services/loggingService';

/**
 * Handles parsing and content manipulation for relationship sections and front matter
 */
export class RelationshipContentParser {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  /**
   * Parse RELATED fields from frontmatter
   */
  parseRelatedFromFrontmatter(frontmatter: Record<string, any>): { type: RelationshipType; value: string }[] {
    const relatedFields: { type: RelationshipType; value: string }[] = [];

    // Group RELATED fields by type for sorting
    const groupedFields: Record<RelationshipType, string[]> = {} as Record<RelationshipType, string[]>;

    for (const [key, value] of Object.entries(frontmatter)) {
      const parsed = parseRelatedFrontMatterKey(key);
      if (parsed && value) {
        if (!groupedFields[parsed.type]) {
          groupedFields[parsed.type] = [];
        }
        groupedFields[parsed.type].push(String(value));
      }
    }

    // Sort each group and add to results
    for (const [type, values] of Object.entries(groupedFields)) {
      const sortedValues = values.sort();
      for (const value of sortedValues) {
        relatedFields.push({ type: type as RelationshipType, value });
      }
    }

    return relatedFields;
  }

  /**
   * Extract the Related section from markdown content
   */
  extractRelatedSection(content: string): string | null {
    loggingService.info(`[RelationshipContentParser] Looking for Related section in content (${content.length} chars)`);
    
    // Find the Related section with case-insensitive matching
    const relatedMatch = content.match(/^(#{1,6})\s*related\s*$/im);
    if (!relatedMatch) {
      loggingService.info(`[RelationshipContentParser] No Related section found`);
      return null;
    }
    
    const headerLevel = relatedMatch[1];
    const headerIndex = relatedMatch.index!;
    
    // Get content after the Related header
    const afterHeader = content.substring(headerIndex + relatedMatch[0].length);
    
    // Find the next header of same or higher level to determine section end
    const nextHeaderPattern = new RegExp(`^#{1,${headerLevel.length}}\\s+`, 'm');
    const nextHeaderMatch = afterHeader.match(nextHeaderPattern);
    
    let sectionContent: string;
    if (nextHeaderMatch) {
      sectionContent = afterHeader.substring(0, nextHeaderMatch.index!);
    } else {
      sectionContent = afterHeader;
    }
    
    loggingService.info(`[RelationshipContentParser] Found Related section with ${sectionContent.length} chars`);
    return sectionContent.trim();
  }

  /**
   * Parse relationships from Related section content
   */
  parseRelatedSection(sectionContent: string): ParsedRelationship[] {
    const relationships: ParsedRelationship[] = [];
    const lines = sectionContent.split('\n');
    
    loggingService.info(`[RelationshipContentParser] Parsing ${lines.length} lines from Related section`);
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines and non-list items
      if (!trimmed || !trimmed.startsWith('-')) {
        continue;
      }
      
      const parsed = parseRelationshipFromListItem(trimmed);
      if (parsed) {
        relationships.push(parsed);
        loggingService.info(`[RelationshipContentParser] Parsed relationship: ${parsed.type} -> ${parsed.contactName}${parsed.impliedGender ? ` (gender: ${parsed.impliedGender})` : ''}`);
      } else {
        loggingService.warn(`[RelationshipContentParser] Could not parse relationship from line: ${trimmed}`);
      }
    }
    
    return relationships;
  }

  /**
   * Update the Related section in content
   */
  updateRelatedSectionInContent(
    content: string, 
    relationships: { type: RelationshipType; targetUid: string; targetName: string }[]
  ): string {
    // Create the new Related list items
    const relatedListItems = relationships.map(rel => {
      // For now, we don't have gender info readily available, so use genderless terms
      return formatRelationshipListItem(rel.type, rel.targetName, undefined);
    });

    const relatedSection = relatedListItems.length > 0 
      ? `\n## Related\n\n${relatedListItems.join('\n')}\n`
      : '\n## Related\n\n';

    // Find and replace or add the Related section
    const relatedMatch = content.match(/^(#{1,6})\s*related\s*$[\s\S]*?(?=^#{1,6}|$)/im);
    if (relatedMatch) {
      // Replace existing section
      return content.replace(relatedMatch[0], relatedSection.trim());
    } else {
      // Add Related section before any existing sections or at the end
      const firstSectionMatch = content.match(/^#{1,6}\s+/m);
      if (firstSectionMatch) {
        const insertPos = content.indexOf(firstSectionMatch[0]);
        return content.slice(0, insertPos) + relatedSection + content.slice(insertPos);
      } else {
        return content + relatedSection;
      }
    }
  }

  /**
   * Convert relationships to front matter RELATED fields
   */
  relationshipsToFrontMatter(relationships: { type: RelationshipType; value: string }[]): Record<string, string> {
    const frontMatter: Record<string, string> = {};
    
    // Group by type and sort values
    const groupedByType: Record<RelationshipType, string[]> = {} as Record<RelationshipType, string[]>;
    
    for (const rel of relationships) {
      if (!groupedByType[rel.type]) {
        groupedByType[rel.type] = [];
      }
      groupedByType[rel.type].push(rel.value);
    }
    
    // Generate front matter keys
    for (const [type, values] of Object.entries(groupedByType)) {
      const sortedValues = values.sort();
      for (let i = 0; i < sortedValues.length; i++) {
        const key = generateRelatedFrontMatterKey(type as RelationshipType, i);
        frontMatter[key] = sortedValues[i];
      }
    }
    
    return frontMatter;
  }

  /**
   * Clean up Related section formatting
   */
  cleanRelatedSection(content: string): string {
    // Find Related section
    const relatedMatch = content.match(/^(#{1,6})\s*related\s*$([\s\S]*?)(?=^#{1,6}|$)/im);
    if (!relatedMatch) {
      return content;
    }

    const headerLevel = relatedMatch[1];
    const sectionContent = relatedMatch[2];
    
    // Clean up the section content
    const lines = sectionContent.split('\n');
    const cleanedLines: string[] = [];
    let hasContent = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('-') && trimmed.includes('[[') && trimmed.includes(']]')) {
        // This is a relationship list item
        cleanedLines.push(`- ${trimmed.substring(1).trim()}`);
        hasContent = true;
      } else if (trimmed === '') {
        // Keep empty lines but limit consecutive ones
        if (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1] !== '') {
          cleanedLines.push('');
        }
      }
    }
    
    // Remove trailing empty lines
    while (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1] === '') {
      cleanedLines.pop();
    }
    
    // Ensure proper spacing
    let cleanedSection = `${headerLevel} Related\n`;
    if (hasContent) {
      cleanedSection += '\n' + cleanedLines.join('\n') + '\n';
    } else {
      cleanedSection += '\n';
    }
    
    return content.replace(relatedMatch[0], cleanedSection);
  }
}