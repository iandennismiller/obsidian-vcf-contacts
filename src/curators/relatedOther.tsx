import * as React from "react";
import { Contact, ContactNote, FrontmatterRelationship } from "src/models";
import { ContactManager } from "src/models/contactManager";
import { getApp } from "src/context/sharedAppContext";
import { getSettings } from "src/context/sharedSettingsContext";
import { CuratorProcessor } from "src/interfaces/CuratorProcessor";
import { CuratorQueItem } from "src/interfaces/CuratorQueItem";
import { RunType } from "src/interfaces/RunType";

/**
 * Get the reciprocal relationship type for a given type
 * Local implementation for the RelatedOtherProcessor
 */
function getReciprocalRelationshipType(relationshipType: string): string | null {
  // Convert to lowercase and handle common variations
  const normalizedType = relationshipType.toLowerCase().trim();
  
  const reciprocalMap: Record<string, string> = {
    'parent': 'child',
    'father': 'child',
    'mother': 'child',
    'dad': 'child',
    'mom': 'child',
    'child': 'parent',
    'son': 'parent',
    'daughter': 'parent',
    'sibling': 'sibling',
    'brother': 'sibling',
    'sister': 'sibling',
    'spouse': 'spouse',
    'husband': 'spouse',
    'wife': 'spouse',
    'partner': 'partner',
    'friend': 'friend',
    'colleague': 'colleague',
    'relative': 'relative',
    'aunt': 'nibling',
    'uncle': 'nibling',
    'niece': 'auncle',
    'nephew': 'auncle',
    'grandparent': 'grandchild',
    'grandmother': 'grandchild',
    'grandfather': 'grandchild',
    'grandchild': 'grandparent',
    'granddaughter': 'grandparent',
    'grandson': 'grandparent',
    'cousin': 'cousin'
  };
  
  return reciprocalMap[normalizedType] || null;
}

const renderGroup = (queItems: CuratorQueItem[]): JSX.Element => {
  return (
    <div className="action-card">
      <div className="action-card-content">
        <p><b>{queItems.length} contacts updated with reciprocal relationships</b></p>
        <p>Missing reciprocal relationships have been added to contact frontmatter.</p>
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

export const RelatedOtherProcessor: CuratorProcessor = {
  name: "RelatedOtherProcessor",
  runType: RunType.INPROVEMENT,
  settingPropertyName: "relatedOtherProcessor",
  settingDescription: "Automatically adds missing reciprocal relationships to contact frontmatter based on other contacts' RELATED fields",
  settingDefaultValue: true,

  async process(contact: Contact): Promise<CuratorQueItem | undefined> {
    const activeProcessor = getSettings()[`${this.settingPropertyName}`] as boolean;
    
    if (!activeProcessor) {
      return Promise.resolve(undefined);
    }

    const settings = getSettings();
    const app = getApp();
    const contactManager = new ContactManager(app, settings);
    const contactNote = new ContactNote(app, settings, contact.file);
    
    // Helper function: Check if a relationship from another contact references this contact
    const checkIfRelationshipReferencesContact = (
      relationship: FrontmatterRelationship,
      thisContactName: string
    ): boolean => {
      if (relationship.parsedValue.type === 'name') {
        return relationship.parsedValue.value === thisContactName;
      }
      
      // For UID-based relationships, we would need additional lookup
      // For now, focusing on name-based relationships as per existing patterns
      return false;
    };
    
    // Helper function: Check if current relationships already contain a reciprocal relationship
    const hasReciprocalRelationshipInFrontmatter = (
      currentRelationships: FrontmatterRelationship[],
      otherContactName: string,
      expectedReciprocalType: string
    ): boolean => {
      // Create a temporary ContactNote to access the relationship type comparison method
      const tempContactNote = new ContactNote(app, settings, null as any);
      
      return currentRelationships.some(rel => {
        const genderless1 = tempContactNote.convertToGenderlessType(rel.type.toLowerCase());
        const genderless2 = tempContactNote.convertToGenderlessType(expectedReciprocalType.toLowerCase());
        const typesMatch = genderless1 === genderless2;
        
        const contactMatches = rel.parsedValue.type === 'name' && 
                              rel.parsedValue.value === otherContactName;
        return typesMatch && contactMatches;
      });
    };
    
    // Helper function: Generate a RELATED key for frontmatter
    const generateRelatedKey = (
      relationshipType: string, 
      existingUpdates: Record<string, string>,
      currentFrontmatter: Record<string, any>
    ): string => {
      const baseKey = `RELATED[${relationshipType}]`;
      let key = baseKey;
      
      // If base key exists, use indexed format
      if (currentFrontmatter[baseKey] || existingUpdates[baseKey]) {
        let index = 1;
        key = `RELATED[${index}:${relationshipType}]`;
        
        while (currentFrontmatter[key] || existingUpdates[key]) {
          index++;
          key = `RELATED[${index}:${relationshipType}]`;
        }
      }
      
      return key;
    };
    
    try {
      // Get the name of this contact for comparison
      const thisContactName = contact.file.basename;
      
      // Track changes made
      const frontmatterUpdates: Record<string, string> = {};
      let changesCount = 0;
      
      // Get current frontmatter relationships for this contact
      const currentRelationships = await contactNote.parseFrontmatterRelationships();
      const currentFrontmatter = await contactNote.getFrontmatter() || {};
      
      // Get all other contact files
      const allContactFiles = contactManager.getAllContactFiles();
      const otherContactFiles = allContactFiles.filter(file => file.path !== contact.file.path);
      
      // Iterate through other contacts' RELATED front matter
      for (const otherContactFile of otherContactFiles) {
        try {
          const otherContactNote = new ContactNote(app, settings, otherContactFile);
          const otherRelationships = await otherContactNote.parseFrontmatterRelationships();
          
          // Check if any relationship in other contact references this contact
          for (const otherRelationship of otherRelationships) {
            const referencesThisContact = checkIfRelationshipReferencesContact(
              otherRelationship,
              thisContactName
            );
            
            if (referencesThisContact) {
              // Get the reciprocal relationship type
              const reciprocalType = getReciprocalRelationshipType(otherRelationship.type);
              
              if (reciprocalType) {
                // Check if this contact already has the reciprocal relationship in its frontmatter
                const hasReciprocal = hasReciprocalRelationshipInFrontmatter(
                  currentRelationships,
                  otherContactFile.basename,
                  reciprocalType
                );
                
                if (!hasReciprocal) {
                  // Add the reciprocal relationship to frontmatter
                  const relationshipKey = generateRelatedKey(reciprocalType, frontmatterUpdates, currentFrontmatter);
                  const relationshipValue = otherContactFile.basename; // Using name format for simplicity
                  
                  frontmatterUpdates[relationshipKey] = relationshipValue;
                  changesCount++;
                  
                  console.log(
                    `[RelatedOtherProcessor] Adding reciprocal relationship: ${thisContactName} -> ${reciprocalType} -> ${otherContactFile.basename}`
                  );
                }
              }
            }
          }
          
        } catch (error) {
          console.error(
            `[RelatedOtherProcessor] Error processing other contact ${otherContactFile.basename}: ${error.message}`
          );
        }
      }
      
      // Apply updates if any changes were made
      if (changesCount > 0) {
        // Update the REV timestamp along with the relationship changes
        frontmatterUpdates['REV'] = contactNote.generateRevTimestamp();
        
        await contactNote.updateMultipleFrontmatterValues(frontmatterUpdates);
        
        return Promise.resolve({
          name: this.name,
          runType: this.runType,
          file: contact.file,
          message: `Added ${changesCount} missing reciprocal relationship${changesCount !== 1 ? 's' : ''} to ${contact.file.name}`,
          render,
          renderGroup
        });
      }
      
      return Promise.resolve(undefined);
      
    } catch (error) {
      console.error(`[RelatedOtherProcessor] Error processing contact ${contact.file.name}: ${error.message}`);
      return Promise.resolve(undefined);
    }
  }
};