import { App, TFile, Vault, EventRef } from 'obsidian';
import { loggingService } from './loggingService';
import { vcard } from 'src/contacts/vcard';
import { VCardForObsidianRecord } from 'src/contacts/vcard/shared/vcard.d';
import { ContactsPluginSettings } from 'src/settings/settings.d';
import { relationshipGraphService } from './relationshipGraph';
import { parseRelatedFromFrontMatter, loadContactIntoGraph } from 'src/util/relationshipFrontMatter';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * Handles VCF files dropped into the Obsidian vault
 * Processes RELATED fields and moves VCF files to the appropriate folder
 */
export class VCFDropHandler {
  private app: App;
  private settings: ContactsPluginSettings;
  private eventRefs: EventRef[] = [];

  constructor(app: App, settings: ContactsPluginSettings) {
    this.app = app;
    this.settings = settings;
  }

  /**
   * Start listening for VCF file drops
   */
  start(): void {
    this.eventRefs.push(
      this.app.vault.on('create', this.handleFileCreate.bind(this))
    );
    loggingService.info('VCF drop handler started');
  }

  /**
   * Stop listening for events
   */
  stop(): void {
    this.eventRefs.forEach(ref => this.app.vault.offref(ref));
    this.eventRefs = [];
    loggingService.info('VCF drop handler stopped');
  }

  /**
   * Update settings
   */
  updateSettings(settings: ContactsPluginSettings): void {
    this.settings = settings;
  }

  /**
   * Handle file creation - check if it's a VCF file dropped in the vault
   */
  private async handleFileCreate(file: TFile): Promise<void> {
    if (!this.isVCFFile(file)) {
      return;
    }

    try {
      loggingService.info(`VCF file dropped: ${file.path}`);
      await this.processDroppedVCF(file);
    } catch (error) {
      loggingService.error(`Error processing dropped VCF file ${file.path}: ${error}`);
    }
  }

  /**
   * Check if a file is a VCF file
   */
  private isVCFFile(file: TFile): boolean {
    return file.extension.toLowerCase() === 'vcf';
  }

  /**
   * Process a dropped VCF file
   */
  private async processDroppedVCF(file: TFile): Promise<void> {
    // Read VCF content
    const vcfContent = await this.app.vault.read(file);
    
    // Parse VCF data
    const vcardGenerator = vcard.parse(vcfContent);
    const vcardResults = [];
    
    for await (const [slug, vcardData] of vcardGenerator) {
      vcardResults.push({ slug, vcardData });
    }

    if (vcardResults.length === 0) {
      loggingService.warn(`No valid vCard data found in file: ${file.path}`);
      return;
    }

    // Process each vCard in the file
    for (const { slug, vcardData } of vcardResults) {
      // Check if contact already exists
      const existingContact = await this.findExistingContact(vcardData);
      
      if (existingContact) {
        // Update existing contact with new data
        await this.updateExistingContact(existingContact, vcardData);
      } else {
        // Create new contact
        await this.createNewContact(vcardData);
      }

      // Move VCF file to VCF folder (if configured)
      await this.moveVCFToFolder(file, vcardData);
    }

    // Remove the original VCF file from vault
    await this.app.vault.delete(file);
    loggingService.info(`Processed and removed dropped VCF file: ${file.path}`);
  }

  /**
   * Find existing contact by UID or name
   */
  private async findExistingContact(vcardData: VCardForObsidianRecord): Promise<TFile | null> {
    const uid = vcardData.UID;
    const fullName = vcardData.FN || vcardData['N.FN'];

    const contactFiles = this.app.vault.getMarkdownFiles();
    
    for (const file of contactFiles) {
      const frontMatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (frontMatter) {
        // Check by UID first
        if (uid && frontMatter.UID === uid) {
          return file;
        }
        // Check by full name if no UID match
        if (fullName && (frontMatter.FN === fullName || frontMatter['N.FN'] === fullName)) {
          return file;
        }
      }
    }

    return null;
  }

  /**
   * Update existing contact with new VCF data
   */
  private async updateExistingContact(contactFile: TFile, vcardData: VCardForObsidianRecord): Promise<void> {
    const currentFrontMatter = this.app.metadataCache.getFileCache(contactFile)?.frontmatter;
    if (!currentFrontMatter) {
      return;
    }

    let hasChanges = false;
    const updates: Array<{ key: string; value: string }> = [];

    // Compare fields and identify changes
    Object.entries(vcardData).forEach(([key, value]) => {
      if (key !== 'REV' && currentFrontMatter[key] !== value) {
        updates.push({ key, value: value as string });
        hasChanges = true;
      }
    });

    if (hasChanges) {
      // Update front matter fields
      for (const update of updates) {
        await this.updateFrontMatter(contactFile, update.key, update.value);
      }

      // Update REV timestamp
      await this.updateFrontMatter(contactFile, 'REV', new Date().toISOString());

      // Reload contact into relationship graph
      const updatedFrontMatter = this.app.metadataCache.getFileCache(contactFile)?.frontmatter;
      if (updatedFrontMatter) {
        loadContactIntoGraph(contactFile, updatedFrontMatter);
      }

      loggingService.info(`Updated existing contact: ${contactFile.name}`);
    }
  }

  /**
   * Create new contact from VCF data
   */
  private async createNewContact(vcardData: VCardForObsidianRecord): Promise<void> {
    const fullName = vcardData.FN || vcardData['N.FN'] || 'Unknown Contact';
    const fileName = `${fullName}.md`;

    // Ensure REV timestamp is set
    if (!vcardData.REV) {
      vcardData.REV = new Date().toISOString();
    }

    // Create contact file with front matter
    const frontMatterLines = Object.entries(vcardData)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    const content = `---
${frontMatterLines}
---

# ${fullName}

## Related

`;

    const newFile = await this.app.vault.create(fileName, content);
    
    // Load into relationship graph
    loadContactIntoGraph(newFile, vcardData);

    loggingService.info(`Created new contact: ${newFile.name}`);
  }

  /**
   * Move VCF file to configured VCF folder
   */
  private async moveVCFToFolder(file: TFile, vcardData: VCardForObsidianRecord): Promise<void> {
    if (!this.settings.vcfFolder || typeof this.settings.vcfFolder !== 'string') {
      return;
    }

    try {
      const vcfFolderPath = path.resolve(this.settings.vcfFolder);
      const uid = vcardData.UID || this.generateUID();
      const vcfFileName = `${uid}.vcf`;
      const targetPath = path.join(vcfFolderPath, vcfFileName);

      // Read file content
      const content = await this.app.vault.read(file);

      // Ensure VCF folder exists
      await fs.mkdir(vcfFolderPath, { recursive: true });

      // Write to VCF folder
      await fs.writeFile(targetPath, content, 'utf8');

      loggingService.info(`Moved VCF to folder: ${targetPath}`);
    } catch (error) {
      loggingService.error(`Error moving VCF to folder: ${error}`);
    }
  }

  /**
   * Update front matter field
   */
  private async updateFrontMatter(file: TFile, key: string, value: string): Promise<void> {
    const content = await this.app.vault.read(file);
    const frontMatterRegex = /^---\n([\s\S]*?)\n---/;
    const match = content.match(frontMatterRegex);

    if (match) {
      const frontMatterContent = match[1];
      const lines = frontMatterContent.split('\n');
      
      // Find and update existing line or add new line
      let found = false;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith(`${key}:`)) {
          lines[i] = `${key}: ${value}`;
          found = true;
          break;
        }
      }

      if (!found) {
        lines.push(`${key}: ${value}`);
      }

      const newFrontMatter = `---\n${lines.join('\n')}\n---`;
      const newContent = content.replace(frontMatterRegex, newFrontMatter);
      
      await this.app.vault.modify(file, newContent);
    }
  }

  /**
   * Generate a simple UID
   */
  private generateUID(): string {
    return Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
  }
}