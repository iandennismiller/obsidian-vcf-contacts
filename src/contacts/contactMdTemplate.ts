import { stringifyYaml } from "obsidian";

export function mdRender(record: Record<string, any>, hashtags: string): string {
	const { NOTE, ...recordWithoutNote } = record;
	const myNote = NOTE ? NOTE.replace(/\\n/g, `
`) : '';
	let additionalTags = ''
	if (recordWithoutNote.CATEGORIES) {
		const tempTags= recordWithoutNote.CATEGORIES.split(',')
		additionalTags = `#${tempTags.join(' #')}`
	}
	const yamlString = stringifyYaml(recordWithoutNote);

	return `---
${yamlString}
---
#### Notes
${myNote}


${hashtags} ${additionalTags}
`;
}
