import { TFile } from 'obsidian';
import { getApp } from 'src/context/sharedAppContext';
import { getBaseRelationshipKind, getGenderedRelationshipKind, inferGenderFromRelationshipKind } from 'src/util/relationshipKinds';
import { RelationshipFrontMatterEntry } from 'src/util/relationshipFrontMatter';
import { relationshipGraphService } from 'src/services/relationshipGraph';
import { loggingService } from 'src/services/loggingService';
import { updateFrontMatterValue } from 'src/contacts/contactFrontmatter';

export interface RelationshipListEntry {
  kind: string;
  targetName: string;
  targetLink: string; // Format: [[First Last]]
}

/**
 * Find the Related heading in content and return its position and level
 */
export function findRelatedHeading(content: string): { 
  found: boolean; 
  start: number; 
  end: number; 
  level: number; 
  hasContent: boolean;
} {
  const lines = content.split('\n');
  let relatedLineIndex = -1;
  let level = 0;

  // Find Related heading (case insensitive)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    
    if (headingMatch) {
      const headingText = headingMatch[2].trim().toLowerCase();
      if (headingText === 'related') {
        relatedLineIndex = i;
        level = headingMatch[1].length;
        break;
      }
    }
  }

  if (relatedLineIndex === -1) {
    return { found: false, start: -1, end: -1, level: 0, hasContent: false };
  }

  // Find the end of the Related section (next heading of same or higher level, or end of file)
  let endLineIndex = lines.length;
  for (let i = relatedLineIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    
    if (headingMatch && headingMatch[1].length <= level) {
      endLineIndex = i;
      break;
    }
  }

  // Check if there's content (non-empty lines) under the heading
  let hasContent = false;
  for (let i = relatedLineIndex + 1; i < endLineIndex; i++) {
    if (lines[i].trim() !== '') {
      hasContent = true;
      break;
    }
  }

  const start = lines.slice(0, relatedLineIndex).join('\n').length + (relatedLineIndex > 0 ? 1 : 0);
  const end = lines.slice(0, endLineIndex).join('\n').length + (endLineIndex > 0 ? 1 : 0);

  return { found: true, start, end, level, hasContent };
}

/**
 * Parse relationship list from markdown content under Related heading
 */
export function parseRelationshipList(content: string): RelationshipListEntry[] {
  const relationships: RelationshipListEntry[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const listMatch = line.match(/^\s*-\s+(.+)$/);
    if (listMatch) {
      const listContent = listMatch[1].trim();
      
      // Parse format: "friend [[First Last]]"
      const relationMatch = listContent.match(/^(\w+)\s+\[\[([^\]]+)\]\]$/);
      if (relationMatch) {
        const kind = relationMatch[1];
        const targetName = relationMatch[2];
        
        relationships.push({
          kind,
          targetName,
          targetLink: `[[${targetName}]]`
        });
      }
    }
  }

  return relationships;
}

/**
 * Convert relationship list entries to front matter entries
 */
export async function relationshipListToFrontMatter(
  relationships: RelationshipListEntry[]
): Promise<RelationshipFrontMatterEntry[]> {
  const app = getApp();
  const frontMatterEntries: RelationshipFrontMatterEntry[] = [];

  for (const rel of relationships) {
    // Find the target contact file
    const targetFile = findContactByName(rel.targetName);
    let targetReference: string;

    if (targetFile) {
      // Get UID from target contact
      const targetFrontMatter = app.metadataCache.getFileCache(targetFile)?.frontmatter;
      const targetUid = targetFrontMatter?.UID;

      if (targetUid && relationshipGraphService.generateContactId({ uid: targetUid, fullName: rel.targetName }).startsWith('urn:uuid:')) {
        targetReference = `urn:uuid:${targetUid}`;
      } else if (targetUid) {
        targetReference = `uid:${targetUid}`;
      } else {
        targetReference = `name:${rel.targetName}`;
      }

      // Infer gender if relationship kind is gendered
      const inferredGender = inferGenderFromRelationshipKind(rel.kind);
      if (inferredGender && targetFrontMatter && !targetFrontMatter.GENDER) {
        // Update target contact's gender if not already set
        try {
          await updateFrontMatterValue(targetFile, 'GENDER', inferredGender);
          loggingService.info(`Inferred and set gender ${inferredGender} for ${rel.targetName} from relationship ${rel.kind}`);
        } catch (error) {
          loggingService.warn(`Could not update gender for ${rel.targetName}: ${error}`);
        }
      }
    } else {
      targetReference = `name:${rel.targetName}`;
    }

    const baseKind = getBaseRelationshipKind(rel.kind);
    frontMatterEntries.push({
      kind: baseKind,
      target: targetReference,
      key: '' // Will be generated when converting to front matter
    });
  }

  return frontMatterEntries;
}

/**
 * Convert front matter entries to relationship list entries
 */
export function frontMatterToRelationshipList(
  relationships: RelationshipFrontMatterEntry[]
): RelationshipListEntry[] {
  const listEntries: RelationshipListEntry[] = [];

  relationships.forEach(rel => {
    const targetRef = relationshipGraphService.parseContactReference(rel.target);
    if (!targetRef) return;

    let targetName: string;
    let targetGender: string | null = null;

    if (targetRef.namespace === 'name') {
      targetName = targetRef.value;
    } else {
      // Try to find the contact and get its name and gender
      const targetNode = relationshipGraphService.getContactNode(rel.target);
      if (targetNode) {
        targetName = targetNode.fullName;
        targetGender = targetNode.gender || null;
      } else {
        // Try to find the contact file by UID to get the proper name
        let targetFile: TFile | null = null;
        
        if (targetRef.namespace === 'urn:uuid' || targetRef.namespace === 'uid') {
          targetFile = findContactByUid(targetRef.value);
        }
        
        if (targetFile) {
          const app = getApp();
          const frontMatter = app.metadataCache.getFileCache(targetFile)?.frontmatter;
          if (frontMatter) {
            targetName = frontMatter.FN || frontMatter['N.FN'] || targetRef.value;
            targetGender = frontMatter.GENDER || null;
          } else {
            targetName = targetRef.value;
          }
        } else {
          // Fallback to value if we can't find the contact
          targetName = targetRef.value;
        }
      }
    }

    // Use gendered relationship kind if target gender is known
    const displayKind = getGenderedRelationshipKind(rel.kind, targetGender || undefined);

    listEntries.push({
      kind: displayKind,
      targetName,
      targetLink: `[[${targetName}]]`
    });
  });

  // Sort by kind, then by target name
  listEntries.sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind.localeCompare(b.kind);
    }
    return a.targetName.localeCompare(b.targetName);
  });

  return listEntries;
}

/**
 * Generate markdown content for relationship list
 */
export function generateRelationshipListMarkdown(relationships: RelationshipListEntry[]): string {
  if (relationships.length === 0) {
    return '';
  }

  const lines = relationships.map(rel => `- ${rel.kind} ${rel.targetLink}`);
  return lines.join('\n') + '\n';
}

/**
 * Update the Related section in a contact note
 */
export async function updateRelatedSection(
  file: TFile,
  relationships: RelationshipListEntry[]
): Promise<void> {
  const app = getApp();
  const content = await app.vault.read(file);
  
  const relatedInfo = findRelatedHeading(content);
  let newContent: string;

  if (relatedInfo.found) {
    // Update existing Related section
    const beforeRelated = content.substring(0, relatedInfo.start);
    const afterRelated = content.substring(relatedInfo.end);
    
    const headingPrefix = '#'.repeat(relatedInfo.level);
    const relationshipMarkdown = generateRelationshipListMarkdown(relationships);
    
    const relatedSection = `${headingPrefix} Related\n${relationshipMarkdown ? '\n' + relationshipMarkdown : ''}`;
    
    newContent = beforeRelated + relatedSection + afterRelated;
  } else {
    // Add new Related section at the end
    const relationshipMarkdown = generateRelationshipListMarkdown(relationships);
    const relatedSection = `\n## Related\n${relationshipMarkdown ? '\n' + relationshipMarkdown : ''}`;
    
    newContent = content + relatedSection;
  }

  await app.vault.modify(file, newContent);
  loggingService.info(`Updated Related section for ${file.name}`);
}

/**
 * Find contact file by name
 */
export function findContactByName(name: string): TFile | null {
  const app = getApp();
  const files = app.vault.getMarkdownFiles();
  
  for (const file of files) {
    const frontMatter = app.metadataCache.getFileCache(file)?.frontmatter;
    if (frontMatter && (frontMatter.FN === name || frontMatter['N.FN'] === name)) {
      return file;
    }
  }
  
  return null;
}

/**
 * Find contact file by UID
 */
export function findContactByUid(uid: string): TFile | null {
  const app = getApp();
  const files = app.vault.getMarkdownFiles();
  
  for (const file of files) {
    const frontMatter = app.metadataCache.getFileCache(file)?.frontmatter;
    if (frontMatter && frontMatter.UID === uid) {
      return file;
    }
  }
  
  return null;
}

/**
 * Clean up Related heading formatting and extra newlines
 */
export function cleanupRelatedHeading(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i];
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    
    if (headingMatch && headingMatch[2].trim().toLowerCase() === 'related') {
      // Fix capitalization
      const level = headingMatch[1];
      result.push(`${level} Related`);
      i++;
      
      // Skip empty lines after heading
      while (i < lines.length && lines[i].trim() === '') {
        i++;
      }
      
      // Add one empty line before content if there is content
      if (i < lines.length && lines[i].trim() !== '') {
        result.push('');
      }
    } else {
      result.push(line);
      i++;
    }
  }
  
  return result.join('\n');
}