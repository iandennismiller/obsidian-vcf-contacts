import { App, TFile } from 'obsidian';
import { loggingService } from '../services/loggingService';

/**
 * Update a value in file's front matter
 */
export async function updateFrontMatterValue(
  file: TFile, 
  key: string, 
  value: string | null, 
  app: App
): Promise<void> {
  const fileCache = app.metadataCache.getFileCache(file);
  if (!fileCache) {
    loggingService.warn(`[FrontMatterUtils] No cache found for file: ${file.path}`);
    return;
  }

  try {
    await app.fileManager.processFrontMatter(file, (frontMatter) => {
      if (value === null) {
        // Remove the key
        delete frontMatter[key];
      } else {
        // Set the value
        frontMatter[key] = value;
      }
    });
    
    loggingService.info(`[FrontMatterUtils] Updated front matter ${key} in ${file.path}`);
  } catch (error) {
    loggingService.error(`[FrontMatterUtils] Failed to update front matter in ${file.path}: ${error}`);
    throw error;
  }
}

/**
 * Update multiple values in file's front matter
 */
export async function updateFrontMatterValues(
  file: TFile, 
  updates: Record<string, string | null>, 
  app: App
): Promise<void> {
  const fileCache = app.metadataCache.getFileCache(file);
  if (!fileCache) {
    loggingService.warn(`[FrontMatterUtils] No cache found for file: ${file.path}`);
    return;
  }

  try {
    await app.fileManager.processFrontMatter(file, (frontMatter) => {
      for (const [key, value] of Object.entries(updates)) {
        if (value === null) {
          delete frontMatter[key];
        } else {
          frontMatter[key] = value;
        }
      }
    });
    
    loggingService.info(`[FrontMatterUtils] Updated ${Object.keys(updates).length} front matter values in ${file.path}`);
  } catch (error) {
    loggingService.error(`[FrontMatterUtils] Failed to update front matter in ${file.path}: ${error}`);
    throw error;
  }
}

/**
 * Generate REV timestamp in ISO format
 */
export function generateRevTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Check if front matter has changed
 */
export function hasFrontMatterChanged(
  current: Record<string, any>, 
  proposed: Record<string, any>
): boolean {
  // Get all keys from both objects
  const allKeys = new Set([...Object.keys(current), ...Object.keys(proposed)]);
  
  for (const key of allKeys) {
    const currentValue = current[key];
    const proposedValue = proposed[key];
    
    if (currentValue !== proposedValue) {
      return true;
    }
  }
  
  return false;
}

/**
 * Remove all RELATED fields from front matter
 */
export async function removeAllRelatedFields(file: TFile, app: App): Promise<void> {
  const fileCache = app.metadataCache.getFileCache(file);
  if (!fileCache?.frontmatter) {
    return;
  }

  const keysToRemove: string[] = [];
  for (const key of Object.keys(fileCache.frontmatter)) {
    if (key.startsWith('RELATED[')) {
      keysToRemove.push(key);
    }
  }

  if (keysToRemove.length === 0) {
    return;
  }

  const updates: Record<string, null> = {};
  for (const key of keysToRemove) {
    updates[key] = null;
  }

  await updateFrontMatterValues(file, updates, app);
  loggingService.info(`[FrontMatterUtils] Removed ${keysToRemove.length} RELATED fields from ${file.path}`);
}