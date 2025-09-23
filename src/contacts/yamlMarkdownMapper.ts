/**
 * @fileoverview Dedicated module for bidirectional YAML frontmatter ↔ Markdown mapping.
 * 
 * This module provides reliable, standalone transformation between YAML frontmatter RELATED fields
 * and Markdown relationship lists. It ensures perfect bidirectional mapping without data loss.
 */

import { App, TFile } from 'obsidian';
import { 
  parseRelationshipMarkdown, 
  renderRelationshipMarkdown, 
  formatRelatedField, 
  formatNameBasedRelatedField 
} from './relationships';
import { updateFrontMatterValue } from './contactFrontmatter';

export interface RelationshipData {
  contactName: string;
  relationshipType: string;
  uid?: string;
  isNameBased: boolean;
}

/**
 * Extracts all RELATED fields from frontmatter and converts to relationship data.
 */
export function extractRelationshipsFromYAML(frontmatter: any): RelationshipData[] {
  if (!frontmatter) return [];
  
  const relationships: RelationshipData[] = [];
  
  for (const [key, value] of Object.entries(frontmatter)) {
    if (!key.startsWith('RELATED[') || !value || typeof value !== 'string') {
      continue;
    }
    
    // Extract relationship type from key: RELATED[friend] -> friend
    const typeMatch = key.match(/^RELATED\[([^\]]+)\](?:\[(\d+)\])?$/);
    if (!typeMatch) continue;
    
    const relationshipType = typeMatch[1];
    const value_str = value as string;
    
    if (value_str.startsWith('urn:uuid:')) {
      // UID-based relationship
      const uid = value_str;
      relationships.push({
        contactName: '', // Will be resolved later
        relationshipType,
        uid,
        isNameBased: false
      });
    } else if (value_str.startsWith('name:')) {
      // Name-based relationship
      const contactName = value_str.substring(5); // Remove 'name:' prefix
      relationships.push({
        contactName,
        relationshipType,
        isNameBased: true
      });
    }
  }
  
  return relationships;
}

/**
 * Converts relationship data to YAML frontmatter entries.
 * Only creates entries for relationships with valid values.
 */
export function relationshipsToYAML(relationships: RelationshipData[]): Record<string, string> {
  const yamlData: Record<string, string> = {};
  const typeCounts: Record<string, number> = {};
  
  for (const rel of relationships) {
    // Skip relationships without valid data
    if (!rel.relationshipType || (!rel.contactName && !rel.uid)) {
      continue;
    }
    
    // Generate unique key for this relationship type
    const baseKey = `RELATED[${rel.relationshipType}]`;
    let key = baseKey;
    
    if (typeCounts[rel.relationshipType]) {
      typeCounts[rel.relationshipType]++;
      key = `${baseKey}[${typeCounts[rel.relationshipType]}]`;
    } else {
      typeCounts[rel.relationshipType] = 1;
    }
    
    // Generate value based on relationship type
    let value: string;
    if (rel.isNameBased || !rel.uid) {
      value = formatNameBasedRelatedField(rel.contactName);
    } else {
      value = formatRelatedField(rel.uid);
    }
    
    // Only add non-empty values
    if (value && value !== 'name:' && value !== 'urn:uuid:') {
      yamlData[key] = value;
    }
  }
  
  return yamlData;
}

/**
 * Extracts relationships section from markdown content.
 */
export function extractRelationshipsFromMarkdown(content: string): RelationshipData[] {
  const relatedSectionRegex = /^(#{1,6})\s+[Rr]elated\s*\n([\s\S]*?)(?=\n#{1,6}\s|\n---|$)/m;
  const match = content.match(relatedSectionRegex);
  
  if (!match) return [];
  
  const sectionContent = match[2].trim();
  const lines = sectionContent.split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('-'));
  
  const relationships: RelationshipData[] = [];
  
  for (const line of lines) {
    const parsed = parseRelationshipMarkdown(line);
    if (parsed) {
      relationships.push({
        contactName: parsed.contactName,
        relationshipType: parsed.relationshipType,
        isNameBased: true // Will be upgraded to UID-based if contact exists
      });
    }
  }
  
  return relationships;
}

/**
 * Converts relationship data to markdown format.
 */
export function relationshipsToMarkdown(
  relationships: RelationshipData[], 
  currentContactName: string,
  preserveHeaderLevel: string = '##'
): string {
  if (relationships.length === 0) {
    return `${preserveHeaderLevel} Related\n\n`;
  }
  
  const lines = relationships
    .filter(rel => rel.contactName && rel.relationshipType) // Only include valid relationships
    .map(rel => renderRelationshipMarkdown(rel.contactName, rel.relationshipType, currentContactName));
  
  if (lines.length === 0) {
    return `${preserveHeaderLevel} Related\n\n`;
  }
  
  // Ensure clean formatting: header, blank line, relationships, blank line
  return `${preserveHeaderLevel} Related\n\n${lines.join('\n')}\n\n`;
}

/**
 * Replaces the relationships section in markdown content.
 */
export function replaceRelationshipsInMarkdown(
  content: string, 
  relationships: RelationshipData[], 
  currentContactName: string
): string {
  const relatedSectionRegex = /^(#{1,6})\s+[Rr]elated\s*\n([\s\S]*?)(?=\n#{1,6}\s|\n---|$)/m;
  
  if (relatedSectionRegex.test(content)) {
    // Replace existing section, preserving header level
    return content.replace(relatedSectionRegex, (match, headerLevel) => {
      const newMarkdown = relationshipsToMarkdown(relationships, currentContactName, headerLevel);
      return newMarkdown.trimEnd(); // Remove trailing newline that will be added by the regex boundary
    });
  } else {
    // Add new section at appropriate location
    const newMarkdown = relationshipsToMarkdown(relationships, currentContactName);
    
    // Find insertion point (before Notes section or hashtags, or at end)
    const notesSectionRegex = /^#### Notes\s*\n/m;
    const hashtagMatch = content.match(/\n(#\w+[\s#\w]*)\s*$/);
    
    if (notesSectionRegex.test(content)) {
      return content.replace(notesSectionRegex, `${newMarkdown}\n$&`);
    } else if (hashtagMatch) {
      const hashtagStart = hashtagMatch.index!;
      return content.slice(0, hashtagStart) + '\n\n' + newMarkdown.trimEnd() + content.slice(hashtagStart);
    } else {
      return content + '\n\n' + newMarkdown.trimEnd();
    }
  }
}

/**
 * Removes all RELATED fields from frontmatter.
 */
export async function clearRelatedFieldsFromYAML(file: TFile, app: App): Promise<void> {
  const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
  if (!frontmatter) return;
  
  const relatedKeys = Object.keys(frontmatter).filter(key => key.startsWith('RELATED['));
  
  for (const key of relatedKeys) {
    await updateFrontMatterValue(file, key, '', app);
  }
}

/**
 * Updates frontmatter with relationship data, removing empty fields.
 */
export async function updateYAMLWithRelationships(
  file: TFile, 
  relationships: RelationshipData[], 
  app: App
): Promise<void> {
  // First, clear all existing RELATED fields
  await clearRelatedFieldsFromYAML(file, app);
  
  // Then add new relationships
  const yamlData = relationshipsToYAML(relationships);
  
  for (const [key, value] of Object.entries(yamlData)) {
    if (value && value !== 'name:' && value !== 'urn:uuid:') {
      await updateFrontMatterValue(file, key, value, app);
    }
  }
}

/**
 * Complete bidirectional sync: YAML → Markdown
 */
export async function syncYAMLToMarkdown(
  file: TFile, 
  app: App,
  contactNameResolver: (uid: string) => Promise<string | null>
): Promise<void> {
  const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
  const content = await app.vault.read(file);
  const currentContactName = file.basename;
  
  let relationships = extractRelationshipsFromYAML(frontmatter);
  
  // Resolve contact names for UID-based relationships
  for (const rel of relationships) {
    if (!rel.isNameBased && rel.uid) {
      const contactName = await contactNameResolver(rel.uid);
      if (contactName) {
        rel.contactName = contactName;
      }
    }
  }
  
  const updatedContent = replaceRelationshipsInMarkdown(content, relationships, currentContactName);
  
  if (updatedContent !== content) {
    await app.vault.modify(file, updatedContent);
  }
}

/**
 * Complete bidirectional sync: Markdown → YAML
 */
export async function syncMarkdownToYAML(
  file: TFile, 
  app: App,
  uidResolver: (contactName: string) => Promise<string | null>
): Promise<void> {
  const content = await app.vault.read(file);
  let relationships = extractRelationshipsFromMarkdown(content);
  
  // Try to upgrade name-based relationships to UID-based
  for (const rel of relationships) {
    if (rel.isNameBased && rel.contactName) {
      const uid = await uidResolver(rel.contactName);
      if (uid) {
        rel.uid = uid;
        rel.isNameBased = false;
      }
    }
  }
  
  await updateYAMLWithRelationships(file, relationships, app);
}