/**
 * Central data holder for contact information with optimized data locality.
 * Groups all contact-related data in one place to minimize cache misses.
 */

import { TFile, App, parseYaml } from 'obsidian';
import { Gender } from './types';

/**
 * Centralized contact data storage that keeps related data together
 * for optimal cache locality and performance.
 */
export class ContactData {
  // Core data - kept together for cache locality
  private app: App;
  private file: TFile;
  private _frontmatter: Record<string, any> | null = null;
  private _content: string | null = null;
  private _gender: Gender | null = null;
  private _uid: string | null = null;
  private _displayName: string | null = null;

  // Derived data cache
  private _parsedRelationships: any[] | null = null;
  private _markdownSections: Map<string, string> | null = null;

  constructor(app: App, file: TFile) {
    this.app = app;
    this.file = file;
  }

  // === Core File Access ===

  getFile(): TFile {
    return this.file;
  }

  getApp(): App {
    return this.app;
  }

  // === Content Operations (grouped with content data) ===

  /**
   * Get the file content with caching for data locality
   */
  async getContent(): Promise<string> {
    if (this._content === null) {
      this._content = await this.app.vault.read(this.file);
    }
    return this._content;
  }

  /**
   * Update content and invalidate dependent caches
   */
  async updateContent(newContent: string): Promise<void> {
    await this.app.vault.modify(this.file, newContent);
    this._content = newContent;
    // Invalidate caches that depend on content
    this._frontmatter = null;
    this._parsedRelationships = null;
    this._markdownSections = null;
  }

  // === Frontmatter Operations (grouped with frontmatter data) ===

  /**
   * Get frontmatter with caching, co-located with frontmatter data
   */
  async getFrontmatter(): Promise<Record<string, any> | null> {
    if (this._frontmatter === null) {
      try {
        // Try metadata cache first (most efficient)
        const cache = this.app.metadataCache.getFileCache(this.file);
        if (cache?.frontmatter) {
          this._frontmatter = cache.frontmatter;
          return this._frontmatter;
        }
      } catch (error: any) {
        console.log(`[ContactData] Error accessing metadata cache for ${this.file.path}: ${error.message}`);
      }

      try {
        // Fallback: parse from content
        const content = await this.getContent();
        const match = content.match(/^---\n([\s\S]*?)\n---/);
        if (match) {
          try {
            this._frontmatter = parseYaml(match[1]) || {};
          } catch (error: any) {
            console.log(`[ContactData] Error parsing frontmatter for ${this.file.path}: ${error.message}`);
            this._frontmatter = null; // Return null for malformed YAML
            return null;
          }
        } else {
          this._frontmatter = {};
        }
      } catch (error: any) {
        console.log(`[ContactData] Error reading content for ${this.file.path}: ${error.message}`);
        this._frontmatter = {};
      }
    }
    return this._frontmatter;
  }

  /**
   * Update a single frontmatter value - operation grouped with data
   */
  async updateFrontmatterValue(key: string, value: string, skipRevUpdate = false): Promise<void> {
    const frontmatter = await this.getFrontmatter();
    if (!frontmatter) {
      return;
    }

    // Check if the value has actually changed
    if (frontmatter[key] === value) {
      return; // No change needed
    }

    // Update the value
    if (value === '') {
      delete frontmatter[key];
    } else {
      frontmatter[key] = value;
    }

    // Update REV timestamp unless we're updating REV itself or skipRevUpdate is true
    if (!skipRevUpdate && key !== 'REV') {
      frontmatter['REV'] = this.generateRevTimestamp();
    }

    await this.saveFrontmatter(frontmatter);
  }

  /**
   * Update multiple frontmatter values in one operation
   */
  async updateMultipleFrontmatterValues(updates: Record<string, string>, skipRevUpdate = false): Promise<void> {
    const frontmatter = await this.getFrontmatter();
    if (!frontmatter) {
      return;
    }

    // Check if any values have actually changed
    let hasChanges = false;
    for (const [key, value] of Object.entries(updates)) {
      if (frontmatter[key] !== value) {
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
        delete frontmatter[key];
      } else {
        frontmatter[key] = value;
      }
    }

    // Update REV timestamp unless skipRevUpdate is true
    if (!skipRevUpdate) {
      frontmatter['REV'] = this.generateRevTimestamp();
    }

    await this.saveFrontmatter(frontmatter);
  }

  private async saveFrontmatter(frontmatter: Record<string, any>): Promise<void> {
    const content = await this.getContent();
    const frontmatterYaml = Object.keys(frontmatter)
      .map(key => `${key}: ${frontmatter[key]}`)
      .join('\n');
    
    const hasExistingFrontmatter = content.startsWith('---\n');
    let newContent: string;
    
    if (hasExistingFrontmatter) {
      const endIndex = content.indexOf('---\n', 4);
      if (endIndex !== -1) {
        newContent = `---\n${frontmatterYaml}\n---\n${content.substring(endIndex + 4)}`;
      } else {
        newContent = `---\n${frontmatterYaml}\n---\n${content}`;
      }
    } else {
      newContent = `---\n${frontmatterYaml}\n---\n${content}`;
    }
    
    await this.updateContent(newContent);
    this._frontmatter = frontmatter;
  }

  /**
   * Generate a revision timestamp in VCF format
   */
  generateRevTimestamp(): string {
    return new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  }

  // === Identity Operations (grouped with identity data) ===

  /**
   * Get UID with caching, co-located with UID data
   */
  async getUID(): Promise<string | null> {
    if (this._uid === null) {
      const frontmatter = await this.getFrontmatter();
      this._uid = frontmatter?.UID || null;
    }
    return this._uid;
  }

  /**
   * Get display name with caching
   */
  getDisplayName(): string {
    if (this._displayName === null) {
      this._displayName = this.file.basename;
    }
    return this._displayName;
  }

  // === Gender Operations (grouped with gender data) ===

  /**
   * Get gender with caching, co-located with gender data
   */
  async getGender(): Promise<Gender> {
    if (this._gender === null) {
      const frontmatter = await this.getFrontmatter();
      const genderValue = frontmatter?.GENDER;
      this._gender = genderValue ? this.parseGender(genderValue) : null;
    }
    return this._gender;
  }

  /**
   * Update gender and cache, keeping gender operations together
   */
  async updateGender(gender: Gender): Promise<void> {
    const genderValue = gender ? gender : '';
    await this.updateFrontmatterValue('GENDER', genderValue);
    this._gender = gender;
  }

  /**
   * Parse gender value - grouped with gender data access
   */
  parseGender(value: string): Gender {
    if (!value || value.trim() === '') {
      return null;
    }
    
    const normalized = value.trim().toUpperCase();
    switch (normalized) {
      case 'M':
      case 'MALE':
        return 'M';
      case 'F':
      case 'FEMALE':
        return 'F';
      case 'NB':
      case 'NON-BINARY':
      case 'NONBINARY':
        return 'NB';
      case 'U':
      case 'UNSPECIFIED':
        return 'U';
      default:
        return null;
    }
  }

  // === Cache Management Operations ===

  /**
   * Invalidate all caches when file is modified externally
   */
  invalidateAllCaches(): void {
    this._frontmatter = null;
    this._content = null;
    this._gender = null;
    this._uid = null;
    this._displayName = null;
    this._parsedRelationships = null;
    this._markdownSections = null;
  }

  /**
   * Get cache status for debugging
   */
  getCacheStatus(): { [key: string]: boolean } {
    return {
      frontmatter: this._frontmatter !== null,
      content: this._content !== null,
      gender: this._gender !== null,
      uid: this._uid !== null,
      displayName: this._displayName !== null,
      parsedRelationships: this._parsedRelationships !== null,
      markdownSections: this._markdownSections !== null
    };
  }
}