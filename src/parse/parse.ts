import { MetadataCache, TFile } from "obsidian";
import {Contact} from "./contact";

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
