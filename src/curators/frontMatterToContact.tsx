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
        <p><b>{queItems.length} contacts updated with Contact section generation</b></p>
        <p>Contact sections have been generated from frontmatter contact fields.</p>
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

export const FrontMatterToContactProcessor: CuratorProcessor = {
  name: "FrontMatterToContactProcessor",
  runType: RunType.IMPROVEMENT,
  settingPropertyName: "frontMatterToContactProcessor",
  settingDescription: "Automatically generates/updates Contact markdown section from frontmatter fields (EMAIL, TEL, ADR, URL)",
  settingDefaultValue: true,

  async process(contact: Contact, calledWithRunType?: RunType): Promise<CuratorQueItem | undefined> {
    console.debug(`[FrontMatterToContactProcessor] Starting process for contact: ${contact.file.basename}`);
    
    // When called with MANUAL run type, skip settings check (user explicitly invoked)
    const isManualInvocation = calledWithRunType === RunType.MANUAL;
    
    if (!isManualInvocation) {
      const activeProcessor = getSettings()[`${this.settingPropertyName}`] as boolean;
      console.debug(`[FrontMatterToContactProcessor] Processor enabled: ${activeProcessor}`);
      
      if (!activeProcessor) {
        console.debug(`[FrontMatterToContactProcessor] Processor disabled, returning early`);
        return Promise.resolve(undefined);
      }
    } else {
      console.debug(`[FrontMatterToContactProcessor] Manual invocation - bypassing settings check`);
    }

    const settings = getSettings();
    const app = getApp();
    const contactNote = new ContactNote(app, settings, contact.file);
    
    try {
      // Get frontmatter
      const frontmatter = await contactNote.getFrontmatter();
      if (!frontmatter) {
        console.debug(`[FrontMatterToContactProcessor] No frontmatter found, returning early`);
        return Promise.resolve(undefined);
      }
      
      // Check if there are any contact fields in frontmatter
      const hasContactFields = Object.keys(frontmatter).some(key => 
        /^(EMAIL|TEL|ADR|URL)\[/.test(key)
      );
      
      if (!hasContactFields) {
        console.debug(`[FrontMatterToContactProcessor] No contact fields in frontmatter, returning early`);
        return Promise.resolve(undefined);
      }
      
      // Generate Contact section from frontmatter
      const generatedContactSection = await contactNote.generateContactSection();
      
      if (!generatedContactSection) {
        console.debug(`[FrontMatterToContactProcessor] No Contact section generated, returning early`);
        return Promise.resolve(undefined);
      }
      
      console.debug(`[FrontMatterToContactProcessor] Generated Contact section (${generatedContactSection.length} chars)`);
      
      // Get current content to check if Contact section exists
      const content = await contactNote.getContent();
      const hasExistingContactSection = /\n#{2,}\s*contact\s*\n/i.test(content);
      
      // Parse existing Contact section to compare
      const existingFields = await contactNote.parseContactSection();
      const existingFieldCount = existingFields.length;
      
      // Count fields in generated section (approximate)
      const generatedFieldCount = Object.keys(frontmatter).filter(key => 
        /^(EMAIL|TEL|ADR|URL)\[/.test(key)
      ).length;
      
      // If existing Contact section has same or more fields, don't overwrite
      if (hasExistingContactSection && existingFieldCount >= generatedFieldCount) {
        console.debug(`[FrontMatterToContactProcessor] Existing Contact section is complete (${existingFieldCount} fields), no update needed`);
        return Promise.resolve(undefined);
      }
      
      // Update Contact section in content
      await contactNote.updateContactSectionInContent(generatedContactSection);
      
      const action = hasExistingContactSection ? 'Updated' : 'Created';
      console.debug(`[FrontMatterToContactProcessor] ${action} Contact section with ${generatedFieldCount} fields`);
      
      return Promise.resolve({
        name: this.name,
        runType: this.runType,
        file: contact.file,
        message: `${action} Contact section with ${generatedFieldCount} contact field${generatedFieldCount > 1 ? 's' : ''} in ${contact.file.name}`,
        render,
        renderGroup
      });
      
    } catch (error: any) {
      console.error(`[FrontMatterToContactProcessor] Error processing contact ${contact.file.name}:`);
      console.error(`[FrontMatterToContactProcessor] Error message: ${error.message}`);
      console.error(`[FrontMatterToContactProcessor] Error stack: ${error.stack}`);
      return Promise.resolve(undefined);
    }
  }
};
