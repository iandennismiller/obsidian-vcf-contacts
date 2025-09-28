/**
 * Handles all frontmatter-related operations for contacts
 */

import { TFile, App, parseYaml, stringifyYaml } from 'obsidian';
import { ParsedKey } from '../contactNote';

export class FrontmatterOperations {
  private app: App;
  private file: TFile;
  private _frontmatter: Record<string, any> | null = null;

  constructor(app: App, file: TFile) {
    this.app = app;
    this.file = file;
  }

  /**
   * Get the frontmatter, with caching
   */
  async getFrontmatter(): Promise<Record<string, any> | null> {
    if (this._frontmatter === null) {
      // Try metadata cache first (most efficient)
      const cache = this.app.metadataCache.getFileCache(this.file);
      if (cache?.frontmatter) {
        this._frontmatter = cache.frontmatter;
        return this._frontmatter;
      }

      // Fallback: parse from content
      const content = await this.app.vault.read(this.file);
      const match = content.match(/^---\n([\s\S]*?)\n---/);
      if (match) {
        try {
          this._frontmatter = parseYaml(match[1]) || {};
        } catch (error) {
          console.log(`[ContactNote] Error parsing frontmatter for ${this.file.path}: ${error.message}`);
          this._frontmatter = {};
        }
      } else {
        this._frontmatter = {};
      }
    }
    return this._frontmatter;
  }

  /**
   * Invalidate caches when file is modified externally
   */
  invalidateCache(): void {
    this._frontmatter = null;
  }

  /**
   * Update a single frontmatter value
   */
  async updateFrontmatterValue(key: string, value: string): Promise<void> {
    const content = await this.app.vault.read(this.file);
    const match = content.match(/^---\n([\s\S]*?)\n---\n?/);

    let yamlObj: any = {};
    let body = content;

    if (match) {
      yamlObj = parseYaml(match[1]) || {};
      body = content.slice(match[0].length);
    }

    if (value === '') {
      delete yamlObj[key];
    } else {
      yamlObj[key] = value;
    }

    const newFrontMatter = '---\n' + stringifyYaml(yamlObj) + '---\n';
    const newContent = newFrontMatter + body;

    await this.app.vault.modify(this.file, newContent);
    this.invalidateCache(); // Invalidate cache after modification
  }

  /**
   * Update multiple frontmatter values in a single operation
   */
  async updateMultipleFrontmatterValues(updates: Record<string, string>): Promise<void> {
    const content = await this.app.vault.read(this.file);
    const match = content.match(/^---\n([\s\S]*?)\n---\n?/);

    let yamlObj: any = {};
    let body = content;

    if (match) {
      yamlObj = parseYaml(match[1]) || {};
      body = content.slice(match[0].length);
    }

    // Apply all updates
    for (const [key, value] of Object.entries(updates)) {
      if (value === '') {
        delete yamlObj[key];
      } else {
        yamlObj[key] = value;
      }
    }

    const newFrontMatter = '---\n' + stringifyYaml(yamlObj) + '---\n';
    const newContent = newFrontMatter + body;

    await this.app.vault.modify(this.file, newContent);
    this.invalidateCache(); // Invalidate cache after modification
  }

}
  
/**
 * Utility function to parse a vCard property key in the format: key[index:type].subkey
 * This is a static utility function that doesn't require a ContactNote instance
 */
export function parseKey(input: string): ParsedKey {
  const extractSubkey = (input: string): { main: string; subkey?: string } => {
    const dotIndex = input.indexOf('.');
    if (dotIndex === -1) {
      return { main: input, subkey: '' };
    }
    return {
      main: input.substring(0, dotIndex),
      subkey: input.substring(dotIndex + 1)
    };
  };

  const parseBracketContent = (content: string): { index?: string; type?: string } => {
    if (content.includes(':')) {
      const [index, type] = content.split(':');
      return { index, type };
    }
    return { type: content };
  };

  const parseKeyPart = (main: string): { key: string; index?: string; type?: string } => {
    const openBracketIndex = main.indexOf('[');
    if (openBracketIndex === -1) {
      return { key: main };
    }

    const key = main.substring(0, openBracketIndex);
    const closeBracketIndex = main.indexOf(']', openBracketIndex);
    if (closeBracketIndex === -1) {
      throw new Error('Invalid vcard property key encountered please correct.');
    }

    const bracketContent = main.substring(openBracketIndex + 1, closeBracketIndex); 
    const { index, type } = parseBracketContent(bracketContent);

    return { key, index, type };
  };

  const { main, subkey } = extractSubkey(input);
  const { key, index, type } = parseKeyPart(main);
  return { key, index, type, subkey };
}
