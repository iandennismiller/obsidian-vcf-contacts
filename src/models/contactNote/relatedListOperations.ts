/**
 * Handles related list parsing, synchronization, and management
 */

import { TFile, App } from 'obsidian';
import { VaultOperations } from './vaultOperations';
import { FrontmatterOperations } from './frontmatterOperations';
import { GenderOperations } from './genderOperations';
import { RelatedFieldOperations } from './relatedFieldOperations';

export interface ParsedRelationship {
  type: string;
  contactName: string;
  originalType: string;
}

export interface FrontmatterRelationship {
  type: string;
  value: string;
  parsedValue: {
    type: 'uuid' | 'uid' | 'name';
    value: string;
  };
}

export class RelatedListOperations {
  private app: App;
  private file: TFile;
  private vaultOps: VaultOperations;
  private frontmatterOps: FrontmatterOperations;
  private genderOps: GenderOperations;
  private relatedFieldOps: RelatedFieldOperations;

  constructor(
    app: App, 
    file: TFile, 
    vaultOps: VaultOperations, 
    frontmatterOps: FrontmatterOperations, 
    genderOps: GenderOperations,
    relatedFieldOps: RelatedFieldOperations
  ) {
    this.app = app;
    this.file = file;
    this.vaultOps = vaultOps;
    this.frontmatterOps = frontmatterOps;
    this.genderOps = genderOps;
    this.relatedFieldOps = relatedFieldOps;
  }

  /**
   * Parse Related section from markdown content
   */
  async parseRelatedSection(): Promise<ParsedRelationship[]> {
    const content = await this.vaultOps.getContent();
    const relationships: ParsedRelationship[] = [];
    
    const relatedMatch = content.match(/##\s*Related\s*(?:\r?\n)((?:^\s*-\s*.*(?:\r?\n)?)*)/m);
    if (!relatedMatch) {
      return relationships;
    }
    
    const relatedSection = relatedMatch[1];
    const lines = relatedSection.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      const match = line.match(/^\s*-\s*([^\[\]]+)\s*\[\[([^\[\]]+)\]\]/);
      if (match) {
        const type = match[1].trim();
        const contactName = match[2].trim();
        
        if (type.length === 0) {
          continue;
        }
        
        relationships.push({
          type,
          contactName,
          originalType: type
        });
      }
    }
    
    return relationships;
  }

  /**
   * Parse RELATED fields from frontmatter
   */
  async parseFrontmatterRelationships(): Promise<FrontmatterRelationship[]> {
    const frontmatter = await this.frontmatterOps.getFrontmatter();
    const relationships: FrontmatterRelationship[] = [];
    
    if (!frontmatter) return relationships;
    
    for (const [key, value] of Object.entries(frontmatter)) {
      if (key.startsWith('RELATED') && value) {
        const type = this.relatedFieldOps.extractRelationshipType(key);
        const parsedValue = this.relatedFieldOps.parseRelatedValue(value);
        
        if (parsedValue) {
          relationships.push({
            type,
            value,
            parsedValue
          });
        }
      }
    }
    
    return relationships;
  }

  /**
   * Update Related section in markdown content
   */
  async updateRelatedSectionInContent(relationships: { type: string; contactName: string }[]): Promise<void> {
    const content = await this.vaultOps.getContent();
    const relatedMatch = content.match(/^(#{1,6})\s*Related\s*(?:\r?\n)((?:^\s*-\s*.*(?:\r?\n)?)*)/m);
    
    const relatedListItems = relationships.map(rel => 
      `- ${rel.type} [[${rel.contactName}]]`
    );
    
    const relatedSection = relatedListItems.length > 0 
      ? `## Related\n${relatedListItems.join('\n')}\n`
      : `## Related\n\n`;
    
    let newContent: string;
    if (relatedMatch) {
      newContent = content.replace(relatedMatch[0], relatedSection);
    } else {
      const firstSectionMatch = content.match(/^#{1,6}\s+/m);
      if (firstSectionMatch) {
        const insertPos = content.indexOf(firstSectionMatch[0]);
        newContent = content.slice(0, insertPos) + relatedSection + '\n' + content.slice(insertPos);
      } else {
        newContent = content.trimEnd() + '\n\n' + relatedSection;
      }
    }
    
    await this.app.vault.modify(this.file, newContent);
    this.vaultOps.invalidateContentCache();
  }

  areRelationshipTypesEquivalent(type1: string, type2: string): boolean {
    if (type1 === type2) {
      return true;
    }
    
    const genderless1 = this.genderOps.convertToGenderlessType(type1.toLowerCase());
    const genderless2 = this.genderOps.convertToGenderlessType(type2.toLowerCase());
    
    return genderless1 === genderless2;
  }

  generateRelatedKey(
    genderlessType: string, 
    typeIndexes: Record<string, number>, 
    currentFrontmatter: Record<string, any>, 
    frontmatterUpdates: Record<string, string>
  ): string {
    const baseKey = `RELATED[${genderlessType}]`;
    let key = baseKey;
    
    if (currentFrontmatter[baseKey] || frontmatterUpdates[baseKey]) {
      if (!typeIndexes[genderlessType]) {
        typeIndexes[genderlessType] = 1;
      }
      key = `RELATED[${typeIndexes[genderlessType]}:${genderlessType}]`;
      typeIndexes[genderlessType]++;
    }
    
    while (currentFrontmatter[key] || frontmatterUpdates[key]) {
      if (!typeIndexes[genderlessType]) {
        typeIndexes[genderlessType] = 1;
      }
      key = `RELATED[${typeIndexes[genderlessType]}:${genderlessType}]`;
      typeIndexes[genderlessType]++;
    }
    
    return key;
  }
}