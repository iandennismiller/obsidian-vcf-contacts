import { VCardForObsidianRecord, VCardSupportedKey } from "src/contacts/vcard";
import { ensureHasName } from "src/contacts/vcard/shared/ensureHasName";
import { sortVCardOFields } from "src/contacts/vcard/shared/sortVcardFields";
import { StructuredFields } from "src/contacts/vcard/shared/structuredFields";
import { convertToLatestVCFPhotoFormat } from "src/util/avatarActions";

function unfoldVCardLines(vCardData: string): string[] {
  // Normalize line endings to \n first (handles \r, \r\n)
  const normalized = vCardData.replace(/\r\n?/g, '\n');

  const lines = normalized.split('\n');
  const unfoldedLines: string[] = [];
  let currentLine = "";

  for (const line of lines) {
    if (/^[ \t]/.test(line)) {
      // Line is a continuation (folded)
      currentLine += line.slice(1); // remove the space or tab
    } else {
      if (currentLine) unfoldedLines.push(currentLine);
      currentLine = line;
    }
  }
  if (currentLine) unfoldedLines.push(currentLine);

  return unfoldedLines;
}


/**
 * Ensures unique indexing for duplicate keys by **dynamically placing the index** based on key format.
 * - If the key contains `[TYPE]`, place index **inside the brackets** (`TEL[1:CELL]`).
 * - If the key contains a `.`, place the index **before the dot** (`ADR[1:].STREET`).
 * - Otherwise, append `[index:]` at the end (`EMAIL[1:]`).
 * @param vCardObject The existing parsed vCard object.
 * @param newEntry The new key-value pair to be indexed.
 * @returns An indexed key-value pair.
 */
function indexIfKeysExist(vCardObject: VCardForObsidianRecord, newEntry: VCardForObsidianRecord): VCardForObsidianRecord {
	const indexedEntry: Record<string, any> = {};

	const typeRegex = /\[(.*?)\]/;       // Matches `[TYPE]` in keys
	const dotRegex = /^([^\.]+)\./;      // Matches keys with `.`, extracting the prefix
	const generalKeyRegex = /^(.+)$/;    // Matches any general key

	Object.entries(newEntry).forEach(([key, value]) => {
		let newKey = key;

		if (vCardObject.hasOwnProperty(key)) {
			let index = 1;

			if (typeRegex.test(key)) {
				// If key has `[TYPE]`, insert index inside brackets: TEL[CELL] -> TEL[1:CELL]
				newKey = key.replace(typeRegex, `[${index}:$1]`);
			} else if (dotRegex.test(key)) {
				// If key has `.`, insert index before the dot: ADR.STREET -> ADR[1].STREET
				newKey = key.replace(dotRegex, `$1[${index}:].`);
			} else if (generalKeyRegex.test(key)) {
				// If neither `[TYPE]` nor `.`, append `[index:]` at the end: EMAIL -> EMAIL[1:]
				newKey = `${key}[${index}:]`;
			}


			while (vCardObject.hasOwnProperty(newKey)) {
				index++;

				if (typeRegex.test(key)) {
					newKey = key.replace(typeRegex, `[${index}:$1]`);
				} else if (dotRegex.test(key)) {
					newKey = key.replace(dotRegex, `$1[${index}:].`);
				} else {
					newKey = `${key}[${index}:]`;
				}
			}
		}

		indexedEntry[newKey] = value;
	});

	return indexedEntry;
}


function parseStructuredField(key: keyof typeof StructuredFields, value: string, typeValues: string): Record<string, string> {
	const components = value.split(";");
	const structure = StructuredFields[key];
	const result: Record<string, string> = {};

	components.forEach((comp, index) => {
		if (comp && structure[index]){
			result[`${key}${typeValues}.${structure[index]}`] = comp;
		}
	});

	return result;
}

function parseVCardLine(line: string): VCardForObsidianRecord {
	const [key, ...valueParts] = line.split(":");
	const value = valueParts.join(":").trim();
	const [property, ...paramParts] = key.split(";");

	const params = paramParts.reduce((acc, part) => {
		const [paramKey, paramValue] = part.split("=");
		acc[paramKey.toLowerCase()] = paramValue ? paramValue.split(",") : [];
		return acc;
	}, {} as Record<string, string[]>);

	const propKey: string = property.toUpperCase();

	let parsedData: Record<string, any> = {};

	const typeValues:string = params["type"] ? `[${params["type"].join(",")}]` : "";
	if (key.contains('PHOTO') && key.contains('ENCODING=BASE64')) {
		parsedData['PHOTO'] = convertToLatestVCFPhotoFormat(line);
	} else if (key === 'VERSION') {
		parsedData['VERSION'] = '4.0';
	} else if (propKey in StructuredFields) {
		parsedData = parseStructuredField(propKey as keyof typeof StructuredFields, value, typeValues);
	} else if (propKey in ['BDAY', 'ANNIVERSARY']) {
		parsedData[`${propKey}${typeValues}`] = formatVCardDate(value)
	} else {
    if (propKey in VCardSupportedKey) {
      parsedData[`${propKey}${typeValues}`] = value;
    }
	}

	return parsedData;
}

function formatVCardDate(input: string): string {
	const trimmed = input.trim();

	if (trimmed.length === 8 && !isNaN(Number(trimmed))) {
		const dashed = `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
		const date = new Date(dashed);
		if (!isNaN(date.getTime())) {
			return date.toISOString().substring(0, 10);
		}
	}

	const date = new Date(trimmed);
	if (!isNaN(date.getTime())) {
		return date.toISOString().substring(0, 10);
	}

	return trimmed;
}

export function parseToSingles(vCardsRaw:string): string[] {
	return  vCardsRaw.split(/BEGIN:VCARD\s*[\n\r]+|END:VCARD\s*[\n\r]+/).filter(section => section.trim());
}

export async function parse(vCardData: string): Promise<VCardForObsidianRecord[]> {
  const singles: string[] = parseToSingles(vCardData);

  return await Promise.all(singles.map(async (singleVCard) => {
    const unfoldedLines = unfoldVCardLines(singleVCard);
    const vCardObject: Record<string, any> = {};

    for (const line of unfoldedLines) {
      const parsedLine = parseVCardLine(line);
      if (parsedLine) {
        const indexedParsedLine = indexIfKeysExist(vCardObject, parsedLine)
        Object.assign(vCardObject, indexedParsedLine);
      }
    }
    const checkedNameVCardObject = await ensureHasName(vCardObject);
    return sortVCardOFields(checkedNameVCardObject);
  }));
}



