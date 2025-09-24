import { stringifyYaml } from "obsidian";

const nameKeys = ["N", "FN"];
const priorityKeys = [
  "EMAIL", "TEL", "BDAY","URL",
  "ORG", "TITLE", "ROLE", "PHOTO", "RELATED", "GENDER"
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
  // First separate RELATED fields for special handling
  const { RELATED, ...otherPriority } = extractRelatedFields(record);
  
  // Sort RELATED fields by value for deterministic order
  const sortedRelated = sortRelatedFields(RELATED);
  
  // Sort other priority items as before
  const otherSorted = Object.entries(otherPriority).sort(([keyA], [keyB]) => {
    const baseKeyA = extractBaseKey(keyA);
    const baseKeyB = extractBaseKey(keyB);
    return priorityKeys.indexOf(baseKeyA) - priorityKeys.indexOf(baseKeyB);
  });

  // Combine sorted RELATED fields with other priority items
  const result: Record<string, any> = {};
  
  // Add sorted RELATED fields first
  Object.entries(sortedRelated).forEach(([key, value]) => {
    result[key] = value;
  });
  
  // Then add other priority items
  otherSorted.forEach(([key, value]) => {
    result[key] = value;
  });

  return result;
}

function extractRelatedFields(record: Record<string, any>): { RELATED: Record<string, any>; [key: string]: any } {
  const related: Record<string, any> = {};
  const other: Record<string, any> = {};
  
  Object.entries(record).forEach(([key, value]) => {
    if (extractBaseKey(key) === 'RELATED') {
      related[key] = value;
    } else {
      other[key] = value;
    }
  });
  
  return { RELATED: related, ...other };
}

function sortRelatedFields(relatedFields: Record<string, any>): Record<string, any> {
  // Sort by the relationship value for deterministic ordering
  const sortedEntries = Object.entries(relatedFields).sort(([, valueA], [, valueB]) => {
    return String(valueA).localeCompare(String(valueB));
  });
  
  return Object.fromEntries(sortedEntries);
}

function generateRelatedList(record: Record<string, any>): string {
  const relatedFields = Object.entries(record).filter(([key]) => 
    extractBaseKey(key) === 'RELATED'
  );
  
  if (relatedFields.length === 0) {
    return '';
  }

  // Parse RELATED fields and generate markdown list
  const relationships: { type: string; contact: string }[] = [];
  
  relatedFields.forEach(([key, value]) => {
    // Extract type from key format: RELATED[type] or RELATED[index:type]
    const typeMatch = key.match(/RELATED(?:\[(?:\d+:)?([^\]]+)\])?/);
    const type = typeMatch ? typeMatch[1] || 'related' : 'related';
    
    // Extract contact reference from value
    // Handle formats: urn:uuid:..., name:..., uid:...
    let contact = '';
    if (typeof value === 'string') {
      if (value.startsWith('urn:uuid:')) {
        contact = value.substring(9); // For now, just use the UUID
      } else if (value.startsWith('name:')) {
        contact = value.substring(5);
      } else if (value.startsWith('uid:')) {
        contact = value.substring(4);
      } else {
        contact = value;
      }
    }
    
    relationships.push({ type, contact });
  });

  // Sort relationships for consistent display
  relationships.sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.contact.localeCompare(b.contact);
  });

  const listItems = relationships.map(rel => 
    `- ${rel.type} [[${rel.contact}]]`
  ).join('\n');

  return `\n## Related\n${listItems}\n`;
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
	const frontmatter = {
		...sortNameItems(groups.name),
		...sortedPriorityItems(groups.priority),
		...groups.address,
		...groups.other
	};

  // Generate Related section from RELATED fields
  const relatedSection = generateRelatedList(recordWithoutNote);

	return `---
${stringifyYaml(frontmatter)}---
#### Notes
${myNote}
${relatedSection}

${hashtags} ${additionalTags}
`;
}
