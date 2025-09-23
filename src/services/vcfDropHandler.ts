import { App, TFile, TFolder } from 'obsidian';
import { VCFolderWatcher } from './vcfFolderWatcher';
import { RelationshipManager } from './relationshipManager';
import { loggingService } from './loggingService';

/**
 * Handles VCF files dropped into the Obsidian vault.
 * 
 * According to requirements:
 * - Move dropped VCFs to the VCF folder path immediately
 * - Remove the original VCF from the vault
 * - If VCF already exists, check for field differences and update contact note
 * - Handle relationships in dropped VCF files
 */
export class VCFDropHandler {
  private app: App;
  private vcfWatcher: VCFolderWatcher;
  private relationshipManager: RelationshipManager;

  constructor(app: App, vcfWatcher: VCFolderWatcher, relationshipManager: RelationshipManager) {
    this.app = app;
    this.vcfWatcher = vcfWatcher;
    this.relationshipManager = relationshipManager;
  }

  /**
   * Initialize VCF drop handling by setting up vault event listeners
   */
  initialize(): void {
    // Listen for new files being created in the vault
    this.app.vault.on('create', this.onFileCreated.bind(this));
  }

  /**
   * Handle new file creation - check if it's a VCF file
   */
  private async onFileCreated(file: TFile): Promise<void> {
    // Only handle VCF files
    if (!file.name.toLowerCase().endsWith('.vcf')) {
      return;
    }

    // Skip if file is already in the VCF folder
    const settings = this.vcfWatcher.getSettings();
    if (!settings.vcfWatchFolder || file.path.startsWith(settings.vcfWatchFolder)) {
      return;
    }

    loggingService.info(`VCF file dropped into vault: ${file.path}`);

    try {
      await this.handleDroppedVCF(file);
    } catch (error) {
      loggingService.error(`Error handling dropped VCF file ${file.path}: ${error.message}`);
    }
  }

  /**
   * Process a dropped VCF file
   */
  private async handleDroppedVCF(droppedFile: TFile): Promise<void> {
    const settings = this.vcfWatcher.getSettings();
    
    if (!settings.vcfWatchFolder) {
      loggingService.warning('VCF watch folder not configured, cannot process dropped VCF');
      return;
    }

    // Ensure VCF watch folder exists
    let vcfFolder = this.app.vault.getAbstractFileByPath(settings.vcfWatchFolder);
    if (!vcfFolder) {
      // Create the folder
      await this.app.vault.createFolder(settings.vcfWatchFolder);
      vcfFolder = this.app.vault.getAbstractFileByPath(settings.vcfWatchFolder);
    }

    if (!(vcfFolder instanceof TFolder)) {
      loggingService.error(`VCF watch path exists but is not a folder: ${settings.vcfWatchFolder}`);
      return;
    }

    // Read the dropped VCF content
    const vcfContent = await this.app.vault.read(droppedFile);
    
    // Determine target path in VCF folder
    const targetPath = `${settings.vcfWatchFolder}/${droppedFile.name}`;
    const existingVCF = this.app.vault.getAbstractFileByPath(targetPath);

    if (existingVCF instanceof TFile) {
      // VCF already exists - compare and update if different
      await this.handleExistingVCF(droppedFile, existingVCF, vcfContent);
    } else {
      // New VCF file - move it to VCF folder
      await this.moveVCFToFolder(droppedFile, targetPath, vcfContent);
    }

    // Clean up - remove the original dropped file
    await this.app.vault.delete(droppedFile);
    loggingService.info(`Removed original dropped VCF: ${droppedFile.path}`);
  }

  /**
   * Handle case where VCF already exists in the target folder
   */
  private async handleExistingVCF(droppedFile: TFile, existingVCF: TFile, newContent: string): Promise<void> {
    // Read existing VCF content
    const existingContent = await this.app.vault.read(existingVCF);

    // Compare content (normalize line endings for comparison)
    const normalizedNew = newContent.replace(/\r\n/g, '\n').trim();
    const normalizedExisting = existingContent.replace(/\r\n/g, '\n').trim();

    if (normalizedNew === normalizedExisting) {
      loggingService.info(`Dropped VCF ${droppedFile.name} is identical to existing VCF, no changes needed`);
      return;
    }

    // Content is different - update the existing VCF
    loggingService.info(`Updating existing VCF ${existingVCF.path} with content from dropped file`);
    await this.app.vault.modify(existingVCF, newContent);

    // The VCF folder watcher should pick up this change and update the corresponding contact note
    // This includes relationship updates if the RELATED fields changed
  }

  /**
   * Move VCF to the designated folder
   */
  private async moveVCFToFolder(droppedFile: TFile, targetPath: string, vcfContent: string): Promise<void> {
    // Create the new VCF file in the target folder
    await this.app.vault.create(targetPath, vcfContent);
    loggingService.info(`Moved VCF to: ${targetPath}`);

    // The VCF folder watcher should pick up this new file and create/update the contact note
    // This includes processing any RELATED fields for relationship management
  }

  /**
   * Clean up event listeners
   */
  cleanup(): void {
    this.app.vault.off('create', this.onFileCreated.bind(this));
  }
}