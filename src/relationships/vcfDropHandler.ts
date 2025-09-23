/**
 * @fileoverview VCF file drop handling functionality
 */

import type { App, TFolder } from 'obsidian';
import { Notice, TFile } from 'obsidian';
import { getApp } from 'src/context/sharedAppContext';
import { loggingService } from 'src/services/loggingService';
import { vcard } from 'src/contacts/vcard';
import { updateFrontMatterValue } from 'src/contacts/contactFrontmatter';

export class VCFDropHandler {
  private app: App;
  private vcfFolderPath: string;

  constructor(vcfFolderPath: string, app?: App) {
    this.app = app || getApp();
    this.vcfFolderPath = vcfFolderPath;
  }

  /**
   * Handle VCF file dropped into the vault
   */
  async handleVCFDrop(file: TFile): Promise<void> {
    if (!file.path.toLowerCase().endsWith('.vcf')) {
      return;
    }

    try {
      loggingService.info(`Processing dropped VCF file: ${file.path}`);

      // Read the VCF content
      const vcfContent = await this.app.vault.read(file);
      
      // Parse the VCF to get contact data
      const parsedContacts = [];
      for await (const [slug, vCardObject] of vcard.parse(vcfContent)) {
        if (slug && vCardObject) {
          parsedContacts.push({ slug, vCardObject });
        }
      }

      if (parsedContacts.length === 0) {
        new Notice('No valid contacts found in VCF file');
        await this.app.vault.delete(file);
        return;
      }

      // Check if VCF folder exists, create if not
      await this.ensureVCFFolder();

      // Process each contact
      let updatedCount = 0;
      let newCount = 0;

      for (const { slug, vCardObject } of parsedContacts) {
        const vcfFileName = `${slug}.vcf`;
        const vcfPath = `${this.vcfFolderPath}/${vcfFileName}`;

        // Check if VCF already exists in the target folder
        const existingVCF = this.app.vault.getAbstractFileByPath(vcfPath);
        
        if (existingVCF && existingVCF instanceof TFile) {
          // Compare and update if different
          const existingContent = await this.app.vault.read(existingVCF);
          if (await this.vcfContentDiffers(existingContent, vCardObject)) {
            await this.updateExistingContact(slug, vCardObject);
            updatedCount++;
          }
        } else {
          // Create new VCF file
          const newVCFContent = await this.generateVCFFromObject(vCardObject);
          await this.app.vault.create(vcfPath, newVCFContent);
          newCount++;
        }
      }

      // Remove the original dropped file
      await this.app.vault.delete(file);

      // Show results
      const message = [];
      if (newCount > 0) {
        message.push(`Added ${newCount} new contact${newCount > 1 ? 's' : ''}`);
      }
      if (updatedCount > 0) {
        message.push(`Updated ${updatedCount} existing contact${updatedCount > 1 ? 's' : ''}`);
      }
      
      if (message.length > 0) {
        new Notice(message.join(', '));
        loggingService.info(`VCF drop processed: ${message.join(', ')}`);
      } else {
        new Notice('No changes needed - all contacts are up to date');
      }

    } catch (error) {
      loggingService.error(`Failed to process dropped VCF file: ${file.path} - ${error}`);
      new Notice(`Failed to process VCF file: ${error.message}`);
    }
  }

  /**
   * Ensure the VCF folder exists
   */
  private async ensureVCFFolder(): Promise<void> {
    const folder = this.app.vault.getAbstractFileByPath(this.vcfFolderPath);
    if (!folder) {
      await this.app.vault.createFolder(this.vcfFolderPath);
      loggingService.info(`Created VCF folder: ${this.vcfFolderPath}`);
    }
  }

  /**
   * Check if VCF content differs from existing
   */
  private async vcfContentDiffers(existingVCF: string, newVCardObject: any): Promise<boolean> {
    try {
      // Parse the existing VCF
      const existingParsed = [];
      for await (const [, vCardObject] of vcard.parse(existingVCF)) {
        if (vCardObject) {
          existingParsed.push(vCardObject);
        }
      }

      if (existingParsed.length === 0) {
        return true; // Existing is invalid, so replace it
      }

      const existing = existingParsed[0];

      // Compare key fields (excluding REV which changes automatically)
      const compareFields = ['FN', 'N.GN', 'N.FN', 'EMAIL', 'TEL', 'UID', 'RELATED', 'GENDER'];
      
      for (const field of compareFields) {
        const existingValue = this.getFieldValue(existing, field);
        const newValue = this.getFieldValue(newVCardObject, field);
        
        if (existingValue !== newValue) {
          return true;
        }
      }

      return false;
    } catch (error) {
      loggingService.error('Error comparing VCF content: ' + error);
      return true; // Assume different if we can't compare
    }
  }

  /**
   * Get field value from vCard object, handling indexed fields
   */
  private getFieldValue(vCardObject: any, fieldPrefix: string): string {
    // Direct match
    if (vCardObject[fieldPrefix]) {
      return vCardObject[fieldPrefix];
    }

    // Look for indexed versions
    const matchingKeys = Object.keys(vCardObject).filter(key => key.startsWith(fieldPrefix));
    if (matchingKeys.length > 0) {
      return matchingKeys.sort().map(key => vCardObject[key]).join(';');
    }

    return '';
  }

  /**
   * Update existing contact with new data
   */
  private async updateExistingContact(slug: string, vCardObject: any): Promise<void> {
    // Find the contact note
    const contactFiles = this.app.vault.getMarkdownFiles();
    const contactFile = contactFiles.find(file => file.basename === slug);

    if (contactFile) {
      // Update the contact note's front matter
      for (const [key, value] of Object.entries(vCardObject)) {
        await updateFrontMatterValue(contactFile, key, value as string, this.app);
      }

      // Update REV timestamp
      await updateFrontMatterValue(contactFile, 'REV', new Date().toISOString(), this.app);
      
      loggingService.info(`Updated contact note: ${slug}`);
    }

    // Update/create the VCF file
    const vcfContent = await this.generateVCFFromObject(vCardObject);
    const vcfPath = `${this.vcfFolderPath}/${slug}.vcf`;
    const existingVCF = this.app.vault.getAbstractFileByPath(vcfPath);
    
    if (existingVCF && existingVCF instanceof TFile) {
      await this.app.vault.modify(existingVCF, vcfContent);
    } else {
      await this.app.vault.create(vcfPath, vcfContent);
    }
  }

  /**
   * Generate VCF content from vCard object
   */
  private async generateVCFFromObject(vCardObject: any): Promise<string> {
    // Create a temporary file to use the existing toString functionality
    const tempFile = {
      basename: vCardObject.FN || 'Contact',
      path: 'temp.md'
    } as TFile;

    // Mock metadataCache for the temp file
    const originalGetFileCache = this.app.metadataCache.getFileCache;
    this.app.metadataCache.getFileCache = (file: TFile) => {
      if (file === tempFile) {
        return {
          frontmatter: vCardObject
        };
      }
      return originalGetFileCache.call(this.app.metadataCache, file);
    };

    try {
      const { vcards } = await vcard.toString([tempFile], this.app);
      return vcards;
    } finally {
      // Restore original method
      this.app.metadataCache.getFileCache = originalGetFileCache;
    }
  }

  /**
   * Update VCF folder path
   */
  updateVCFFolder(newPath: string): void {
    this.vcfFolderPath = newPath;
  }
}