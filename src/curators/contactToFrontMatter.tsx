import * as React from "react";
import { Contact, ContactNote } from "src/models";
import { getApp } from "src/plugin/context/sharedAppContext";
import { getSettings } from "src/plugin/context/sharedSettingsContext";
import { CuratorProcessor } from "src/models/curatorManager/CuratorProcessor";
import { CuratorQueItem } from "src/models/curatorManager/CuratorQueItem";
import { RunType } from "src/models/curatorManager/RunType";

const renderGroup = (queItems: CuratorQueItem[]): JSX.Element => {
  return (
    <div className="action-card">
      <div className="action-card-content">
        <p><b>{queItems.length} contacts updated with Contact section sync</b></p>
        <p>Contact information from Contact sections has been synced to frontmatter.</p>
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

export const ContactToFrontMatterProcessor: CuratorProcessor = {
  name: "ContactToFrontMatterProcessor",
  runType: RunType.IMPROVEMENT,
  settingPropertyName: "contactToFrontMatterProcessor",
  settingDescription: "Automatically syncs Contact markdown section to contact frontmatter fields (EMAIL, TEL, ADR, URL)",
  settingDefaultValue: true,

  async process(contact: Contact, calledWithRunType?: RunType): Promise<CuratorQueItem | undefined> {
    console.debug(`[ContactToFrontMatterProcessor] Starting process for contact: ${contact.file.basename}`);
    
    // When called with MANUAL run type, skip settings check (user explicitly invoked)
    const isManualInvocation = calledWithRunType === RunType.MANUAL;
    
    if (!isManualInvocation) {
      const activeProcessor = getSettings()[`${this.settingPropertyName}`] as boolean;
      console.debug(`[ContactToFrontMatterProcessor] Processor enabled: ${activeProcessor}`);
      
      if (!activeProcessor) {
        console.debug(`[ContactToFrontMatterProcessor] Processor disabled, returning early`);
        return Promise.resolve(undefined);
      }
    } else {
      console.debug(`[ContactToFrontMatterProcessor] Manual invocation - bypassing settings check`);
    }

    const settings = getSettings();
    const app = getApp();
    const contactNote = new ContactNote(app, settings, contact.file);
    
    try {
      // Parse Contact section
      const contactFields = await contactNote.parseContactSection();
      
      console.debug(`[ContactToFrontMatterProcessor] Parsed ${contactFields.length} contact fields from Contact section`);
      
      if (contactFields.length === 0) {
        console.debug(`[ContactToFrontMatterProcessor] No contact fields in Contact section, returning early`);
        return Promise.resolve(undefined);
      }
      
      // Validate contact fields
      const warnings = contactNote.validateContactFields(contactFields);
      if (warnings.length > 0) {
        console.warn(`[ContactToFrontMatterProcessor] Validation warnings:`);
        warnings.forEach(w => console.warn(`[ContactToFrontMatterProcessor]   ${w}`));
      }
      
      // Get current frontmatter
      const currentFrontmatter = await contactNote.getFrontmatter() || {};
      
      // Check what needs to be synced
      const updates: Record<string, string> = {};
      let changeCount = 0;
      
      for (const field of contactFields) {
        let frontmatterKey: string;
        
        if (field.component) {
          // Structured field (e.g., ADR[HOME].STREET)
          frontmatterKey = `${field.fieldType}[${field.fieldLabel}].${field.component}`;
        } else {
          // Simple field (e.g., EMAIL[HOME])
          frontmatterKey = `${field.fieldType}[${field.fieldLabel}]`;
        }
        
        // Check if value differs from current frontmatter
        if (currentFrontmatter[frontmatterKey] !== field.value) {
          updates[frontmatterKey] = field.value;
          changeCount++;
          console.debug(`[ContactToFrontMatterProcessor] Will update ${frontmatterKey}: ${field.value}`);
        }
      }
      
      if (changeCount === 0) {
        console.debug(`[ContactToFrontMatterProcessor] No changes needed, Contact section matches frontmatter`);
        return Promise.resolve(undefined);
      }
      
      // Update frontmatter
      console.debug(`[ContactToFrontMatterProcessor] Updating ${changeCount} frontmatter fields`);
      await contactNote.updateMultipleFrontmatterValues(updates, true); // true = update REV
      
      return Promise.resolve({
        name: this.name,
        runType: this.runType,
        file: contact.file,
        message: `Synced ${changeCount} contact field${changeCount > 1 ? 's' : ''} from Contact section to frontmatter in ${contact.file.name}`,
        render,
        renderGroup
      });
      
    } catch (error: any) {
      console.error(`[ContactToFrontMatterProcessor] Error processing contact ${contact.file.name}:`);
      console.error(`[ContactToFrontMatterProcessor] Error message: ${error.message}`);
      console.error(`[ContactToFrontMatterProcessor] Error stack: ${error.stack}`);
      return Promise.resolve(undefined);
    }
  }
};
