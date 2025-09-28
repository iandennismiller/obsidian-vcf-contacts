import * as React from "react";
import { Contact, ContactNote } from "src";
import { getApp } from "src/context/sharedAppContext";
import { getSettings } from "src/context/sharedSettingsContext";
import { InsightProcessor, InsightQueItem, RunType } from "src/insights/insight.d";

const renderGroup = (queItems: InsightQueItem[]): JSX.Element => {
  return (
    <div className="action-card">
      <div className="action-card-content">
        <p><b>{queItems.length} contacts updated with gendered relationship terms</b></p>
        <p>Ungendered relationship terms have been replaced with gendered equivalents based on contact gender information.</p>
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

export const GenderRenderProcessor: InsightProcessor = {
  name: "GenderRenderProcessor",
  runType: RunType.INPROVEMENT,
  settingPropertyName: "genderRenderProcessor",
  settingDescription: "Automatically replaces ungendered relationship terms in Related section with gendered equivalents when contact gender is known",
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
        // No Related section relationships to process
        return Promise.resolve(undefined);
      }
      
      // Track changes made
      let changesCount = 0;
      const changesMade: string[] = [];
      const updatedRelationships: { type: string; contactName: string }[] = [];
      
      // Process each relationship in the Related section
      for (const relationship of relatedSectionRelationships) {
        try {
          // Try to resolve the related contact to get their gender
          const relatedContact = await contactNote.resolveContact(relationship.contactName);
          
          if (!relatedContact || !relatedContact.gender) {
            // Could not find the related contact or they don't have a gender
            // Keep the original relationship term unchanged
            updatedRelationships.push({
              type: relationship.type,
              contactName: relationship.contactName
            });
            continue;
          }
          
          // Get the gendered version of the relationship term
          const genderedTerm = contactNote.getGenderedRelationshipTerm(relationship.type, relatedContact.gender);
          
          // Check if the term changed (i.e., was previously ungendered)
          if (genderedTerm !== relationship.type) {
            // The term changed from ungendered to gendered
            changesCount++;
            changesMade.push(
              `${relationship.type} [[${relationship.contactName}]] → ${genderedTerm} [[${relationship.contactName}]]`
            );
            
            console.log(
              `[GenderRenderProcessor] Updated relationship term: "${relationship.type}" → "${genderedTerm}" for ${relationship.contactName} (gender: ${relatedContact.gender}) in ${contact.file.basename}`
            );
            
            updatedRelationships.push({
              type: genderedTerm,
              contactName: relationship.contactName
            });
          } else {
            // The term didn't change (was already gendered or doesn't have gendered equivalent)
            updatedRelationships.push({
              type: relationship.type,
              contactName: relationship.contactName
            });
          }
          
        } catch (error) {
          console.error(
            `[GenderRenderProcessor] Error processing relationship ${relationship.type} -> ${relationship.contactName}: ${error.message}`
          );
          
          // Keep the original relationship on error
          updatedRelationships.push({
            type: relationship.type,
            contactName: relationship.contactName
          });
        }
      }
      
      // Update Related section if any changes were made
      if (changesCount > 0) {
        await contactNote.updateRelatedSectionInContent(updatedRelationships);
        
        console.log(
          `[GenderRenderProcessor] Updated ${changesCount} relationship term${changesCount !== 1 ? 's' : ''} in Related section of ${contact.file.basename}`
        );
        
        return Promise.resolve({
          name: this.name,
          runType: this.runType,
          file: contact.file,
          message: `Updated ${changesCount} relationship term${changesCount !== 1 ? 's' : ''} with gendered equivalents in ${contact.file.name}`,
          render,
          renderGroup
        });
      }
      
      return Promise.resolve(undefined);
      
    } catch (error) {
      console.error(`[GenderRenderProcessor] Error processing contact ${contact.file.name}: ${error.message}`);
      return Promise.resolve(undefined);
    }
  }
};