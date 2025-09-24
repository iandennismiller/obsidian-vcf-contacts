import { App, TFile, Notice } from 'obsidian';
import { loggingService } from '../services/loggingService';
import { vcard } from '../contacts/vcard';
import { RelationshipManager } from '../relationships/relationshipManager';
import { ContactsPluginSettings } from '../settings/settings.d';

/**
 * Handles VCF files dropped into the vault
 */
export class VCFDropHandler {
  private app: App;
  private settings: ContactsPluginSettings;
  private relationshipManager: RelationshipManager;

  constructor(app: App, settings: ContactsPluginSettings, relationshipManager: RelationshipManager) {
    this.app = app;
    this.settings = settings;
    this.relationshipManager = relationshipManager;
    this.setupDropHandler();
  }

  /**
   * Set up event listeners for file creation to detect VCF drops
   */
  private setupDropHandler(): void {
    this.app.vault.on('create', async (file) => {
      if (file instanceof TFile && file.extension === 'vcf') {
        // Debounce to ensure file is fully written
        setTimeout(() => this.handleVCFDrop(file), 500);
      }
    });
  }

  /**
   * Handle a VCF file that was dropped into the vault
   */
  private async handleVCFDrop(file: TFile): Promise<void> {
    try {
      loggingService.info(`VCF file dropped: ${file.path}`);

      if (!this.settings.vcfFolderPath) {
        new Notice('VCF folder not configured. Please set VCF folder path in settings.');
        return;
      }

      // Read the VCF file content
      const vcfContent = await this.app.vault.read(file);
      
      // Check if a file with the same name already exists in the VCF folder
      const vcfFolderPath = this.settings.vcfFolderPath;
      const targetPath = `${vcfFolderPath}/${file.name}`;
      
      let shouldProcess = false;

      if (await this.fileExistsInVCFFolder(targetPath)) {
        // File exists, check if content is different
        const existingContent = await this.readVCFFile(targetPath);
        if (existingContent !== vcfContent) {
          // Content is different, update the existing file
          await this.writeVCFFile(targetPath, vcfContent);
          shouldProcess = true;
          loggingService.info(`Updated existing VCF file: ${targetPath}`);
        } else {
          loggingService.info(`VCF file already exists with identical content: ${targetPath}`);
        }
      } else {
        // File doesn't exist, copy it
        await this.writeVCFFile(targetPath, vcfContent);
        shouldProcess = true;
        loggingService.info(`Copied VCF file to: ${targetPath}`);
      }

      // Remove the dropped file from the vault
      await this.app.vault.delete(file);
      loggingService.info(`Removed dropped VCF file from vault: ${file.path}`);

      if (shouldProcess) {
        // Process the VCF and update relationships
        await this.processVCFAndUpdateRelationships(vcfContent);
      }

      new Notice(`VCF file processed: ${file.name}`);
    } catch (error) {
      loggingService.error(`Error handling VCF drop: ${error.message}`);
      new Notice(`Error processing VCF file: ${error.message}`);
    }
  }

  /**
   * Process VCF content and update contact relationships
   */
  private async processVCFAndUpdateRelationships(vcfContent: string): Promise<void> {
    try {
      // Parse the VCF content
      const contactsGenerator = vcard.parse(vcfContent);
      
      for await (const [slug, vcardRecord] of contactsGenerator) {
        if (!slug || !vcardRecord) continue;

        // Check if this contact has relationships
        const hasRelationships = Object.keys(vcardRecord).some(key => 
          key.startsWith('RELATED')
        );

        if (hasRelationships) {
          loggingService.info(`Processing relationships for contact: ${slug}`);
          
          // The VCFolderWatcher will handle creating/updating the contact
          // Once the contact is processed, the RelationshipManager will be updated
          // via the file modification events
          
          // We could also manually trigger relationship updates here, but
          // it's better to let the normal workflow handle it to avoid race conditions
        }
      }
    } catch (error) {
      loggingService.error(`Error processing VCF relationships: ${error.message}`);
    }
  }

  /**
   * Check if a file exists in the VCF folder
   */
  private async fileExistsInVCFFolder(path: string): Promise<boolean> {
    try {
      if (typeof window !== 'undefined' && window.require) {
        // Node.js environment (desktop)
        const fs = window.require('fs').promises;
        await fs.access(path);
        return true;
      } else {
        // Browser environment - we can't directly check filesystem
        // Return false to always copy, which is safer
        return false;
      }
    } catch {
      return false;
    }
  }

  /**
   * Read VCF file content from filesystem
   */
  private async readVCFFile(path: string): Promise<string> {
    if (typeof window !== 'undefined' && window.require) {
      // Node.js environment (desktop)
      const fs = window.require('fs').promises;
      return await fs.readFile(path, 'utf8');
    } else {
      // Browser environment - can't read external files directly
      throw new Error('Cannot read VCF files in browser environment');
    }
  }

  /**
   * Write VCF file to filesystem
   */
  private async writeVCFFile(path: string, content: string): Promise<void> {
    if (typeof window !== 'undefined' && window.require) {
      // Node.js environment (desktop)
      const fs = window.require('fs').promises;
      const pathModule = window.require('path');
      
      // Ensure directory exists
      await fs.mkdir(pathModule.dirname(path), { recursive: true });
      
      // Write the file
      await fs.writeFile(path, content, 'utf8');
    } else {
      // Browser environment - can't write external files directly
      loggingService.info('VCF file write skipped in browser environment');
    }
  }

  /**
   * Clean up event listeners
   */
  destroy(): void {
    // Event listeners are automatically cleaned up by Obsidian
  }
}