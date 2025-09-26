import { stringifyYaml } from "obsidian";
import { extractRelationshipType, parseRelatedValue } from "src/util/relatedFieldUtils";
import { parseGender, getGenderedRelationshipTerm, type Gender } from "src/util/genderUtils";

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
  return Object.fromEntries(
    Object.entries(record).sort(([keyA], [keyB]) => {
      const baseKeyA = extractBaseKey(keyA);
      const baseKeyB = extractBaseKey(keyB);
      return priorityKeys.indexOf(baseKeyA) - priorityKeys.indexOf(baseKeyB);
    })
  );
}

function generateRelatedList(record: Record<string, any>, genderLookup?: (contactRef: string) => Gender): string {
  const relatedFields = Object.entries(record).filter(([key]) => 
    extractBaseKey(key) === 'RELATED'
  );
  
  if (relatedFields.length === 0) {
    return '';
  }

  // Parse RELATED fields and generate markdown list
  const relationships: { type: string; contact: string; displayType: string }[] = [];
  
  relatedFields.forEach(([key, value]) => {
    const type = extractRelationshipType(key);
    
    // Extract contact reference from value
    // Handle formats: urn:uuid:..., name:..., uid:...
    let contact = '';
    if (typeof value === 'string') {
      const parsed = parseRelatedValue(value);
      if (parsed) {
        contact = parsed.value;
      } else {
        contact = value;
      }
    }
    
    // Apply gender-aware relationship term if gender lookup is available
    let displayType = type;
    if (genderLookup) {
      try {
        const contactGender = genderLookup(contact);
        displayType = getGenderedRelationshipTerm(type, contactGender);
      } catch {
        // If gender lookup fails, use the original type
        displayType = type;
      }
    }
    
    relationships.push({ type, contact, displayType });
  });

  // Sort relationships for consistent display (by display type, then contact)
  relationships.sort((a, b) => {
    if (a.displayType !== b.displayType) return a.displayType.localeCompare(b.displayType);
    return a.contact.localeCompare(b.contact);
  });

  const listItems = relationships.map(rel => 
    `- ${rel.displayType} [[${rel.contact}]]`
  ).join('\n');

  return `\n## Related\n${listItems}\n`;
}

export function mdRender(record: Record<string, any>, hashtags: string, genderLookup?: (contactRef: string) => Gender): string {
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

  // Generate Related section from RELATED fields with optional gender-aware rendering
  const relatedSection = generateRelatedList(recordWithoutNote, genderLookup);

	return `---
${stringifyYaml(frontmatter)}---
#### Notes
${myNote}
${relatedSection}

${hashtags} ${additionalTags}
`;
}
