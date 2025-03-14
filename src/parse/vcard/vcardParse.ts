import {VCardForObsidianRecord, VCardStructuredFields} from "./vcardDefinitions";
import { ContactNameModal } from "src/modals/contactNameModal";

function unfoldVCardLines(vCardData: string): string[] {
	const lines = vCardData.split(/\r\n?/g);
	const unfoldedLines: string[] = [];
	let currentLine = "";

	for (const line of lines) {
		if (/^\s/.test(line)) {
			// Continuation of the previous line (line folding)
			currentLine += line.trimStart();
		} else {
			if (currentLine) unfoldedLines.push(currentLine);
			currentLine = line;
		}
	}
	if (currentLine) unfoldedLines.push(currentLine);

	return unfoldedLines;
}

/**
 * Extracts the base key from a vCard field name.
 * - If the key contains `[`, extract everything before it.
 * - Else if the key contains `.`, extract everything before the first dot.
 * - Otherwise, return the key as is.
 * @param key The full vCard field key.
 * @returns The extracted base key.
 */
function extractBaseKey(key: string): string {
	if (key.includes("[")) {
		return key.split("[")[0];
	} else if (key.includes(".")) {
		return key.split(".")[0];
	}
	return key;
}

/**
 * Sorts a vCard object:
 * - Moves priority fields (e.g., `N`, `FN`, `EMAIL`, `TEL`) to the top.
 * - Places `ADR` fields **after** `BDAY`.
 * - Sorts indexed fields (`[1:]`, `[1:TYPE]`) in order.
 * @param vCardObject The parsed vCard object.
 * @returns A sorted vCard object.
 */
function sortVCardObject(vCardObject: VCardForObsidianRecord): VCardForObsidianRecord {
	// Define sorting priority
	const priorityOrder = [
		"N", "FN", "PHOTO",
		"EMAIL", "TEL",
		"BDAY",
		"ADR", "URL",
		"ORG", "TITLE", "ROLE"
	];

	// Separate priority and other fields
	const priorityEntries: VCardForObsidianRecord = {};
	const adrEntries: VCardForObsidianRecord = {};
	const otherEntries: VCardForObsidianRecord = {};

	Object.entries(vCardObject).forEach(([key, value]) => {
		const baseKey = extractBaseKey(key);

		if (priorityOrder.includes(baseKey)) {
			if (baseKey === "ADR") {
				adrEntries[key] = value; // Keep ADR separate to place after BDAY
			} else {
				priorityEntries[key] = value;
			}
		} else {
			otherEntries[key] = value;
		}
	});

	// Sort priority entries based on priority order
	const sortedPriorityEntries = Object.fromEntries(
		Object.entries(priorityEntries).sort(([keyA], [keyB]) => {
			const baseKeyA = extractBaseKey(keyA);
			const baseKeyB = extractBaseKey(keyB);
			return priorityOrder.indexOf(baseKeyA) - priorityOrder.indexOf(baseKeyB);
		})
	);


	// Sort non-priority fields alphabetically while preserving indexes
	const sortedOtherEntries = Object.fromEntries(
		Object.entries(otherEntries).sort(([a], [b]) => a.localeCompare(b))
	);

	return { ...sortedPriorityEntries, ...adrEntries, ...sortedOtherEntries };
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


function parseStructuredField(key: keyof typeof VCardStructuredFields, value: string, typeValues: string): Record<string, string> {
	const components = value.split(";");
	const structure = VCardStructuredFields[key];
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
	if (propKey in VCardStructuredFields) {
		parsedData = parseStructuredField(propKey as keyof typeof VCardStructuredFields, value, typeValues);
	} else if (propKey in ['BDAY', 'ANNIVERSARY']) {
		parsedData[`${propKey}${typeValues}`] = formatVCardDate(value)
	} else {
		parsedData[`${propKey}${typeValues}`] = value;
	}

	return parsedData;
}

function formatVCardDate(input: string): string {
	const trimmed = input.trim();

	// Input from google can be "19990211", insert dashes.
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

export async function createEmptyVcard() {
	const vCardObject: Record<string, any> = {
		"TEL[CELL]": "",
		"TEL[HOME]": "",
		"TEL[WORK]": "",
		"EMAIL[HOME]": "",
		"EMAIL[WORK]": "",
		"BDAY": "19700101",
		"PHOTO": "",
		"ADR[HOME].STREET": "",
		"ADR[HOME].LOCALITY": "",
		"ADR[HOME].POSTAL": "",
		"ADR[HOME].COUNTRY": "",
		"URL[HOME]": "",
		"URL[WORK]": "",
		"CATEGORIES": "",
		"VERSION": "4.0"
	}
	const checkedNameVCardObject = await checkOrAskForName(vCardObject);
	return sortVCardObject(checkedNameVCardObject);
}

export async function parseVcard(vCardData: string) {
	const unfoldedLines = unfoldVCardLines(vCardData);
	const vCardObject: Record<string, any> = {};
	for (const line of unfoldedLines) {
		const parsedLine = parseVCardLine(line);
		const indexedParsedLine = indexIfKeysExist(vCardObject, parsedLine)
		Object.assign(vCardObject, indexedParsedLine);
	}
	const checkedNameVCardObject = await checkOrAskForName(vCardObject);
	return sortVCardObject(checkedNameVCardObject);
}

export async function checkOrAskForName(vCardObject: VCardForObsidianRecord): Promise<VCardForObsidianRecord> {
	return new Promise((resolve) => {
		if (vCardObject['N.GN'] && vCardObject['N.FN']) {
			resolve(vCardObject);
		} else {
			new ContactNameModal(app, vCardObject['FN'], (givenName, familyName) => {
				vCardObject['N.GN'] = givenName;
				vCardObject['N.FN'] = familyName;
				resolve(vCardObject);
			}).open();
		}
	});
}

