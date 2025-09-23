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

  // Sort RELATED fields by value (the actual reference) for consistent ordering
  relatedEntries.sort((a, b) => {
    // Extract the relationship type from the key for secondary sorting
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
		...sortRelatedItems(groups.other)
	};

	return `---
${stringifyYaml(frontmatter)}---
#### Notes
${myNote}


${hashtags} ${additionalTags}
`;
}
