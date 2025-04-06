import {App, MetadataCache, TFile} from "obsidian";
import * as yaml from 'js-yaml';
import { Contact } from "./contact";

export async function parseContactFiles(files: TFile[], metadataCache: MetadataCache) {
  const contactsData: Contact[] = [];
  for (const file of files) {
		const frontMatter = metadataCache.getFileCache(file)?.frontmatter
		if (frontMatter?.['N.GN'] && frontMatter?.['N.FN'] ) {
			contactsData.push({
				file,
				data: frontMatter,
			});
		}
  }
  return contactsData;
}

export async function updateFrontMatterValue(app: App, file: TFile, key: string, value: string) {

	const content = await app.vault.read(file);

	const match = content.match(/^---\n([\s\S]*?)\n---\n?/);

	let yamlObj: any = {};
	let body = content;

	if (match) {
		yamlObj = yaml.load(match[1]) || {};
		body = content.slice(match[0].length);
	}

	yamlObj[key] = value;

	const newFrontMatter = '---\n' + yaml.dump(yamlObj) + '---\n';
	const newContent = newFrontMatter + body;

	await app.vault.modify(file, newContent);
}
