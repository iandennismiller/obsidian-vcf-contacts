import {MetadataCache, Notice, TFile} from "obsidian";
import {parseKey} from "./vcardKey";
import {VCardStructuredFields} from "./vcardDefinitions";

function filterNonNull<T>(array: (T | null | undefined)[]): T[] {
	return array.filter((item): item is T => item !== null && item !== undefined);
}

function renderStructuredLines(structuredFields:[string, string][]):string[] {
	const fields =  Object.fromEntries(structuredFields);
	const partialKeys = structuredFields
		.map(([key]) => key.includes('.') ? key.split('.')[0] : null);
	const uniqueKeys = [...new Set(filterNonNull(partialKeys))];

	const structuredLines = uniqueKeys.map((key) => {
		const keyObj = parseKey(key);
		const type = keyObj.type ? `;TYPE=${keyObj.type}` : '';
		switch (keyObj.key) {
			case 'N': {
				return `N${type}:${VCardStructuredFields.N.map(field => fields[key + '.' + field] || "").join(";")}`;
			}
			case 'ADR': {
				return `ADR${type}:${VCardStructuredFields.ADR.map(field => fields[key + '.' + field] || "").join(";")}`;
			}
			default: {
				return '';
			}
		}
	})

	return structuredLines.filter((line) => line !== '');
}

function renderSingleKey([key, value]:[string, string]):string  {
	const keyObj = parseKey(key);
	const type = keyObj.type ? `;TYPE=${keyObj.type}` : '';
	return `${keyObj.key}${type}:${value}`;
}

function generateVCard(metadataCache: MetadataCache, file: TFile): string {
	try {
		const frontMatter = metadataCache.getFileCache(file)?.frontmatter;
		if (!frontMatter) return "";

		const entries = Object.entries(frontMatter) as Array<[string, string]>;

		const singleLineFields: Array<[string, string]> = [];
		const structuredFields: Array<[string, string]> = [];

		entries.forEach(([key, value]) => {
			const keyObj = parseKey(key);

			if (['ADR', 'N'].includes(keyObj.key)) {
				structuredFields.push([key, value]);
			} else if(['VERSION'].includes(keyObj.key) ) {
				// we target always v4 output
				singleLineFields.push(['VERSION', '4.0']);
			} else {
				singleLineFields.push([key, value]);
			}
		});

		const structuredLines = renderStructuredLines(structuredFields);
		const singleLines = singleLineFields.map(renderSingleKey);
		const lines = structuredLines.concat(singleLines);

		return `BEGIN:VCARD\n${lines.join("\n")}\nEND:VCARD`;
	} catch (err) {
		new Notice(`${err.message} in file skipping ${file.basename}`);
		return '';
	}
}

export async function vcardToString(metadataCache: MetadataCache, contactFiles: TFile[]): Promise<string> {
	return contactFiles
		.map(file => generateVCard(metadataCache, file))
		.filter(vcard => vcard !== "") // Remove empty results
		.join("\n");
}
