import * as React from "react";
import { Contact, ContactNote } from "src/models";
import { getApp } from "src/context/sharedAppContext";
import { getSettings } from "src/context/sharedSettingsContext";
import { CuratorProcessor } from "src/interfaces/CuratorProcessor.d";
import { CuratorQueItem } from "src/interfaces/CuratorQueItem.d";
import { RunType } from "src/interfaces/RunType.d";

const renderGroup = (queItems: CuratorQueItem[]): JSX.Element => {
  return (
    <div className="action-card">
      <div className="action-card-content">
        <p><b>{queItems.length} contacts updated with Related list sync</b></p>
        <p>Missing relationships from frontmatter have been added to Related sections.</p>
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

export const RelatedFrontMatterProcessor: CuratorProcessor = {
  name: "RelatedFrontMatterProcessor",
  runType: RunType.INPROVEMENT,
  settingPropertyName: "relatedFrontMatterProcessor",
  settingDescription: "Automatically syncs RELATED frontmatter fields to the Related markdown section, adding missing relationships",
  settingDefaultValue: true,

  async process(contact: Contact): Promise<CuratorQueItem | undefined> {
    const activeProcessor = getSettings()[`${this.settingPropertyName}`] as boolean;
    
    if (!activeProcessor) {
      return Promise.resolve(undefined);
    }

    const settings = getSettings();
    const app = getApp();
    const contactNote = new ContactNote(app, settings, contact.file);
    
    try {
      // First check if there are frontmatter relationships and existing Related section
      const frontmatterRelationships = await contactNote.parseFrontmatterRelationships();
      
      if (frontmatterRelationships.length === 0) {
        // No frontmatter relationships to sync
        return Promise.resolve(undefined);
      }
      
      const existingRelationships = await contactNote.parseRelatedSection();
      
      // Count missing relationships before sync
      let missingCount = 0;
      const missingRelationships: string[] = [];
      
      for (const fmRel of frontmatterRelationships) {
        let contactName = '';
        
        if (fmRel.parsedValue.type === 'name') {
          contactName = fmRel.parsedValue.value;
        } else if (fmRel.parsedValue.type === 'uid') {
          // Try to resolve UID to name
          const resolvedContact = await contactNote.resolveContact(fmRel.parsedValue.value);
          contactName = resolvedContact?.name || fmRel.parsedValue.value;
        }
        
        if (contactName) {
          // Check if this relationship is missing from Related section
          const relationshipExists = existingRelationships.some(rel => 
            rel.contactName === contactName && 
            rel.type.toLowerCase() === fmRel.type.toLowerCase()
          );
          
          if (!relationshipExists) {
            missingCount++;
            missingRelationships.push(`${fmRel.type} -> ${contactName}`);
          }
        }
      }
      
      // Only perform sync if there are missing relationships
      if (missingCount === 0) {
        return Promise.resolve(undefined);
      }
      
      // Use the existing syncFrontmatterToRelatedList method
      const syncResult = await contactNote.syncFrontmatterToRelatedList();
      
      if (!syncResult.success) {
        console.error(`[RelatedFrontMatterProcessor] Failed to sync frontmatter to Related list for ${contact.file.name}`);
        syncResult.errors.forEach(error => console.error(error));
        return Promise.resolve(undefined);
      }
      
      // Log the added relationships
      missingRelationships.forEach(rel => {
        console.log(
          `[RelatedFrontMatterProcessor] Added missing relationship to Related section: ${contact.file.basename} -> ${rel}`
        );
      });
      
      // Log any warnings but return success
      if (syncResult.errors.length > 0) {
        console.warn(`[RelatedFrontMatterProcessor] Sync completed with warnings for ${contact.file.name}`);
        syncResult.errors.forEach(error => console.warn(error));
      }
      
      return Promise.resolve({
        name: this.name,
        runType: this.runType,
        file: contact.file,
        message: `Added ${missingCount} missing relationship${missingCount !== 1 ? 's' : ''} to Related section in ${contact.file.name}`,
        render,
        renderGroup
      });
      
    } catch (error) {
      console.error(`[RelatedFrontMatterProcessor] Error processing contact ${contact.file.name}: ${error.message}`);
      return Promise.resolve(undefined);
    }
  }
};