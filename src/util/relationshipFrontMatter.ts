import { TFile, parseYaml, stringifyYaml } from 'obsidian';
import { getApp } from 'src/context/sharedAppContext';
import { parseKey } from 'src/contacts/contactDataKeys';
import { getBaseRelationshipKind } from 'src/util/relationshipKinds';
import { relationshipGraphService } from 'src/services/relationshipGraph';
import { loggingService } from 'src/services/loggingService';

export interface RelationshipFrontMatterEntry {
  kind: string;
  target: string;
  key: string; // The actual frontmatter key like "RELATED[friend]" or "RELATED[1:parent]"
}

/**
 * Parse RELATED entries from contact front matter
 */
export function parseRelatedFromFrontMatter(frontMatter: Record<string, any>): RelationshipFrontMatterEntry[] {
  const relationships: RelationshipFrontMatterEntry[] = [];

  Object.entries(frontMatter).forEach(([key, value]) => {
    if (typeof value === 'string' && key.startsWith('RELATED')) {
      const parsedKey = parseKey(key);
      
      if (parsedKey.key === 'RELATED' && parsedKey.type) {
        // Extract the relationship type and target from the value
        // Format: RELATED;TYPE=friend:urn:uuid:03a0e51f-d1aa-4385-8a53-e29025acd8af
        const colonIndex = value.indexOf(':');
        if (colonIndex > 0) {
          const target = value.substring(colonIndex + 1);
          relationships.push({
            kind: parsedKey.type,
            target,
            key
          });
        }
      }
    }
  });

  return relationships;
}

/**
 * Generate front matter key for a relationship entry
 */
export function generateRelationshipFrontMatterKey(kind: string, existingKeys: string[]): string {
  const baseKey = `RELATED[${kind}]`;
  
  // Check if base key already exists
  if (!existingKeys.includes(baseKey)) {
    return baseKey;
  }

  // Find the next available index
  let index = 1;
  let keyWithIndex = `RELATED[${index}:${kind}]`;
  
  while (existingKeys.includes(keyWithIndex)) {
    index++;
    keyWithIndex = `RELATED[${index}:${kind}]`;
  }
  
  return keyWithIndex;
}

/**
 * Convert relationships to front matter entries
 */
export function relationshipsToFrontMatter(relationships: RelationshipFrontMatterEntry[]): Record<string, string> {
  const frontMatter: Record<string, string> = {};
  const usedKeys: string[] = [];

  // Group relationships by kind and sort targets
  const kindGroups: Record<string, string[]> = {};
  relationships.forEach(rel => {
    const baseKind = getBaseRelationshipKind(rel.kind);
    if (!kindGroups[baseKind]) {
      kindGroups[baseKind] = [];
    }
    kindGroups[baseKind].push(rel.target);
  });

  // Sort targets within each kind group
  Object.keys(kindGroups).forEach(kind => {
    kindGroups[kind].sort();
  });

  // Generate front matter entries
  Object.entries(kindGroups).forEach(([kind, targets]) => {
    targets.forEach(target => {
      const key = generateRelationshipFrontMatterKey(kind, usedKeys);
      usedKeys.push(key);
      frontMatter[key] = `RELATED;TYPE=${kind}:${target}`;
    });
  });

  return frontMatter;
}

/**
 * Update contact's RELATED front matter
 */
export async function updateContactRelatedFrontMatter(
  file: TFile,
  relationships: RelationshipFrontMatterEntry[]
): Promise<void> {
  const app = getApp();
  const content = await app.vault.read(file);

  const match = content.match(/^---\n([\s\S]*?)\n---\n?/);
  let yamlObj: any = {};
  let body = content;

  if (match) {
    yamlObj = parseYaml(match[1]) || {};
    body = content.slice(match[0].length);
  }

  // Remove existing RELATED entries
  Object.keys(yamlObj).forEach(key => {
    if (key.startsWith('RELATED')) {
      delete yamlObj[key];
    }
  });

  // Add new RELATED entries
  const newRelatedEntries = relationshipsToFrontMatter(relationships);
  Object.assign(yamlObj, newRelatedEntries);

  // Update REV field with current timestamp
  yamlObj.REV = new Date().toISOString();

  const newFrontMatter = '---\n' + stringifyYaml(yamlObj) + '---\n';
  const newContent = newFrontMatter + body;

  await app.vault.modify(file, newContent);
  loggingService.info(`Updated RELATED front matter for ${file.name}`);
}

/**
 * Extract contact UID from front matter
 */
export function getContactUidFromFrontMatter(frontMatter: Record<string, any>): string | null {
  return frontMatter?.UID || null;
}

/**
 * Extract contact full name from front matter
 */
export function getContactFullNameFromFrontMatter(frontMatter: Record<string, any>): string {
  return frontMatter?.FN || frontMatter?.['N.FN'] || 'Unknown Contact';
}

/**
 * Extract contact gender from front matter
 */
export function getContactGenderFromFrontMatter(frontMatter: Record<string, any>): string | null {
  return frontMatter?.GENDER || null;
}

/**
 * Load contact into relationship graph from front matter
 */
export function loadContactIntoGraph(file: TFile, frontMatter: Record<string, any>): string {
  const uid = getContactUidFromFrontMatter(frontMatter);
  const fullName = getContactFullNameFromFrontMatter(frontMatter);
  const gender = getContactGenderFromFrontMatter(frontMatter);

  const contactNode = {
    uid,
    fullName,
    file,
    gender
  };

  const contactId = relationshipGraphService.generateContactId(contactNode);
  relationshipGraphService.addContactNode(contactId, contactNode);

  // Load relationships
  const relationships = parseRelatedFromFrontMatter(frontMatter);
  relationships.forEach(rel => {
    const targetRef = relationshipGraphService.parseContactReference(rel.target);
    if (targetRef) {
      const targetId = relationshipGraphService.buildContactIdFromReference(targetRef.namespace, targetRef.value);
      const baseKind = getBaseRelationshipKind(rel.kind);
      relationshipGraphService.addRelationship(contactId, targetId, baseKind);
    }
  });

  return contactId;
}