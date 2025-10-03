import * as React from "react";
import { Contact, ContactNote } from "src/models";
import { VcardManager } from "src/models/vcardManager";
import { VcardFile } from "src/models/vcardFile";
import { getApp } from "src/plugin/context/sharedAppContext";
import { getSettings } from "src/plugin/context/sharedSettingsContext";
import { CuratorProcessor } from "src/models/curatorManager/CuratorProcessor";
import { CuratorQueItem } from "src/models/curatorManager/CuratorQueItem";
import { RunType } from "src/models/curatorManager/RunType";

const renderGroup = (queItems: CuratorQueItem[]): JSX.Element => {
  return (
    <div className="action-card">
      <div className="action-card-content">
        <p><b>{queItems.length} contacts synced to VCF</b></p>
        <p>Contact data has been written back to corresponding VCF files.</p>
      </div>
    </div>
  );
}

const render = (queItem: CuratorQueItem): JSX.Element => {
  return (
    <div className="action-card">
      <div className="action-card-content">
        <p>{queItem.message}</p>
      </div>
    </div>
  );
}

export const VcardSyncPostProcessor: CuratorProcessor = {
  name: "VCard Sync Post Processor",
  runType: RunType.IMPROVEMENT,
  settingPropertyName: "vcardSyncPostProcessor",
  settingDescription: "VCard Write Back: Automatically writes contact data back to VCard files when Obsidian contact has newer revision data. Requires both VCard Folder Watching and VCard Write Back to be enabled.",
  settingDefaultValue: true,

  async process(contact: Contact): Promise<CuratorQueItem | undefined> {
    const settings = getSettings();
    const activeProcessor = settings[`${this.settingPropertyName}`] as boolean;
    const vcardWatchEnabled = settings.vcardWatchEnabled;
    const vcardWriteBackEnabled = settings.vcardWriteBackEnabled;
    
    if (!activeProcessor || !vcardWatchEnabled || !vcardWriteBackEnabled || !contact.data["UID"]) {
      return Promise.resolve(undefined);
    }

    const app = getApp();
    const vcardManager = new VcardManager(settings);
    const contactNote = new ContactNote(app, settings, contact.file);
    
    // Helper function to generate vcard content from a contact file
    const generateVcardFromContact = async (file: any, app: any): Promise<string | null> => {
      try {
        const vcardResult = await VcardFile.fromObsidianFiles([file], app);
        if (vcardResult.errors.length > 0) {
          console.warn(`[VcardSyncPostProcessor] Warnings generating vcard for ${file.basename}:`);
          vcardResult.errors.forEach(error => console.warn(`  ${error.message}`));
        }
        return vcardResult.vcards || null;
      } catch (error: any) {
        console.error(`[VcardSyncPostProcessor] Error generating vcard for ${file.basename}: ${error.message}`);
        return null;
      }
    };
    
    try {
      // Check if VCF folder exists
      const watchFolderExists = await vcardManager.watchFolderExists();
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

      // Check if vcard file exists for this UID
      const existingVcardPath = await vcardManager.findVCardFileByUID(contactUID);
      
      let shouldWriteVcard = false;
      let action = '';
      
      if (!existingVcardPath) {
        // No vcard exists - create it
        shouldWriteVcard = true;
        action = 'created';
        console.debug(`[VcardSyncPostProcessor] No vcard found for UID ${contactUID}, will create new vcard`);
      } else {
        // vcard exists - check REV timestamps
        try {
          const vcardContent = await VCardFileOperations.readVcardFile(existingVcardPath);
          const parsedEntries = await vcardManager.readAndParseVCard(existingVcardPath);
          
          if (parsedEntries && parsedEntries.length > 0) {
            const vcardRecord = parsedEntries.find(([slug, record]: [string, any]) => record.UID === contactUID);
            if (vcardRecord) {
              const [slug, record] = vcardRecord;
              const vcardREV = record.REV;
              
              // Compare REV timestamps
              const shouldUpdate = await contactNote.shouldUpdateFromVcard(record);
              
              // If shouldUpdateFromVcard returns true, it means vcard is newer
              // We want the opposite - to check if contact is newer than vcard
              if (!shouldUpdate || !vcardREV) {
                // Either contact is newer or vcard has no REV
                shouldWriteVcard = true;
                action = 'updated';
                console.debug(
                  `[VcardSyncPostProcessor] Contact REV ${contactREV} is newer than vcard REV ${vcardREV || 'none'}, will update vcard`
                );
              }
            }
          }
        } catch (error: any) {
          console.error(`[VcardSyncPostProcessor] Error reading existing vcard ${existingVcardPath}: ${error.message}`);
          // If we can't read the vcard, assume we should recreate it
          shouldWriteVcard = true;
          action = 'recreated';
        }
      }
      
      if (!shouldWriteVcard) {
        return Promise.resolve(undefined);
      }
      
      // Generate vcard content from contact file
      const vcardContent = await generateVcardFromContact(contact.file, app);
      if (!vcardContent) {
        console.error(`[VcardSyncPostProcessor] Failed to generate vcard content for ${contact.file.name}`);
        return Promise.resolve(undefined);
      }
      
      // Generate filename if needed
      let filename = existingVcardPath ? existingVcardPath.split('/').pop() || `${contactUID}.vcf` : `${contactUID}.vcf`;
      if (!filename.endsWith('.vcf')) {
        filename = `${filename}.vcf`;
      }
      
      // Queue VCard write instead of writing directly
      await vcardManager.queueVcardWrite(contactUID, vcardContent);
      
      console.debug(`[VcardSyncPostProcessor] Successfully queued ${action} VCard for ${contact.file.name} (UID: ${contactUID})`);
      
      return Promise.resolve({
        name: this.name,
        runType: this.runType,
        file: contact.file,
        message: `VCard file ${action} queued for ${contact.file.name}`,
        render,
        renderGroup
      });
      
    } catch (error: any) {
      console.error(`[VcardSyncPostProcessor] Error processing contact ${contact.file.name}: ${error.message}`);
      return Promise.resolve(undefined);
    }
  }
};