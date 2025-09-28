/**
 * Handles all frontmatter-related operations for contacts
 */

import { TFile, App, parseYaml, stringifyYaml } from 'obsidian';

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