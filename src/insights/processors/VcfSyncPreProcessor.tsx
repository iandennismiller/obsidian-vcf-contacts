import * as React from "react";
import { parseYaml } from "obsidian";
import { Contact, ContactNote } from "src/contacts";
import { VCFManager } from "src/contacts/vcfManager";
import { getApp } from "src/context/sharedAppContext";
import { getSettings } from "src/context/sharedSettingsContext";
import { InsightProcessor, InsightQueItem, RunType } from "src/insights/insight.d";
import { loggingService } from "src/services/loggingService";

const renderGroup = (queItems: InsightQueItem[]):JSX.Element => {
  return (
    <div className="action-card">
      <div className="action-card-content">
        <p><b>{queItems.length} contacts synced from VCF</b></p>
        <p>Contact frontmatter has been updated with the latest data from matching VCF files.</p>
      </div>
    </div>
  );
}

const render = (queItem: InsightQueItem):JSX.Element => {
  return (
    <div className="action-card">
      <div className="action-card-content">
        <p>{queItem.message}</p>
      </div>
    </div>
  );
}

export const VcfSyncPreProcessor: InsightProcessor = {
  name: "VcfSyncPreProcessor",
  runType: RunType.IMMEDIATELY,
  settingPropertyName: "vcfSyncPreProcessor",
  settingDescription: "Automatically syncs contact frontmatter with matching VCF files when the VCF has newer revision data",
  settingDefaultValue: true,

  async process(contact:Contact): Promise<InsightQueItem | undefined> {
    const activeProcessor = getSettings()[`${this.settingPropertyName}`] as boolean;
    const vcfWatchEnabled = getSettings().vcfWatchEnabled;
    
    if (!activeProcessor || !vcfWatchEnabled || !contact.data["UID"]) {
      return Promise.resolve(undefined);
    }

    const settings = getSettings();
    const vcfManager = new VCFManager(settings);
    
    try {
      // Check if VCF folder exists
      const watchFolderExists = await vcfManager.watchFolderExists();
      if (!watchFolderExists) {
        return Promise.resolve(undefined);
      }

      // Find VCF file matching this contact's UID
      const vcfFilePath = await vcfManager.findVCFFileByUID(contact.data["UID"]);
      if (!vcfFilePath) {
        return Promise.resolve(undefined);
      }

      // Skip ignored files
      if (vcfManager.shouldIgnoreFile(vcfFilePath)) {
        return Promise.resolve(undefined);
      }

      // Read and parse the VCF file
      const parsedEntries = await vcfManager.readAndParseVCF(vcfFilePath);
      if (!parsedEntries || parsedEntries.length === 0) {
        return Promise.resolve(undefined);
      }

      // Find the matching entry (should be the first one since we found by UID)
      const vcfRecord = parsedEntries.find(([slug, record]) => record.UID === contact.data["UID"]);
      if (!vcfRecord) {
        return Promise.resolve(undefined);
      }

      const [slug, record] = vcfRecord;
      const contactNote = new ContactNote(getApp(), settings, contact.file);
      
      // Check if we should update based on revision timestamps
      const shouldUpdate = await contactNote.shouldUpdateFromVCF(record);
      if (!shouldUpdate) {
        return Promise.resolve(undefined);
      }

      // Use mdRender to process the VCF data into proper frontmatter format
      const renderedMarkdown = contactNote.mdRender(record, '');
      
      // Extract frontmatter from the rendered markdown
      const frontmatterMatch = renderedMarkdown.match(/^---\n([\s\S]*?)\n---/);
      if (!frontmatterMatch) {
        return Promise.resolve(undefined);
      }

      let vcfFrontmatter: Record<string, any>;
      try {
        vcfFrontmatter = parseYaml(frontmatterMatch[1]) || {};
      } catch (error) {
        loggingService.error(`[VcfSyncPreProcessor] Error parsing VCF frontmatter: ${error.message}`);
        return Promise.resolve(undefined);
      }

      // Get current frontmatter to compare
      const currentFrontmatter = await contactNote.getFrontmatter();
      
      // Filter out fields that shouldn't be updated or are already the same
      const filteredUpdates: Record<string, string> = {};
      for (const [key, value] of Object.entries(vcfFrontmatter)) {
        // Skip if value is empty or same as current
        if (value !== undefined && value !== null && value !== '' && 
            currentFrontmatter?.[key] !== value) {
          filteredUpdates[key] = String(value);
        }
      }

      if (Object.keys(filteredUpdates).length > 0) {
        await contactNote.updateMultipleFrontmatterValues(filteredUpdates);
        
        return Promise.resolve({
          name: this.name,
          runType: this.runType,
          file: contact.file,
          message: `Contact ${contact.file.name} has been synced with VCF data!`,
          render,
          renderGroup
        });
      }

      return Promise.resolve(undefined);

    } catch (error) {
      loggingService.error(`[VcfSyncPreProcessor] Error processing contact ${contact.file.name}: ${error.message}`);
      return Promise.resolve(undefined);
    }
  },
};