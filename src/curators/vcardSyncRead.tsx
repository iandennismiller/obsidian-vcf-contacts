import * as React from "react";
import { parseYaml } from "obsidian";
import { Contact, ContactNote } from "src/models";
import { VcardManager } from "src/models/vcardManager";
import { getApp } from "src/context/sharedAppContext";
import { getSettings } from "src/context/sharedSettingsContext";
import { CuratorProcessor } from "src/interfaces/CuratorProcessor.d";
import { CuratorQueItem } from "src/interfaces/CuratorQueItem.d";
import { RunType } from "src/interfaces/RunType";

const renderGroup = (queItems: CuratorQueItem[]):JSX.Element => {
  return (
    <div className="action-card">
      <div className="action-card-content">
        <p><b>{queItems.length} contacts synced from VCF</b></p>
        <p>Contact frontmatter has been updated with the latest data from matching VCF files.</p>
      </div>
    </div>
  );
}

const render = (queItem: CuratorQueItem):JSX.Element => {
  return (
    <div className="action-card">
      <div className="action-card-content">
        <p>{queItem.message}</p>
      </div>
    </div>
  );
}

export const VcardSyncPreProcessor: CuratorProcessor = {
  name: "VCard Sync Pre Processor",
  runType: RunType.IMMEDIATELY,
  settingPropertyName: "vcardSyncPreProcessor",
  settingDescription: "VCard Folder Watcher: Automatically imports/updates contact data from VCard files when they have newer revision data. Requires VCard Folder Watching to be enabled.",
  settingDefaultValue: true,

  async process(contact:Contact): Promise<CuratorQueItem | undefined> {
    const activeProcessor = getSettings()[`${this.settingPropertyName}`] as boolean;
    const vcfWatchEnabled = getSettings().vcfWatchEnabled;
    
    if (!activeProcessor || !vcfWatchEnabled || !contact.data["UID"]) {
      return Promise.resolve(undefined);
    }

    const settings = getSettings();
    const vcardManager = new VcardManager(settings);
    
    try {
      // Check if VCF folder exists
      const watchFolderExists = await vcardManager.watchFolderExists();
      if (!watchFolderExists) {
        return Promise.resolve(undefined);
      }

      // Find VCF file matching this contact's UID
      const vcfFilePath = await vcardManager.findVCFFileByUID(contact.data["UID"]);
      if (!vcfFilePath) {
        return Promise.resolve(undefined);
      }

      // Skip ignored files
      if (vcardManager.shouldIgnoreFile(vcfFilePath)) {
        return Promise.resolve(undefined);
      }

      // Read and parse the VCF file
      const parsedEntries = await vcardManager.readAndParseVCF(vcfFilePath);
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
        console.error(`[VcfSyncPreProcessor] Error parsing VCF frontmatter: ${error.message}`);
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
      console.error(`[VcfSyncPreProcessor] Error processing contact ${contact.file.name}: ${error.message}`);
      return Promise.resolve(undefined);
    }
  },
};