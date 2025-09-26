import { parseYaml, stringifyYaml, TFile, App } from "obsidian";
import { getApp } from "src/context/sharedAppContext";

export type Contact = {
	data: Record<string, any>;
	file: TFile;
}

/**
 * Generates a REV timestamp in the vCard format (YYYYMMDDTHHMMSSZ)
 * @returns Formatted timestamp string (e.g., "20250923T231928Z")
 */
export function generateRevTimestamp(): string {
  return new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

export async function getFrontmatterFromFiles(files: TFile[]) {
	const { metadataCache } = getApp();
  const contactsData: Contact[] = [];
  for (const file of files) {
		const frontMatter = metadataCache.getFileCache(file)?.frontmatter
		if ((frontMatter?.['N.GN'] && frontMatter?.['N.FN']) || frontMatter?.['FN']) {
			contactsData.push({
				file,
				data: frontMatter,
			});
		}
  }
  return contactsData;
}

export async function updateFrontMatterValue(
  file: TFile, 
  key: string, 
  value: string, 
  app?: App, 
  skipRevUpdate?: boolean
) {
  // Use provided app instance or fall back to shared context
  const appInstance = app || getApp();
	const content = await appInstance.vault.read(file);

	const match = content.match(/^---\n([\s\S]*?)\n---\n?/);

	let yamlObj: any = {};
	let body = content;

	if (match) {
		yamlObj = parseYaml(match[1]) || {};
		body = content.slice(match[0].length);
	}

  // Check if the value actually changed
  const currentValue = yamlObj[key];
  if (currentValue === value) {
    // No change needed
    return;
  }

	yamlObj[key] = value;

  // Update REV field automatically unless we're updating REV itself or explicitly skipping
  if (!skipRevUpdate && key !== 'REV') {
    yamlObj['REV'] = generateRevTimestamp();
  }

	const newFrontMatter = '---\n' + stringifyYaml(yamlObj) + '---\n';
	const newContent = newFrontMatter + body;

	await appInstance.vault.modify(file, newContent);
}

/**
 * Updates multiple frontmatter values at once, with a single REV update
 * @param file - The file to update
 * @param updates - Object with key-value pairs to update
 * @param app - Optional app instance
 * @param skipRevUpdate - Whether to skip REV field update
 */
export async function updateMultipleFrontMatterValues(
  file: TFile, 
  updates: Record<string, string>, 
  app?: App, 
  skipRevUpdate?: boolean
) {
  // Use provided app instance or fall back to shared context
  const appInstance = app || getApp();
	const content = await appInstance.vault.read(file);

	const match = content.match(/^---\n([\s\S]*?)\n---\n?/);

	let yamlObj: any = {};
	let body = content;

	if (match) {
		yamlObj = parseYaml(match[1]) || {};
		body = content.slice(match[0].length);
	}

  // Track if any values actually changed
  let hasChanges = false;

  // Apply all updates and check for changes
  for (const [key, value] of Object.entries(updates)) {
    const currentValue = yamlObj[key];
    if (currentValue !== value) {
      yamlObj[key] = value;
      hasChanges = true;
    }
  }

  // If no changes, don't update the file
  if (!hasChanges) {
    return;
  }

  // Update REV field automatically unless explicitly skipping
  if (!skipRevUpdate && !('REV' in updates)) {
    yamlObj['REV'] = generateRevTimestamp();
  }

	const newFrontMatter = '---\n' + stringifyYaml(yamlObj) + '---\n';
	const newContent = newFrontMatter + body;

	await appInstance.vault.modify(file, newContent);
}
