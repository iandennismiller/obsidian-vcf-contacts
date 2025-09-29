import * as React from "react";
import { Contact, ContactNote } from "src/models";
import { getApp } from "src/context/sharedAppContext";
import { getSettings } from "src/context/sharedSettingsContext";
import { CuratorProcessor, CuratorQueItem, RunType } from "src/models/curatorManager.d";

const renderGroup = (queItems: CuratorQueItem[]): JSX.Element => {
  return (
    <div className="action-card">
      <div className="action-card-content">
        <p><b>{queItems.length} contacts updated with inferred gender</b></p>
        <p>Gender has been inferred from relationship types and added to frontmatter.</p>
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

export const GenderInferenceProcessor: CuratorProcessor = {
  name: "GenderInferenceProcessor",
  runType: RunType.INPROVEMENT,
  settingPropertyName: "genderInferenceProcessor",
  settingDescription: "Automatically infers gender from relationship types and adds GENDER to contacts' frontmatter when missing",
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
      // First check if there are Related section relationships
      const relatedSectionRelationships = await contactNote.parseRelatedSection();
      
      if (relatedSectionRelationships.length === 0) {
        // No Related section relationships to analyze
        return Promise.resolve(undefined);
      }
      
      // Track gender inferences made
      let inferenceCount = 0;
      const inferencesMade: string[] = [];
      
      // Process each relationship in the Related section
      for (const relationship of relatedSectionRelationships) {
        try {
          // Check if this relationship implies a gender for the related contact
          const inferredGender = contactNote.inferGenderFromRelationship(relationship.type);
          
          if (!inferredGender) {
            // This relationship type doesn't imply a gender
            continue;
          }
          
          // Try to resolve the related contact
          const relatedContact = await contactNote.resolveContact(relationship.contactName);
          
          if (!relatedContact) {
            // Could not find the related contact file
            console.log(
              `[GenderInferenceProcessor] Could not resolve contact: ${relationship.contactName}`
            );
            continue;
          }
          
          // Check if the related contact already has a gender
          const relatedContactNote = new ContactNote(app, settings, relatedContact.file);
          const existingGender = await relatedContactNote.getGender();
          
          if (existingGender) {
            // Contact already has a gender, no inference needed
            continue;
          }
          
          // Infer and set the gender for the related contact
          await relatedContactNote.updateGender(inferredGender);
          
          inferenceCount++;
          inferencesMade.push(
            `${relationship.contactName} → ${inferredGender} (from relationship "${relationship.type}")`
          );
          
          console.log(
            `[GenderInferenceProcessor] Inferred gender ${inferredGender} for ${relationship.contactName} based on relationship "${relationship.type}" from ${contact.file.basename}`
          );
          
        } catch (error) {
          console.error(
            `[GenderInferenceProcessor] Error processing relationship ${relationship.type} -> ${relationship.contactName}: ${error.message}`
          );
        }
      }
      
      // Return result only if inferences were made
      if (inferenceCount > 0) {
        return Promise.resolve({
          name: this.name,
          runType: this.runType,
          file: contact.file,
          message: `Inferred gender for ${inferenceCount} contact${inferenceCount !== 1 ? 's' : ''} based on relationships in ${contact.file.name}`,
          render,
          renderGroup
        });
      }
      
      return Promise.resolve(undefined);
      
    } catch (error) {
      console.error(`[GenderInferenceProcessor] Error processing contact ${contact.file.name}: ${error.message}`);
      return Promise.resolve(undefined);
    }
  }
};