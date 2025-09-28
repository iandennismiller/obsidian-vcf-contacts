import * as React from "react";
import { Contact, ContactNote } from "src/contacts";
import { VCFManager } from "src/contacts/vcfManager";
import { VcardFile } from "src/contacts/vcardFile";
import { getApp } from "src/context/sharedAppContext";
import { getSettings } from "src/context/sharedSettingsContext";
import { InsightProcessor, InsightQueItem, RunType } from "src/insights/insight.d";
import { loggingService } from "src/services/loggingService";

const renderGroup = (queItems: InsightQueItem[]): JSX.Element => {
  return (
    <div className="action-card">
      <div className="action-card-content">
        <p><b>{queItems.length} contacts synced to VCF</b></p>
        <p>Contact data has been written back to corresponding VCF files.</p>
      </div>
    </div>
  );
}

const render = (queItem: InsightQueItem): JSX.Element => {
  return (
    <div className="action-card">
      <div className="action-card-content">
        <p>{queItem.message}</p>
      </div>
    </div>
  );
}

export const VcfSyncPostProcessor: InsightProcessor = {
  name: "VCF Sync Post Processor",
  runType: RunType.INPROVEMENT,
  settingPropertyName: "vcfSyncPostProcessor",
  settingDescription: "VCF Write Back: Automatically writes contact data back to VCF files when Obsidian contact has newer revision data. Requires both VCF Folder Watching and VCF Write Back to be enabled.",
  settingDefaultValue: true,

  async process(contact: Contact): Promise<InsightQueItem | undefined> {
    const settings = getSettings();
    const activeProcessor = settings[`${this.settingPropertyName}`] as boolean;
    const vcfWatchEnabled = settings.vcfWatchEnabled;
    const vcfWriteBackEnabled = settings.vcfWriteBackEnabled;
    
    if (!activeProcessor || !vcfWatchEnabled || !vcfWriteBackEnabled || !contact.data["UID"]) {
      return Promise.resolve(undefined);
    }

    const app = getApp();
    const vcfManager = new VCFManager(settings);
    const contactNote = new ContactNote(app, settings, contact.file);
    
    // Helper function to generate VCF content from a contact file
    const generateVCFFromContact = async (file: any, app: any): Promise<string | null> => {
      try {
        const vcfResult = await VcardFile.fromObsidianFiles([file], app);
        if (vcfResult.errors.length > 0) {
          loggingService.warning(`[VcfSyncPostProcessor] Warnings generating VCF for ${file.basename}:`);
          vcfResult.errors.forEach(error => loggingService.warning(`  ${error.message}`));
        }
        return vcfResult.vcards || null;
      } catch (error) {
        loggingService.error(`[VcfSyncPostProcessor] Error generating VCF for ${file.basename}: ${error.message}`);
        return null;
      }
    };
    
    try {
      // Check if VCF folder exists
      const watchFolderExists = await vcfManager.watchFolderExists();
      if (!watchFolderExists) {
        return Promise.resolve(undefined);
      }

      const contactUID = contact.data["UID"];
      const contactFrontmatter = await contactNote.getFrontmatter();
      const contactREV = contactFrontmatter?.REV;
      
      if (!contactREV) {
        // No REV in contact, nothing to sync
        return Promise.resolve(undefined);
      }

      // Check if VCF file exists for this UID
      const existingVCFPath = await vcfManager.findVCFFileByUID(contactUID);
      
      let shouldWriteVCF = false;
      let action = '';
      
      if (!existingVCFPath) {
        // No VCF exists - create it
        shouldWriteVCF = true;
        action = 'created';
        loggingService.info(`[VcfSyncPostProcessor] No VCF found for UID ${contactUID}, will create new VCF`);
      } else {
        // VCF exists - check REV timestamps
        try {
          const vcfContent = await VcardFile.readVCFFile(existingVCFPath);
          const parsedEntries = await vcfManager.readAndParseVCF(existingVCFPath);
          
          if (parsedEntries && parsedEntries.length > 0) {
            const vcfRecord = parsedEntries.find(([slug, record]) => record.UID === contactUID);
            if (vcfRecord) {
              const [slug, record] = vcfRecord;
              const vcfREV = record.REV;
              
              // Compare REV timestamps
              const shouldUpdate = await contactNote.shouldUpdateFromVCF(record);
              
              // If shouldUpdateFromVCF returns true, it means VCF is newer
              // We want the opposite - to check if contact is newer than VCF
              if (!shouldUpdate || !vcfREV) {
                // Either contact is newer or VCF has no REV
                shouldWriteVCF = true;
                action = 'updated';
                loggingService.info(
                  `[VcfSyncPostProcessor] Contact REV ${contactREV} is newer than VCF REV ${vcfREV || 'none'}, will update VCF`
                );
              }
            }
          }
        } catch (error) {
          loggingService.error(`[VcfSyncPostProcessor] Error reading existing VCF ${existingVCFPath}: ${error.message}`);
          // If we can't read the VCF, assume we should recreate it
          shouldWriteVCF = true;
          action = 'recreated';
        }
      }
      
      if (!shouldWriteVCF) {
        return Promise.resolve(undefined);
      }
      
      // Generate VCF content from contact file
      const vcfContent = await generateVCFFromContact(contact.file, app);
      if (!vcfContent) {
        loggingService.error(`[VcfSyncPostProcessor] Failed to generate VCF content for ${contact.file.name}`);
        return Promise.resolve(undefined);
      }
      
      // Generate filename if needed
      let filename = existingVCFPath ? existingVCFPath.split('/').pop() || `${contactUID}.vcf` : `${contactUID}.vcf`;
      if (!filename.endsWith('.vcf')) {
        filename = `${filename}.vcf`;
      }
      
      // Write VCF file
      const writtenPath = await vcfManager.writeVCFFile(filename, vcfContent);
      if (!writtenPath) {
        loggingService.error(`[VcfSyncPostProcessor] Failed to write VCF file for ${contact.file.name}`);
        return Promise.resolve(undefined);
      }
      
      loggingService.info(`[VcfSyncPostProcessor] Successfully ${action} VCF file: ${writtenPath}`);
      
      return Promise.resolve({
        name: this.name,
        runType: this.runType,
        file: contact.file,
        message: `VCF file ${action} for ${contact.file.name}`,
        render,
        renderGroup
      });
      
    } catch (error) {
      loggingService.error(`[VcfSyncPostProcessor] Error processing contact ${contact.file.name}: ${error.message}`);
      return Promise.resolve(undefined);
    }
  }
};