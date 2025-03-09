import { MetadataCache, TFile, Vault } from "obsidian";
import {Contact} from "./contact";

export async function parseContactFiles(files: TFile[], metadataCache: MetadataCache) {
  const contactsData: Contact[] = [];
  for (const file of files) {
		const frontmatter = metadataCache.getFileCache(file)?.frontmatter
		if (frontmatter?.['N.GN'] && frontmatter?.['N.FN'] ) {
			contactsData.push({
				file,
				data: frontmatter,
			});
		}
  }
  return contactsData;
}
