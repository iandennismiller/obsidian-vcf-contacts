/**
 * @fileoverview Graph-based YAML-Markdown mapper for relationship data.
 * 
 * This module provides bidirectional mapping between:
 * - Graphology relationship graph
 * - YAML frontmatter RELATED fields
 * - Markdown relationship sections
 * 
 * All operations flow through the graph to ensure consistency.
 */

import { RelationshipGraph, RelationshipEdge } from './relationshipGraph';
import { RELATIONSHIP_TYPES } from './relationships';
import { loggingService } from '../services/loggingService';

export interface GraphSyncOperation {
  type: 'add' | 'remove' | 'update';
  sourceUid: string;
  targetIdentifier: string;
  relationshipType: string;
  isNameBased: boolean;
}

export interface GraphToYAMLResult {
  yamlFields: Record<string, string>;
  operations: GraphSyncOperation[];
}

export interface GraphToMarkdownResult {
  markdownContent: string;
  relationships: RelationshipEdge[];
}

/**
 * Enhanced YAML-Markdown mapper using the relationship graph as the source of truth.
 */
export class GraphYAMLMarkdownMapper {
  private relationshipGraph: RelationshipGraph;

  constructor(relationshipGraph: RelationshipGraph) {
    this.relationshipGraph = relationshipGraph;
  }

  /**
   * Extract relationships from YAML frontmatter and sync to graph.
   */
  syncYAMLToGraph(yamlData: Record<string, any>, contactUid: string): GraphSyncOperation[] {
    const operations: GraphSyncOperation[] = [];
    
    try {
      // Get current relationships from graph
      const currentRelationships = this.relationshipGraph.getContactRelationships(contactUid);
      const currentMap = new Map<string, RelationshipEdge>();
      
      currentRelationships.forEach(rel => {
        const key = `${rel.target}-${rel.type}`;
        currentMap.set(key, rel);
      });

      // Parse YAML relationships
      const yamlRelationships = this.extractRelationshipsFromYAML(yamlData);
      const yamlMap = new Map<string, {target: string, type: string, isNameBased: boolean}>();
      
      yamlRelationships.forEach(rel => {
        const key = `${rel.target}-${rel.type}`;
        yamlMap.set(key, rel);
      });

      // Find relationships to add
      for (const [key, yamlRel] of yamlMap) {
        if (!currentMap.has(key)) {
          this.relationshipGraph.addBidirectionalRelationship(
            contactUid, 
            yamlRel.target, 
            yamlRel.type, 
            yamlRel.isNameBased
          );
          operations.push({
            type: 'add',
            sourceUid: contactUid,
            targetIdentifier: yamlRel.target,
            relationshipType: yamlRel.type,
            isNameBased: yamlRel.isNameBased
          });
        }
      }

      // Find relationships to remove
      for (const [key, currentRel] of currentMap) {
        if (!yamlMap.has(key)) {
          this.relationshipGraph.removeBidirectionalRelationship(
            contactUid,
            currentRel.target,
            currentRel.type
          );
          operations.push({
            type: 'remove',
            sourceUid: contactUid,
            targetIdentifier: currentRel.target,
            relationshipType: currentRel.type,
            isNameBased: currentRel.isNameBased
          });
        }
      }

    } catch (error) {
      loggingService.error('Failed to sync YAML to graph:', error);
    }

    return operations;
  }

  /**
   * Generate YAML frontmatter from graph relationships.
   */
  generateYAMLFromGraph(contactUid: string): GraphToYAMLResult {
    const result: GraphToYAMLResult = {
      yamlFields: {},
      operations: []
    };

    try {
      const relationships = this.relationshipGraph.getContactRelationships(contactUid);
      const typeGroups = new Map<string, string[]>();

      // Group relationships by type
      relationships.forEach(rel => {
        const type = rel.type.toLowerCase();
        if (!typeGroups.has(type)) {
          typeGroups.set(type, []);
        }
        
        const value = rel.isNameBased ? `name:${rel.target}` : rel.target;
        typeGroups.get(type)!.push(value);
      });

      // Generate YAML fields with proper indexing
      for (const [type, values] of typeGroups) {
        if (values.length === 0) continue;

        // Remove empty or invalid values
        const validValues = values.filter(value => value && value !== '' && value !== 'name:');
        
        if (validValues.length === 0) continue;

        if (validValues.length === 1) {
          // Single relationship: RELATED[type]
          result.yamlFields[`RELATED[${type}]`] = validValues[0];
        } else {
          // Multiple relationships: RELATED[1:type], RELATED[2:type], etc.
          validValues.forEach((value, index) => {
            result.yamlFields[`RELATED[${index + 1}:${type}]`] = value;
          });
        }
      }

    } catch (error) {
      loggingService.error('Failed to generate YAML from graph:', error);
    }

    return result;
  }

  /**
   * Extract relationships from YAML frontmatter.
   */
  private extractRelationshipsFromYAML(yamlData: Record<string, any>): Array<{target: string, type: string, isNameBased: boolean}> {
    const relationships: Array<{target: string, type: string, isNameBased: boolean}> = [];

    try {
      for (const [key, value] of Object.entries(yamlData)) {
        if (key.startsWith('RELATED') && value && value !== '') {
          const relationshipMatch = key.match(/^RELATED(?:\[(?:\d+:)?([^\]]+)\])?$/);
          if (relationshipMatch) {
            const relationshipType = relationshipMatch[1] || 'related';
            const stringValue = String(value);
            
            const isNameBased = stringValue.startsWith('name:');
            const target = isNameBased ? stringValue.substring(5) : stringValue;
            
            relationships.push({
              target,
              type: relationshipType,
              isNameBased
            });
          }
        }
      }
    } catch (error) {
      loggingService.error('Failed to extract relationships from YAML:', error);
    }

    return relationships;
  }

  /**
   * Extract relationships from markdown content and sync to graph.
   */
  syncMarkdownToGraph(markdownContent: string, contactUid: string): GraphSyncOperation[] {
    const operations: GraphSyncOperation[] = [];

    try {
      // Parse markdown relationships
      const markdownRelationships = this.extractRelationshipsFromMarkdown(markdownContent);
      
      // Get current relationships from graph
      const currentRelationships = this.relationshipGraph.getContactRelationships(contactUid);
      const currentMap = new Map<string, RelationshipEdge>();
      
      currentRelationships.forEach(rel => {
        const key = `${rel.target}-${rel.type}`;
        currentMap.set(key, rel);
      });

      // Build markdown map
      const markdownMap = new Map<string, {target: string, type: string}>();
      markdownRelationships.forEach(rel => {
        const key = `${rel.target}-${rel.type}`;
        markdownMap.set(key, rel);
      });

      // Find relationships to add
      for (const [key, mdRel] of markdownMap) {
        if (!currentMap.has(key)) {
          // Check if target exists in graph or create name-based relationship
          const targetUid = this.relationshipGraph.findContactByName(mdRel.target);
          const isNameBased = !targetUid;
          const targetIdentifier = targetUid || mdRel.target;
          
          this.relationshipGraph.addBidirectionalRelationship(
            contactUid,
            targetIdentifier,
            mdRel.type,
            isNameBased
          );
          
          operations.push({
            type: 'add',
            sourceUid: contactUid,
            targetIdentifier,
            relationshipType: mdRel.type,
            isNameBased
          });
        }
      }

      // Find relationships to remove
      for (const [key, currentRel] of currentMap) {
        if (!markdownMap.has(key)) {
          this.relationshipGraph.removeBidirectionalRelationship(
            contactUid,
            currentRel.target,
            currentRel.type
          );
          
          operations.push({
            type: 'remove',
            sourceUid: contactUid,
            targetIdentifier: currentRel.target,
            relationshipType: currentRel.type,
            isNameBased: currentRel.isNameBased
          });
        }
      }

    } catch (error) {
      loggingService.error('Failed to sync markdown to graph:', error);
    }

    return operations;
  }

  /**
   * Generate markdown content from graph relationships.
   */
  generateMarkdownFromGraph(contactUid: string, headerLevel: string = '##'): GraphToMarkdownResult {
    const result: GraphToMarkdownResult = {
      markdownContent: '',
      relationships: []
    };

    try {
      const relationships = this.relationshipGraph.getContactRelationships(contactUid);
      const contact = this.relationshipGraph.getContact(contactUid);
      
      if (!contact) {
        loggingService.warn(`Contact not found in graph: ${contactUid}`);
        return result;
      }

      result.relationships = relationships;

      if (relationships.length === 0) {
        result.markdownContent = `${headerLevel} Related\n\n`;
        return result;
      }

      const lines: string[] = [`${headerLevel} Related\n`];

      // Sort relationships by type for consistent display
      const sortedRelationships = [...relationships].sort((a, b) => {
        if (a.type !== b.type) {
          return a.type.localeCompare(b.type);
        }
        return a.target.localeCompare(b.target);
      });

      for (const rel of sortedRelationships) {
        const capitalizedType = rel.type.charAt(0).toUpperCase() + rel.type.slice(1);
        
        // Get target name for display
        let targetName = rel.target;
        if (!rel.isNameBased && !rel.target.startsWith('name:')) {
          const targetContact = this.relationshipGraph.getContact(rel.target);
          if (targetContact) {
            targetName = targetContact.name;
          }
        } else if (rel.target.startsWith('name:')) {
          targetName = rel.target.substring(5);
        }

        lines.push(`- ${capitalizedType} [[${targetName}]]`);
      }

      lines.push(''); // Empty line after list
      result.markdownContent = lines.join('\n');

    } catch (error) {
      loggingService.error('Failed to generate markdown from graph:', error);
      result.markdownContent = `${headerLevel} Related\n\n`;
    }

    return result;
  }

  /**
   * Extract relationships from markdown content.
   */
  private extractRelationshipsFromMarkdown(content: string): Array<{target: string, type: string}> {
    const relationships: Array<{target: string, type: string}> = [];

    try {
      // Find the relationships section
      const relatedHeaderRegex = /^(#{1,6})\s+(related)\s*$/gim;
      let match = relatedHeaderRegex.exec(content);
      
      if (!match) return relationships;

      const headerLevel = match[1];
      const sectionStart = match.index + match[0].length;
      
      // Find the end of the section (next header of same or higher level)
      const nextHeaderRegex = new RegExp(`^#{1,${headerLevel.length}}\\s+`, 'gm');
      nextHeaderRegex.lastIndex = sectionStart + 1;
      const nextMatch = nextHeaderRegex.exec(content);
      
      const sectionEnd = nextMatch ? nextMatch.index : content.length;
      const sectionContent = content.substring(sectionStart, sectionEnd);

      // Parse relationship lines
      const relationshipLines = sectionContent.split('\n');
      for (const line of relationshipLines) {
        const trimmedLine = line.trim();
        if (!trimmedLine.startsWith('-')) continue;

        // Parse: - RelationType [[ContactName]]
        const relationshipMatch = trimmedLine.match(/^-\s+(\w+)\s+\[\[([^\]]+)\]\]/);
        if (relationshipMatch) {
          const type = relationshipMatch[1].toLowerCase();
          const target = relationshipMatch[2];

          relationships.push({ target, type });
        }
      }

    } catch (error) {
      loggingService.error('Failed to extract relationships from markdown:', error);
    }

    return relationships;
  }

  /**
   * Replace the relationships section in markdown content.
   */
  replaceRelationshipsInMarkdown(content: string, newRelationshipsMarkdown: string): string {
    try {
      // Find the relationships section
      const relatedHeaderRegex = /^(#{1,6})\s+(related)\s*$/gim;
      let match = relatedHeaderRegex.exec(content);
      
      if (!match) {
        // No existing section, append at the end
        return content.trim() + '\n\n' + newRelationshipsMarkdown;
      }

      const headerLevel = match[1];
      const sectionStart = match.index;
      
      // Find the end of the section (next header of same or higher level)
      const nextHeaderRegex = new RegExp(`^#{1,${headerLevel.length}}\\s+`, 'gm');
      nextHeaderRegex.lastIndex = sectionStart + 1;
      const nextMatch = nextHeaderRegex.exec(content);
      
      const sectionEnd = nextMatch ? nextMatch.index : content.length;
      
      // Replace the section
      const before = content.substring(0, sectionStart);
      const after = content.substring(sectionEnd);
      
      return before + newRelationshipsMarkdown + after;

    } catch (error) {
      loggingService.error('Failed to replace relationships in markdown:', error);
      return content;
    }
  }

  /**
   * Clean and sanitize YAML fields by removing empty values.
   */
  sanitizeYAMLFields(yamlFields: Record<string, string>): Record<string, string> {
    const cleaned: Record<string, string> = {};

    for (const [key, value] of Object.entries(yamlFields)) {
      if (key.startsWith('RELATED') && value && value !== '' && value !== 'name:') {
        cleaned[key] = value;
      }
    }

    return cleaned;
  }

  /**
   * Get relationship graph statistics.
   */
  getGraphStats(): {nodes: number, edges: number, phantomNodes: number} {
    return this.relationshipGraph.getStats();
  }

  /**
   * Validate graph consistency.
   */
  validateGraph(): {isValid: boolean, issues: string[]} {
    return this.relationshipGraph.validateConsistency();
  }
}