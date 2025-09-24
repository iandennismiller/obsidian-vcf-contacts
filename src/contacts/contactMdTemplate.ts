import { stringifyYaml } from "obsidian";

const nameKeys = ["N", "FN"];
const priorityKeys = [
  "EMAIL", "TEL", "BDAY","URL",
  "ORG", "TITLE", "ROLE", "PHOTO"
];
const adrKeys = [
  "ADR"
];

function extractBaseKey(key: string): string {
  if (key.includes("[")) {
    return key.split("[")[0];
  } else if (key.includes(".")) {
    return key.split(".")[0];
  }
  return key;
}

function groupVCardFields(record: Record<string, any>) {
  const groups:{
    name: { [key: string]: any };
    priority: { [key: string]: any };
    address: { [key: string]: any };
    other: { [key: string]: any };
  } = {
    name: {},
    priority: {},
    address: {},
    other: {}
  };

  Object.entries(record).forEach(([key, value]) => {
    const baseKey = extractBaseKey(key);

    if (nameKeys.includes(baseKey)) {
      groups.name[key] = value;
    } else if (priorityKeys.includes(baseKey)) {
      groups.priority[key] = value;
    } else if (adrKeys.includes(baseKey)) {
      groups.address[key] = value;
    } else {
      groups.other[key] = value;
    }
  });

  return groups;
}

function sortNameItems(record: Record<string, any>)  {
  const nameSortOrder = ['N.PREFIX', 'N.GN', 'N.MN', 'N.FN', 'N.SUFFIX', 'FN'];
  return Object.fromEntries(
    Object.entries(record).sort(([keyA], [keyB]) => {
      return nameSortOrder.indexOf(keyA) - nameKeys.indexOf(keyB);
    })
  );
}

function sortedPriorityItems(record: Record<string, any>)  {
  return Object.fromEntries(
    Object.entries(record).sort(([keyA], [keyB]) => {
      const baseKeyA = extractBaseKey(keyA);
      const baseKeyB = extractBaseKey(keyB);
      return priorityKeys.indexOf(baseKeyA) - priorityKeys.indexOf(baseKeyB);
    })
  );
}

/**
 * Consolidated RELATED field sorting and processing
 * This centralizes all relationship sorting logic that was previously scattered
 */
function sortRelatedItems(items: { [key: string]: any }): { [key: string]: any } {
  const relatedEntries: [string, any][] = [];
  const otherEntries: [string, any][] = [];

  // Separate RELATED fields from other fields
  Object.entries(items).forEach(([key, value]) => {
    if (key.startsWith('RELATED')) {
      relatedEntries.push([key, value]);
    } else {
      otherEntries.push([key, value]);
    }
  });

  // Sort RELATED fields by relationship type first, then by value for consistent ordering
  relatedEntries.sort((a, b) => {
    // Extract the relationship type from the key
    const typeA = a[0].match(/RELATED\[(?:\d+:)?([^\]]+)\]/)?.[1] || '';
    const typeB = b[0].match(/RELATED\[(?:\d+:)?([^\]]+)\]/)?.[1] || '';
    
    // First sort by relationship type, then by value
    const typeCompare = typeA.localeCompare(typeB);
    return typeCompare !== 0 ? typeCompare : a[1].toString().localeCompare(b[1].toString());
  });

  // Reconstruct the object with sorted RELATED fields first, then other fields
  const result: { [key: string]: any } = {};
  
  relatedEntries.forEach(([key, value]) => {
    result[key] = value;
  });
  
  otherEntries.forEach(([key, value]) => {
    result[key] = value;
  });

  return result;
}

/**
 * Parse RELATED fields from front matter and convert to relationship data
 * Consolidated from RelationshipSync.parseRelatedFieldsFromFrontMatter
 */
export function parseRelatedFieldsForRendering(frontMatter: Record<string, any>): Array<{
  kind: string;
  contactName: string;
  reference: string;
}> {
  const relationships: Array<{
    kind: string;
    contactName: string;
    reference: string;
  }> = [];
  
  Object.entries(frontMatter).forEach(([key, value]) => {
    if (key.startsWith('RELATED')) {
      // Extract kind from key like "RELATED[friend]" or "RELATED[1:friend]"
      const kindMatch = key.match(/RELATED\[(?:\d+:)?([^\]]+)\]/);
      if (!kindMatch) return;
      
      const kind = kindMatch[1];
      const reference = value as string;
      
      // Parse different reference formats to get contact name
      let contactName = '';
      
      // Parse urn:uuid:UUID format - we can't resolve name from UUID without lookup
      if (reference.match(/^urn:uuid:(.+)$/)) {
        contactName = `[${reference}]`; // Show UUID in brackets if we can't resolve name
      }
      // Parse uid:UID format
      else if (reference.match(/^uid:(.+)$/)) {
        contactName = `[${reference}]`; // Show UID in brackets if we can't resolve name
      }
      // Parse name:Name format
      else if (reference.match(/^name:(.+)$/)) {
        const nameMatch = reference.match(/^name:(.+)$/);
        contactName = nameMatch ? nameMatch[1] : reference;
      }
      else {
        contactName = reference; // Fallback to showing reference as-is
      }
      
      relationships.push({
        kind,
        contactName,
        reference
      });
    }
  });

  // Sort by relationship kind, then by contact name for consistent ordering
  return relationships.sort((a, b) => {
    const kindCompare = a.kind.localeCompare(b.kind);
    return kindCompare !== 0 ? kindCompare : a.contactName.localeCompare(b.contactName);
  });
}

/**
 * Convert relationships data to front matter RELATED fields with proper sorting
 * Consolidated from RelationshipSync.convertRelationshipsToFrontMatter
 */
export function convertRelationshipsToFrontMatter(relationships: Array<{
  relationshipKind: string;
  reference: { uid?: string; name?: string; namespace: string };
}>): Record<string, string> {
  const frontMatterFields: Record<string, string> = {};
  const kindCounts = new Map<string, number>();

  // Sort relationships first to ensure consistent front matter ordering
  const sortedRelationships = relationships.sort((a, b) => {
    const kindCompare = a.relationshipKind.localeCompare(b.relationshipKind);
    if (kindCompare !== 0) return kindCompare;
    
    // Secondary sort by reference value
    const refA = formatRelationshipReference(a.reference);
    const refB = formatRelationshipReference(b.reference);
    return refA.localeCompare(refB);
  });

  sortedRelationships.forEach((relationship) => {
    const kind = relationship.relationshipKind;
    const reference = formatRelationshipReference(relationship.reference);
    
    // Determine the front matter key with proper indexing
    let key: string;
    const existingCount = kindCounts.get(kind) || 0;
    
    if (existingCount === 0) {
      key = `RELATED[${kind}]`;
    } else {
      key = `RELATED[${existingCount}:${kind}]`;
    }
    
    frontMatterFields[key] = reference;
    kindCounts.set(kind, existingCount + 1);
  });

  return frontMatterFields;
}

/**
 * Format relationship reference for front matter
 */
function formatRelationshipReference(reference: { uid?: string; name?: string; namespace: string }): string {
  switch (reference.namespace) {
    case 'urn:uuid':
      return `urn:uuid:${reference.uid}`;
    case 'uid':
      return `uid:${reference.uid}`;
    case 'name':
      return `name:${reference.name}`;
    default:
      throw new Error(`Unknown namespace: ${reference.namespace}`);
  }
}

/**
 * Render the "## Related" section in markdown
 * Consolidated from RelationshipManager.updateRelatedSection  
 */
export function renderRelatedSection(content: string, relationships: Array<{
  kind: string;
  contactName: string;
}> | null = null): string {
  // If no relationships provided, try to parse from existing content's front matter
  if (relationships === null) {
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontMatterMatch) {
      try {
        // This is a simplified parse - in real usage, this would use proper YAML parsing
        const yamlContent = frontMatterMatch[1];
        const parsed: Record<string, any> = {};
        yamlContent.split('\n').forEach(line => {
          const colonIndex = line.indexOf(':');
          if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim();
            const value = line.substring(colonIndex + 1).trim();
            parsed[key] = value;
          }
        });
        
        relationships = parseRelatedFieldsForRendering(parsed);
      } catch (error) {
        relationships = [];
      }
    } else {
      relationships = [];
    }
  }

  if (relationships.length === 0) {
    // Remove existing Related section if no relationships
    const lines = content.split('\n');
    let inRelatedSection = false;
    let relatedStartLine = -1;
    let relatedEndLine = -1;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (/^#{1,6}\s*related\s*$/i.test(line)) {
        inRelatedSection = true;
        relatedStartLine = i;
      } else if (inRelatedSection && /^#{1,6}\s/.test(line)) {
        // Found next heading, end of Related section
        relatedEndLine = i;
        break;
      }
    }
    
    if (relatedStartLine >= 0) {
      // If no end found, Related section goes to end of file
      if (relatedEndLine === -1) {
        relatedEndLine = lines.length;
      }
      
      // Remove the Related section
      lines.splice(relatedStartLine, relatedEndLine - relatedStartLine);
      
      // Clean up extra newlines
      return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    }
    
    return content;
  }

  // Find or create the Related heading
  const relatedRegex = /^(#{1,6})\s*related\s*$/im;
  const match = content.match(relatedRegex);
  
  if (match) {
    // Found existing Related heading - replace the section
    const headingLevel = match[1];
    const headingIndex = content.indexOf(match[0]);
    
    // Find the end of this section (next heading of same or higher level, or end of file)
    const nextHeadingRegex = new RegExp(`^#{1,${headingLevel.length}}\\s+.+$`, 'im');
    const afterHeading = content.slice(headingIndex + match[0].length);
    const nextHeadingMatch = afterHeading.match(nextHeadingRegex);
    
    const sectionEnd = nextHeadingMatch 
      ? headingIndex + match[0].length + afterHeading.indexOf(nextHeadingMatch[0])
      : content.length;
    
    // Build relationship list
    const relationshipList = relationships
      .map(rel => `- ${rel.kind} [[${rel.contactName}]]`)
      .join('\n');
    
    // Replace the section
    const beforeSection = content.slice(0, headingIndex);
    const afterSection = content.slice(sectionEnd);
    const newSection = `## Related\n\n${relationshipList}\n\n`;
    
    return beforeSection + newSection + afterSection;
  } else {
    // No Related heading exists, add one at the end
    const relationshipList = relationships
      .map(rel => `- ${rel.kind} [[${rel.contactName}]]`)
      .join('\n');
    
    return content + `\n## Related\n\n${relationshipList}\n`;
  }
}

export function mdRender(record: Record<string, any>, hashtags: string): string {
	const { NOTE, ...recordWithoutNote } = record;
  const groups = groupVCardFields(recordWithoutNote)
	const myNote = NOTE ? NOTE.replace(/\\n/g, `
`) : '';
	let additionalTags = ''
	if (recordWithoutNote.CATEGORIES) {
		const tempTags= recordWithoutNote.CATEGORIES.split(',')
		additionalTags = `#${tempTags.join(' #')}`
	}

	// Combine all groups into a single object for YAML serialization
	// All RELATED field sorting is now centralized here
	const frontmatter = {
		...sortNameItems(groups.name),
		...sortedPriorityItems(groups.priority),
		...groups.address,
		...sortRelatedItems(groups.other)
	};

	// Base content with properly sorted front matter
	let content = `---
${stringifyYaml(frontmatter)}---
#### Notes
${myNote}


${hashtags} ${additionalTags}
`;

  // Add Related section if there are RELATED fields in the front matter
  const relatedRelationships = parseRelatedFieldsForRendering(frontmatter);
  if (relatedRelationships.length > 0) {
    content = renderRelatedSection(content, relatedRelationships.map(rel => ({
      kind: rel.kind,
      contactName: rel.contactName
    })));
  }

  return content;
}
