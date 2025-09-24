import { TFile, App } from 'obsidian';
import { RelationshipType, Gender } from './relationshipGraph';
import { parseRelationshipListItem, inferGenderFromTerm } from './genderUtils';
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
    const related: { type: RelationshipType; value: string }[] = [];

    // Valid relationship types for validation
    const validRelationshipTypes: RelationshipType[] = [
      'parent', 'child', 'sibling', 'spouse', 'friend', 
      'colleague', 'relative', 'auncle', 'nibling', 
      'grandparent', 'grandchild', 'cousin', 'partner'
    ];

    for (const [key, value] of Object.entries(frontmatter)) {
      if (key.startsWith('RELATED')) {
        // Extract type from key format: RELATED[type] or RELATED[index:type]
        const typeMatch = key.match(/RELATED(?:\[(?:\d+:)?([^\]]+)\])?/);
        if (typeMatch && typeMatch[1]) {
          let type = typeMatch[1];

          // Normalize gendered relationship terms to genderless ones
          const inferred = inferGenderFromTerm(type);
          if (inferred) {
            type = inferred.type;
          }

          // Validate relationship type
          if (!validRelationshipTypes.includes(type as RelationshipType)) {
            loggingService.info(`[RelationshipContentParser] Skipping invalid relationship type: ${type}`);
            continue; // Skip invalid relationship types
          }

          // Filter blank values
          const stringValue = String(value || '').trim();
          if (!stringValue || stringValue === 'null' || stringValue === 'undefined') {
            loggingService.info(`[RelationshipContentParser] Skipping blank value for key: ${key}`);
            continue; // Skip blank values
          }

          related.push({ type: type as RelationshipType, value: stringValue });
        }
      }
    }

    return related;
  }

  /**
   * Extract the Related section from markdown content
   */
  extractRelatedSection(content: string): string | null {
    const relatedMatch = content.match(/^#{1,6}\s*related\s*$([^]*?)(?=^#{1,6}|$)/im);
    return relatedMatch ? relatedMatch[1].trim() : null;
  }

  /**
   * Parse relationships from Related section content
   */
  parseRelatedSection(sectionContent: string): { type: RelationshipType; contactName: string; impliedGender?: Gender }[] {
    const relationships: { type: RelationshipType; contactName: string; impliedGender?: Gender }[] = [];
    
    const lines = sectionContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
        const parsed = parseRelationshipListItem(trimmed);
        if (parsed) {
          relationships.push({
            type: parsed.type,
            contactName: parsed.contactName,
            impliedGender: parsed.impliedGender
          });
        }
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
    const { formatRelationshipListItem } = require('./genderUtils');
    
    const relatedListItems = relationships.map(rel => {
      // Get target contact from the relationship graph (we need access to it)
      // For now, we'll pass undefined for gender and let the caller handle this
      return formatRelationshipListItem(rel.type, rel.targetName, undefined);
    });

    const relatedSection = relatedListItems.length > 0 
      ? `\n## Related\n${relatedListItems.join('\n')}\n`
      : '\n## Related\n\n';

    // Replace or add the Related section
    const relatedMatch = content.match(/^(#{1,6})\s*related\s*$([\s\S]*?)(?=^#{1,6}|$)/im);
    if (relatedMatch) {
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
   * Check if content has changes by comparing Related sections
   */
  hasRelatedSectionChanged(
    content: string,
    expectedRelationships: { type: RelationshipType; targetName: string }[]
  ): boolean {
    const currentSection = this.extractRelatedSection(content);
    if (!currentSection && expectedRelationships.length === 0) {
      return false; // Both empty
    }
    
    if (!currentSection || expectedRelationships.length === 0) {
      return true; // One empty, one not
    }

    const currentRelationships = this.parseRelatedSection(currentSection);
    
    if (currentRelationships.length !== expectedRelationships.length) {
      return true;
    }

    // Compare relationships (order-independent)
    const currentSet = new Set(currentRelationships.map(r => `${r.type}:${r.contactName}`));
    const expectedSet = new Set(expectedRelationships.map(r => `${r.type}:${r.targetName}`));
    
    if (currentSet.size !== expectedSet.size) return true;
    
    for (const item of currentSet) {
      if (!expectedSet.has(item)) return true;
    }
    
    return false;
  }

  /**
   * Normalize and clean content for consistent formatting
   */
  normalizeContent(content: string): string {
    // Basic content normalization
    return content
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
      .trim();
  }

  /**
   * Extract front matter from content
   */
  extractFrontMatter(content: string): Record<string, any> | null {
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontMatterMatch) return null;

    try {
      // Parse YAML front matter
      const { parseYaml } = require('obsidian');
      return parseYaml(frontMatterMatch[1]) || {};
    } catch (error) {
      loggingService.error(`[RelationshipContentParser] Error parsing front matter: ${error.message}`);
      return {};
    }
  }

  /**
   * Check if a relationship list item is valid
   */
  isValidRelationshipListItem(line: string): boolean {
    const trimmed = line.trim();
    if (!trimmed.startsWith('-') && !trimmed.startsWith('*')) {
      return false;
    }
    
    const parsed = parseRelationshipListItem(trimmed);
    return parsed !== null;
  }

  /**
   * Get relationship statistics from content
   */
  getRelationshipStats(content: string): {
    relatedSectionExists: boolean;
    relatedSectionRelationships: number;
    frontMatterRelationships: number;
    inconsistencies: string[];
  } {
    const stats = {
      relatedSectionExists: false,
      relatedSectionRelationships: 0,
      frontMatterRelationships: 0,
      inconsistencies: [] as string[]
    };

    // Check Related section
    const relatedSection = this.extractRelatedSection(content);
    if (relatedSection) {
      stats.relatedSectionExists = true;
      const relationships = this.parseRelatedSection(relatedSection);
      stats.relatedSectionRelationships = relationships.length;
    }

    // Check front matter
    const frontMatter = this.extractFrontMatter(content);
    if (frontMatter) {
      const frontMatterRelationships = this.parseRelatedFromFrontmatter(frontMatter);
      stats.frontMatterRelationships = frontMatterRelationships.length;

      // Check for inconsistencies
      if (stats.relatedSectionExists && stats.relatedSectionRelationships !== stats.frontMatterRelationships) {
        stats.inconsistencies.push(
          `Related section has ${stats.relatedSectionRelationships} relationships but front matter has ${stats.frontMatterRelationships}`
        );
      }
    }

    return stats;
  }
}