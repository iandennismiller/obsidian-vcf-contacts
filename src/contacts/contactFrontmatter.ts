import { App, TFile, parseYaml, stringifyYaml } from 'obsidian';

/**
 * Generate a revision timestamp in VCF format
 */
export function generateRevTimestamp(): string {
  return new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/**
 * Update a single frontmatter value, optionally updating REV timestamp
 */
export async function updateFrontMatterValue(
  file: TFile, 
  key: string, 
  value: string, 
  app: App, 
  skipRevUpdate = false
): Promise<void> {
  const content = await app.vault.read(file);
  const match = content.match(/^---\n([\s\S]*?)\n---\n?/);

  let yamlObj: any = {};
  let body = content;

  if (match) {
    yamlObj = parseYaml(match[1]) || {};
    body = content.slice(match[0].length);
  }

  // Check if the value has actually changed
  if (yamlObj[key] === value) {
    return; // No change needed
  }

  // Update the value
  if (value === '') {
    delete yamlObj[key];
  } else {
    yamlObj[key] = value;
  }

  // Update REV timestamp unless we're updating REV itself or skipRevUpdate is true
  if (!skipRevUpdate && key !== 'REV') {
    yamlObj['REV'] = generateRevTimestamp();
  }

  const newFrontMatter = '---\n' + stringifyYaml(yamlObj) + '---\n';
  const newContent = newFrontMatter + body;

  await app.vault.modify(file, newContent);
}

/**
 * Update multiple frontmatter values in a single operation
 */
export async function updateMultipleFrontMatterValues(
  file: TFile, 
  updates: Record<string, string>, 
  app: App, 
  skipRevUpdate = false
): Promise<void> {
  const content = await app.vault.read(file);
  const match = content.match(/^---\n([\s\S]*?)\n---\n?/);

  let yamlObj: any = {};
  let body = content;

  if (match) {
    yamlObj = parseYaml(match[1]) || {};
    body = content.slice(match[0].length);
  }

  // Check if any values have actually changed
  let hasChanges = false;
  for (const [key, value] of Object.entries(updates)) {
    if (yamlObj[key] !== value) {
      hasChanges = true;
      break;
    }
  }

  if (!hasChanges) {
    return; // No changes needed
  }

  // Apply all updates
  for (const [key, value] of Object.entries(updates)) {
    if (value === '') {
      delete yamlObj[key];
    } else {
      yamlObj[key] = value;
    }
  }

  // Update REV timestamp unless skipRevUpdate is true
  if (!skipRevUpdate) {
    yamlObj['REV'] = generateRevTimestamp();
  }

  const newFrontMatter = '---\n' + stringifyYaml(yamlObj) + '---\n';
  const newContent = newFrontMatter + body;

  await app.vault.modify(file, newContent);
}