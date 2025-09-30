import * as React from "react";
import { Contact, ContactNote } from "src/models";
import { ContactManager } from "src/models/contactManager";
import { getApp } from "src/plugin/context/sharedAppContext";
import { getSettings } from "src/plugin/context/sharedSettingsContext";
import { CuratorProcessor } from "src/interfaces/CuratorProcessor";
import { CuratorQueItem } from "src/interfaces/CuratorQueItem";
import { RunType } from "src/interfaces/RunType";

const renderGroup = (queItems: CuratorQueItem[]): JSX.Element => {
  return (
    <div className="action-card">
      <div className="action-card-content">
        <p><b>{queItems.length} contacts upgraded to UID-based relationships</b></p>
        <p>Name-based RELATED fields have been upgraded to UID-based references for better reliability.</p>
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

export const RelatedNamespaceUpgradeProcessor: CuratorProcessor = {
  name: "RelatedNamespaceUpgradeProcessor",
  runType: RunType.INPROVEMENT,
  settingPropertyName: "relatedNamespaceUpgradeProcessor",
  settingDescription: "Automatically upgrades name-based RELATED relationships to UID-based references when target contacts exist with UIDs",
  settingDefaultValue: true,

  async process(contact: Contact): Promise<CuratorQueItem | undefined> {
    const activeProcessor = getSettings()[`${this.settingPropertyName}`] as boolean;
    
    if (!activeProcessor) {
      return Promise.resolve(undefined);
    }

    const settings = getSettings();
    const app = getApp();
    const contactNote = new ContactNote(app, settings, contact.file);
    const contactManager = new ContactManager(app, settings);
    
    try {
      // First check if there are frontmatter RELATED relationships
      const frontmatterRelationships = await contactNote.parseFrontmatterRelationships();
      
      if (frontmatterRelationships.length === 0) {
        // No frontmatter RELATED relationships to process
        return Promise.resolve(undefined);
      }
      
      // Track upgrades made
      let upgradeCount = 0;
      const upgradesMade: string[] = [];
      const frontmatterUpdates: Record<string, string> = {};
      
      // Process each RELATED relationship in frontmatter
      for (const relationship of frontmatterRelationships) {
        try {
          // Only process name-based relationships
          if (relationship.parsedValue.type !== 'name') {
            // Already UID-based, skip
            continue;
          }
          
          const contactName = relationship.parsedValue.value;
          
          // Try to resolve the contact by name to see if it now exists with a UID
          const resolvedContact = await contactNote.resolveContact(contactName);
          
          if (!resolvedContact || !resolvedContact.uid) {
            // Could not find the contact or it doesn't have a UID
            continue;
          }
          
          // Check if the UID is unique in the vault
          await contactManager.initializeCache(); // Ensure cache is current
          const contactFileByUID = await contactManager.findContactFileByUID(resolvedContact.uid);
          
          if (!contactFileByUID) {
            // This shouldn't happen since we just resolved it, but be safe
            console.warn(
              `[RelatedNamespaceUpgradeProcessor] Could not find contact file for UID ${resolvedContact.uid} in ${contact.file.basename}`
            );
            continue;
          }
          
          // Check if there are multiple contacts with the same UID (should not happen, but be safe)
          const allContactFiles = contactManager.getAllContactFiles();
          let uidCount = 0;
          for (const file of allContactFiles) {
            const fileUID = await contactManager.extractUIDFromFile(file);
            if (fileUID === resolvedContact.uid) {
              uidCount++;
            }
          }
          
          if (uidCount > 1) {
            // UID is not unique - log warning and leave unchanged
            console.warn(
              `[RelatedNamespaceUpgradeProcessor] UID ${resolvedContact.uid} is not unique (found in ${uidCount} contacts). Leaving name-based relationship unchanged for ${contactName} in ${contact.file.basename}`
            );
            continue;
          }
          
          // Upgrade the relationship to UID-based
          const upgradedValue = contactNote.formatRelatedValue(resolvedContact.uid, resolvedContact.name);
          
          // Find the frontmatter key for this relationship
          const currentFrontmatter = await contactNote.getFrontmatter() || {};
          let relationshipKey = '';
          
          for (const [key, value] of Object.entries(currentFrontmatter)) {
            if (key.startsWith('RELATED') && value === relationship.value) {
              relationshipKey = key;
              break;
            }
          }
          
          if (!relationshipKey) {
            console.error(
              `[RelatedNamespaceUpgradeProcessor] Could not find frontmatter key for relationship ${relationship.value} in ${contact.file.basename}`
            );
            continue;
          }
          
          // Update the relationship value
          frontmatterUpdates[relationshipKey] = upgradedValue;
          
          upgradeCount++;
          const namespace = upgradedValue.startsWith('urn:uuid:') ? 'urn:uuid:' : 'uid:';
          upgradesMade.push(
            `${relationship.type}: name:${contactName} → ${namespace}${resolvedContact.uid}`
          );
          
          console.log(
            `[RelatedNamespaceUpgradeProcessor] Upgraded relationship in ${contact.file.basename}: ${relationship.type} from name:${contactName} to ${upgradedValue}`
          );
          
        } catch (error) {
          console.error(
            `[RelatedNamespaceUpgradeProcessor] Error processing relationship ${relationship.type} -> ${relationship.value}: ${error.message}`
          );
        }
      }
      
      // Apply upgrades if any were made
      if (upgradeCount > 0) {
        await contactNote.updateMultipleFrontmatterValues(frontmatterUpdates);
        
        console.log(
          `[RelatedNamespaceUpgradeProcessor] Upgraded ${upgradeCount} relationship${upgradeCount !== 1 ? 's' : ''} in ${contact.file.basename}`
        );
        
        return Promise.resolve({
          name: this.name,
          runType: this.runType,
          file: contact.file,
          message: `Upgraded ${upgradeCount} relationship${upgradeCount !== 1 ? 's' : ''} from name-based to UID-based references in ${contact.file.name}`,
          render,
          renderGroup
        });
      }
      
      return Promise.resolve(undefined);
      
    } catch (error) {
      console.error(`[RelatedNamespaceUpgradeProcessor] Error processing contact ${contact.file.name}: ${error.message}`);
      return Promise.resolve(undefined);
    }
  }
};