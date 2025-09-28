import * as React from "react";
import { Contact, ContactNote } from "src";
import { getApp } from "src/context/sharedAppContext";
import { getSettings } from "src/context/sharedSettingsContext";
import { InsightProcessor, InsightQueItem, RunType } from "src/insights/insight.d";

const renderGroup = (queItems: InsightQueItem[]): JSX.Element => {
  return (
    <div className="action-card">
      <div className="action-card-content">
        <p><b>{queItems.length} contacts updated with Related list sync</b></p>
        <p>Missing relationships from Related sections have been added to frontmatter.</p>
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

export const RelatedListProcessor: InsightProcessor = {
  name: "RelatedListProcessor",
  runType: RunType.INPROVEMENT,
  settingPropertyName: "relatedListProcessor",
  settingDescription: "Automatically syncs Related markdown section to RELATED frontmatter fields, adding missing relationships",
  settingDefaultValue: true,

  async process(contact: Contact): Promise<InsightQueItem | undefined> {
    const activeProcessor = getSettings()[`${this.settingPropertyName}`] as boolean;
    
    if (!activeProcessor) {
      return Promise.resolve(undefined);
    }

    const settings = getSettings();
    const app = getApp();
    const contactNote = new ContactNote(app, settings, contact.file);
    
    try {
      // First check if there are Related section relationships
      const relatedSectionRelationships = await contactNote.parseRelatedSection();
      
      if (relatedSectionRelationships.length === 0) {
        // No Related section relationships to sync
        return Promise.resolve(undefined);
      }
      
      // Get current frontmatter relationships
      const currentFrontmatterRelationships = await contactNote.parseFrontmatterRelationships();
      const currentFrontmatter = await contactNote.getFrontmatter() || {};
      
      // Count missing relationships before sync
      let missingCount = 0;
      const missingRelationships: string[] = [];
      
      for (const relRel of relatedSectionRelationships) {
        // Check if this relationship is missing from frontmatter
        const relationshipExists = currentFrontmatterRelationships.some(fmRel => 
          fmRel.parsedValue.type === 'name' &&
          fmRel.parsedValue.value === relRel.contactName && 
          fmRel.type.toLowerCase() === relRel.type.toLowerCase()
        );
        
        if (!relationshipExists) {
          missingCount++;
          missingRelationships.push(`${relRel.type} -> ${relRel.contactName}`);
        }
      }
      
      // Only perform sync if there are missing relationships
      if (missingCount === 0) {
        return Promise.resolve(undefined);
      }
      
      // Use the existing syncRelatedListToFrontmatter method
      const syncResult = await contactNote.syncRelatedListToFrontmatter();
      
      if (!syncResult.success) {
        console.error(`[RelatedListProcessor] Failed to sync Related list to frontmatter for ${contact.file.name}`);
        syncResult.errors.forEach(error => console.error(error));
        return Promise.resolve(undefined);
      }
      
      // Update REV timestamp if the front matter changed (we know it changed because missingCount > 0)
      if (missingCount > 0) {
        const revTimestamp = contactNote.generateRevTimestamp();
        await contactNote.updateFrontmatterValue('REV', revTimestamp);
        console.log(`[RelatedListProcessor] Updated REV timestamp: ${revTimestamp}`);
      }
      
      // Log the added relationships
      missingRelationships.forEach(rel => {
        console.log(
          `[RelatedListProcessor] Added missing relationship to frontmatter: ${contact.file.basename} -> ${rel}`
        );
      });
      
      // Log any warnings but return success
      if (syncResult.errors.length > 0) {
        console.warn(`[RelatedListProcessor] Sync completed with warnings for ${contact.file.name}`);
        syncResult.errors.forEach(error => console.warn(error));
      }
      
      return Promise.resolve({
        name: this.name,
        runType: this.runType,
        file: contact.file,
        message: `Added ${missingCount} missing relationship${missingCount !== 1 ? 's' : ''} to frontmatter from Related section in ${contact.file.name}`,
        render,
        renderGroup
      });
      
    } catch (error) {
      console.error(`[RelatedListProcessor] Error processing contact ${contact.file.name}: ${error.message}`);
      return Promise.resolve(undefined);
    }
  }
};