import { stringifyYaml } from "obsidian";

const nameKeys = ["N", "FN"];
const priorityKeys = [
  "EMAIL", "TEL", "BDAY","URL",
  "ORG", "TITLE", "ROLE", "PHOTO", "RELATED"
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
      
      // Special handling for RELATED fields - sort by value within each relationship type
      if (baseKeyA === 'RELATED' && baseKeyB === 'RELATED') {
        return record[keyA].localeCompare(record[keyB]);
      }
      
      return priorityKeys.indexOf(baseKeyA) - priorityKeys.indexOf(baseKeyB);
    })
  );
}

function generateRelatedSection(record: Record<string, any>): string {
  // Extract RELATED fields and convert them to markdown list items
  const relatedFields = Object.entries(record)
    .filter(([key]) => key.startsWith('RELATED['))
    .map(([key, value]) => {
      // Parse the key to extract relationship type
      const kindMatch = key.match(/^RELATED\[(?:\d+:)?([^\]]+)\]$/);
      if (!kindMatch) return null;
      
      const kind = kindMatch[1];
      const contactName = parseRelatedValueToName(value);
      
      return contactName ? `- ${kind} [[${contactName}]]` : null;
    })
    .filter(Boolean)
    .sort(); // Sort the list items for consistency

  if (relatedFields.length === 0) {
    // Return empty Related section if no relationships
    return `## Related\n`;
  }

  return `## Related\n${relatedFields.join('\n')}\n`;
}

function parseRelatedValueToName(value: string): string | null {
  // Parse RELATED field value to extract a displayable name
  if (typeof value !== 'string') return null;
  
  if (value.startsWith('name:')) {
    return value.substring(5);
  } else if (value.startsWith('urn:uuid:')) {
    // For now, we'll need to look up the contact by UID
    // This is a placeholder - in practice, we'd need access to the contact registry
    return `[UID: ${value.substring(9).substring(0, 8)}...]`;
  } else if (value.startsWith('uid:')) {
    return `[UID: ${value.substring(4)}]`;
  }
  
  return null;
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

  // Generate the Related section from RELATED fields
  const relatedSection = generateRelatedSection(recordWithoutNote);

	return `---
${stringifyYaml(frontmatter)}---
#### Notes
${myNote}

${relatedSection}
${hashtags} ${additionalTags}
`;
}
