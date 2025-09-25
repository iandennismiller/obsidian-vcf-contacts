import { Gender, RelationshipType } from './relationshipGraph';
import { parseRelationshipListItem } from './relationshipUtils';

/**
 * Parses and manages Related list content in markdown files
 */
export class RelationshipContentParser {
  
  /**
   * Find the Related heading in content at any depth
   */
  findRelatedHeading(content: string): { match: RegExpMatchArray; start: number; end: number } | null {
    // Match "related" heading at any depth (case insensitive)
    const regex = /^(#{1,6})\s*related\s*$/im;
    const match = content.match(regex);
    
    if (!match) {
      return null;
    }

    const start = content.indexOf(match[0]);
    const end = start + match[0].length;

    return { match, start, end };
  }

  /**
   * Parse relationships from the Related section
   */
  parseRelatedSection(content: string): { type: RelationshipType; contactName: string; impliedGender?: Gender }[] {
    const relatedHeading = this.findRelatedHeading(content);
    if (!relatedHeading) {
      return [];
    }

    // Extract content after the Related heading until next heading or end
    const afterHeading = content.substring(relatedHeading.end);
    const nextHeadingMatch = afterHeading.match(/^#{1,6}\s+/m);
    const sectionContent = nextHeadingMatch 
      ? afterHeading.substring(0, afterHeading.indexOf(nextHeadingMatch[0]))
      : afterHeading;

    // Parse each line for relationship items
    const relationships: { type: RelationshipType; contactName: string; impliedGender?: Gender }[] = [];
    const lines = sectionContent.split('\n');

    for (const line of lines) {
      const parsed = parseRelationshipListItem(line);
      if (parsed) {
        relationships.push(parsed);
      }
    }

    return relationships;
  }

  /**
   * Normalize Related heading to ## Related
   */
  normalizeRelatedHeading(content: string): string {
    const relatedHeading = this.findRelatedHeading(content);
    if (!relatedHeading) {
      return content;
    }

    // Replace the heading with normalized version
    const beforeHeading = content.substring(0, relatedHeading.start);
    const afterHeading = content.substring(relatedHeading.end);
    
    return beforeHeading + '## Related' + afterHeading;
  }

  /**
   * Remove empty or duplicate Related headings
   */
  cleanupRelatedHeadings(content: string): string {
    // Find all Related headings
    const regex = /^(#{1,6})\s*related\s*$/gim;
    const matches = Array.from(content.matchAll(regex));
    
    if (matches.length <= 1) {
      return content;
    }

    // Keep only the first one, remove others
    let result = content;
    
    // Process matches in reverse order to avoid index shifting
    for (let i = matches.length - 1; i >= 1; i--) {
      const match = matches[i];
      const start = match.index!;
      const end = start + match[0].length;
      
      // Check if this heading has any content
      const afterHeading = result.substring(end);
      const nextHeadingMatch = afterHeading.match(/^#{1,6}\s+/m);
      const sectionContent = nextHeadingMatch 
        ? afterHeading.substring(0, afterHeading.indexOf(nextHeadingMatch[0]))
        : afterHeading;
      
      // If section is empty or only whitespace, remove the heading
      if (!sectionContent.trim()) {
        result = result.substring(0, start) + result.substring(end);
      }
    }

    return result;
  }

  /**
   * Ensure exactly one Related heading exists
   */
  ensureRelatedHeading(content: string): string {
    // First clean up any duplicates
    let result = this.cleanupRelatedHeadings(content);
    
    // Then normalize the remaining one
    result = this.normalizeRelatedHeading(result);
    
    // If no Related heading exists, add one
    const hasRelatedHeading = this.findRelatedHeading(result);
    if (!hasRelatedHeading) {
      // Add Related section before any existing sections or at the end
      const firstSectionMatch = result.match(/^#{1,6}\s+/m);
      if (firstSectionMatch) {
        const insertPos = result.indexOf(firstSectionMatch[0]);
        result = result.slice(0, insertPos) + '## Related\n\n' + result.slice(insertPos);
      } else {
        result = result.trimEnd() + '\n\n## Related\n\n';
      }
    }

    return result;
  }

  /**
   * Update the Related section with new relationships
   */
  updateRelatedSection(
    content: string, 
    relationships: { type: RelationshipType; contactName: string; gender?: Gender }[]
  ): string {
    // Ensure Related heading exists and is normalized
    let result = this.ensureRelatedHeading(content);
    
    const relatedHeading = this.findRelatedHeading(result);
    if (!relatedHeading) {
      throw new Error('Failed to ensure Related heading');
    }

    // Find the end of the Related section
    const afterHeading = result.substring(relatedHeading.end);
    const nextHeadingMatch = afterHeading.match(/^#{1,6}\s+/m);
    const sectionEndPos = nextHeadingMatch 
      ? relatedHeading.end + afterHeading.indexOf(nextHeadingMatch[0])
      : result.length;

    // Build new Related section content
    const relationshipLines = relationships.map(rel => {
      return `- ${rel.type} [[${rel.contactName}]]`;
    });

    const newSectionContent = relationshipLines.length > 0 
      ? '\n' + relationshipLines.join('\n') + '\n'
      : '\n\n';

    // Replace the Related section content
    const beforeSection = result.substring(0, relatedHeading.end);
    const afterSection = result.substring(sectionEndPos);
    
    return beforeSection + newSectionContent + afterSection;
  }

  /**
   * Check if content has a Related section
   */
  hasRelatedSection(content: string): boolean {
    return this.findRelatedHeading(content) !== null;
  }

  /**
   * Get the position where Related section should be inserted
   */
  getInsertPosition(content: string): number {
    // Insert before first section if any, otherwise at end
    const firstSectionMatch = content.match(/^#{1,6}\s+/m);
    if (firstSectionMatch) {
      return content.indexOf(firstSectionMatch[0]);
    }
    return content.trimEnd().length;
  }
}