import { Gender, RelationshipType } from './relationshipGraph';
import { normalizeRelationshipTerm, inferGenderFromTerm } from './genderUtils';

/**
 * Parsed relationship from Related list
 */
export interface ParsedRelationship {
  type: RelationshipType;
  contactName: string;
  impliedGender?: Gender;
}

/**
 * Result of parsing Related list content
 */
export interface RelatedListParseResult {
  relationships: ParsedRelationship[];
  sectionFound: boolean;
  sectionStartLine?: number;
  sectionEndLine?: number;
}

/**
 * Parser for relationship data from markdown content and frontmatter
 */
export class RelationshipContentParser {
  
  /**
   * Parse relationships from Related list in markdown content
   */
  parseRelatedList(content: string): RelatedListParseResult {
    const lines = content.split('\n');
    const relationships: ParsedRelationship[] = [];
    let sectionFound = false;
    let sectionStartLine: number | undefined;
    let sectionEndLine: number | undefined;
    let inRelatedSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check for Related section header
      if (this.isRelatedSectionHeader(line)) {
        sectionFound = true;
        sectionStartLine = i;
        inRelatedSection = true;
        continue;
      }
      
      // Check for end of Related section (next header or end of file)
      if (inRelatedSection && this.isHeaderLine(line)) {
        sectionEndLine = i;
        inRelatedSection = false;
        continue;
      }
      
      // Parse relationship lines within Related section
      if (inRelatedSection && this.isRelationshipLine(line)) {
        const relationship = this.parseRelationshipLine(line);
        if (relationship) {
          relationships.push(relationship);
        }
      }
    }
    
    // If we were still in Related section at end of file, mark end
    if (inRelatedSection && sectionEndLine === undefined) {
      sectionEndLine = lines.length;
    }

    return {
      relationships,
      sectionFound,
      sectionStartLine,
      sectionEndLine
    };
  }

  /**
   * Generate Related list content from relationships
   */
  generateRelatedListContent(
    relationships: { type: RelationshipType; targetName: string; targetGender?: Gender }[]
  ): string {
    if (relationships.length === 0) {
      return '## Related\n\n';
    }

    const lines: string[] = ['## Related'];
    
    // Sort relationships by type first, then by name
    const sortedRelationships = [...relationships].sort((a, b) => {
      const typeComparison = a.type.localeCompare(b.type);
      if (typeComparison !== 0) return typeComparison;
      return a.targetName.localeCompare(b.targetName);
    });

    for (const rel of sortedRelationships) {
      const term = this.getDisplayTerm(rel.type, rel.targetGender);
      lines.push(`- ${term} [[${rel.targetName}]]`);
    }

    lines.push(''); // Add empty line after Related section
    return lines.join('\n');
  }

  /**
   * Update Related section in content
   */
  updateRelatedSection(
    content: string,
    relationships: { type: RelationshipType; targetName: string; targetGender?: Gender }[]
  ): string {
    const parseResult = this.parseRelatedList(content);
    const newRelatedContent = this.generateRelatedListContent(relationships);
    
    if (!parseResult.sectionFound) {
      // Add Related section at the end
      return content.endsWith('\n') ? content + newRelatedContent : content + '\n' + newRelatedContent;
    }

    const lines = content.split('\n');
    const startLine = parseResult.sectionStartLine!;
    const endLine = parseResult.sectionEndLine || lines.length;

    // Replace the existing Related section
    const before = lines.slice(0, startLine);
    const after = lines.slice(endLine);
    const newLines = newRelatedContent.split('\n');

    return [...before, ...newLines, ...after].join('\n');
  }

  /**
   * Check if a line is a Related section header
   */
  private isRelatedSectionHeader(line: string): boolean {
    return /^#{1,6}\s*related\s*$/i.test(line);
  }

  /**
   * Check if a line is a header line
   */
  private isHeaderLine(line: string): boolean {
    return /^#{1,6}\s/.test(line);
  }

  /**
   * Check if a line is a relationship line (list item with relationship term)
   */
  private isRelationshipLine(line: string): boolean {
    return /^-\s+\w+\s+\[\[.+\]\]/.test(line);
  }

  /**
   * Parse a single relationship line
   */
  private parseRelationshipLine(line: string): ParsedRelationship | null {
    // Match pattern: - relationshipterm [[Contact Name]]
    const match = line.match(/^-\s+(\w+)\s+\[\[([^\]]+)\]\]/);
    if (!match) return null;

    const termString = match[1];
    const contactName = match[2];

    const relationshipType = normalizeRelationshipTerm(termString);
    if (!relationshipType) return null;

    const impliedGender = inferGenderFromTerm(termString);

    return {
      type: relationshipType,
      contactName: contactName.trim(),
      impliedGender
    };
  }

  /**
   * Get display term for a relationship type based on gender
   */
  private getDisplayTerm(type: RelationshipType, gender?: Gender): string {
    const genderTerms: Record<RelationshipType, { M: string; F: string; neutral: string }> = {
      'parent': { M: 'father', F: 'mother', neutral: 'parent' },
      'child': { M: 'son', F: 'daughter', neutral: 'child' },
      'sibling': { M: 'brother', F: 'sister', neutral: 'sibling' },
      'grandparent': { M: 'grandfather', F: 'grandmother', neutral: 'grandparent' },
      'grandchild': { M: 'grandson', F: 'granddaughter', neutral: 'grandchild' },
      'auncle': { M: 'uncle', F: 'aunt', neutral: 'auncle' },
      'nibling': { M: 'nephew', F: 'niece', neutral: 'nibling' },
      'spouse': { M: 'spouse', F: 'spouse', neutral: 'spouse' },
      'partner': { M: 'partner', F: 'partner', neutral: 'partner' },
      'cousin': { M: 'cousin', F: 'cousin', neutral: 'cousin' },
      'friend': { M: 'friend', F: 'friend', neutral: 'friend' },
      'colleague': { M: 'colleague', F: 'colleague', neutral: 'colleague' },
      'relative': { M: 'relative', F: 'relative', neutral: 'relative' }
    };

    const terms = genderTerms[type];
    if (!terms) return type;

    switch (gender) {
      case 'M':
        return terms.M;
      case 'F':
        return terms.F;
      default:
        return terms.neutral;
    }
  }

  /**
   * Extract contact links from content
   */
  extractContactLinks(content: string): string[] {
    const linkPattern = /\[\[([^\]]+)\]\]/g;
    const links: string[] = [];
    let match;

    while ((match = linkPattern.exec(content)) !== null) {
      const linkText = match[1].trim();
      if (linkText) {
        links.push(linkText);
      }
    }

    return [...new Set(links)]; // Remove duplicates
  }

  /**
   * Check if content has a Related section
   */
  hasRelatedSection(content: string): boolean {
    return this.parseRelatedList(content).sectionFound;
  }

  /**
   * Extract all relationship terms from content (for analysis)
   */
  extractRelationshipTerms(content: string): string[] {
    const parseResult = this.parseRelatedList(content);
    const terms: string[] = [];

    for (const line of content.split('\n')) {
      if (this.isRelationshipLine(line)) {
        const match = line.match(/^-\s+(\w+)\s+\[\[/);
        if (match) {
          terms.push(match[1].toLowerCase());
        }
      }
    }

    return [...new Set(terms)];
  }
}