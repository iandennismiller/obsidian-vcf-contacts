import { App, TFile } from 'obsidian';
import { loggingService } from 'src/services/loggingService';

/**
 * Utility class for contact operations
 */
export class ContactUtils {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  /**
   * Get all markdown files that could be contacts
   */
  getAllContactFiles(): TFile[] {
    return this.app.vault.getMarkdownFiles();
  }

  /**
   * Extract UID from a contact file
   */
  extractUIDFromFile(file: TFile): string | null {
    const cache = this.app.metadataCache.getFileCache(file);
    return cache?.frontmatter?.UID || null;
  }

  /**
   * Extract full name from a contact file
   */
  extractFullNameFromFile(file: TFile): string | null {
    const cache = this.app.metadataCache.getFileCache(file);
    const frontmatter = cache?.frontmatter;
    
    if (!frontmatter) return null;

    // Try FN field first
    if (frontmatter.FN) {
      return frontmatter.FN;
    }

    // Try N.GN and N.FN combination
    if (frontmatter['N.GN'] || frontmatter['N.FN']) {
      const given = frontmatter['N.GN'] || '';
      const family = frontmatter['N.FN'] || '';
      return `${given} ${family}`.trim();
    }

    return null;
  }

  /**
   * Extract gender from a contact file
   */
  extractGenderFromFile(file: TFile): 'M' | 'F' | 'NB' | 'U' | '' {
    const cache = this.app.metadataCache.getFileCache(file);
    const gender = cache?.frontmatter?.GENDER;
    
    if (gender && ['M', 'F', 'NB', 'U'].includes(gender)) {
      return gender as 'M' | 'F' | 'NB' | 'U';
    }
    
    return '';
  }

  /**
   * Check if a file is a valid contact (has UID or valid name)
   */
  isValidContact(file: TFile): boolean {
    const uid = this.extractUIDFromFile(file);
    const fullName = this.extractFullNameFromFile(file);
    
    return !!(uid || fullName);
  }

  /**
   * Find contact file by UID
   */
  findContactByUID(uid: string): TFile | null {
    const contactFiles = this.getAllContactFiles();
    
    for (const file of contactFiles) {
      const fileUID = this.extractUIDFromFile(file);
      if (fileUID === uid) {
        return file;
      }
    }

    return null;
  }

  /**
   * Find contact file by name
   */
  findContactByName(name: string): TFile | null {
    const contactFiles = this.getAllContactFiles();
    
    for (const file of contactFiles) {
      const fullName = this.extractFullNameFromFile(file);
      if (fullName === name) {
        return file;
      }
    }

    return null;
  }

  /**
   * Find contact file by UID or name
   */
  findContact(identifier: string): TFile | null {
    // Try UID first
    const byUID = this.findContactByUID(identifier);
    if (byUID) {
      return byUID;
    }

    // Try name
    return this.findContactByName(identifier);
  }

  /**
   * Get contact identifier (UID preferred, fallback to name)
   */
  getContactIdentifier(file: TFile): string | null {
    const uid = this.extractUIDFromFile(file);
    if (uid) {
      return uid;
    }

    return this.extractFullNameFromFile(file);
  }

  /**
   * Create a stub contact file for a name-only reference
   */
  async createStubContact(name: string, contactsFolder: string): Promise<string | null> {
    try {
      // Generate a simple UID
      const uid = `stub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Split name into given and family names
      const nameParts = name.trim().split(/\s+/);
      const givenName = nameParts[0] || '';
      const familyName = nameParts.slice(1).join(' ') || '';

      // Create basic front matter
      const frontMatter = [
        '---',
        `N.GN: ${givenName}`,
        `N.FN: ${familyName}`,
        `FN: ${name}`,
        `UID: ${uid}`,
        `VERSION: "4.0"`,
        '---',
        '',
        '#### Notes',
        '',
        'Auto-created stub contact.',
        '',
        '#Contact'
      ].join('\n');

      // Create file
      const filename = `${name.replace(/[^\w\s-]/g, '').trim()}.md`;
      const filePath = `${contactsFolder}/${filename}`;

      await this.app.vault.create(filePath, frontMatter);
      loggingService.info(`Created stub contact: ${filePath}`);

      return uid;
    } catch (error) {
      loggingService.error(`Failed to create stub contact for ${name}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Get all valid contact identifiers (UID or name pairs)
   */
  getAllContactIdentifiers(): Array<{ uid: string; name: string; file: TFile }> {
    const contactFiles = this.getAllContactFiles();
    const identifiers: Array<{ uid: string; name: string; file: TFile }> = [];

    for (const file of contactFiles) {
      if (this.isValidContact(file)) {
        const uid = this.extractUIDFromFile(file);
        const name = this.extractFullNameFromFile(file);
        
        if (uid || name) {
          identifiers.push({
            uid: uid || name!,
            name: name || uid!,
            file
          });
        }
      }
    }

    return identifiers;
  }
}