import * as React from "react";
import { Contact, ContactNote } from "src/models";
import { getApp } from "src/plugin/context/sharedAppContext";
import { getSettings } from "src/plugin/context/sharedSettingsContext";
import { CuratorProcessor } from "src/models/curatorManager/CuratorProcessor";
import { CuratorQueItem } from "src/models/curatorManager/CuratorQueItem";
import { RunType } from "src/models/curatorManager/RunType";
import { UpdateContactModal, FieldChange } from "src/plugin/ui/modals/updateContactModal";
import { normalizeFieldValue } from "src/models/contactNote/fieldPatternDetection";

const renderGroup = (queItems: CuratorQueItem[]): JSX.Element => {
  const totalChanges = queItems.reduce((sum, item) => {
    // Extract change count from message
    const match = item.message?.match(/(\d+) contact field/);
    return sum + (match ? parseInt(match[1]) : 0);
  }, 0);
  
  return (
    <div className="action-card">
      <div className="action-card-content">
        <p><b>{queItems.length} contacts updated with Contact section sync</b></p>
        <p>Contact information from Contact sections has been synced to frontmatter ({totalChanges} total fields).</p>
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
      const changes: FieldChange[] = [];
      let changeCount = 0;
      
      // Track existing contact field keys for deletion detection
      const existingContactKeys = new Set(
        Object.keys(currentFrontmatter).filter(key => /^(EMAIL|TEL|ADR|URL)(\[|\.)?/.test(key))
      );
      
      for (const field of contactFields) {
        let frontmatterKey: string;
        
        if (field.component) {
          // Structured field (e.g., ADR[HOME].STREET or ADR.STREET for bare)
          if (field.fieldLabel) {
            frontmatterKey = `${field.fieldType}[${field.fieldLabel}].${field.component}`;
          } else {
            frontmatterKey = `${field.fieldType}.${field.component}`;
          }
        } else {
          // Simple field (e.g., EMAIL[HOME] or EMAIL for bare)
          if (field.fieldLabel) {
            frontmatterKey = `${field.fieldType}[${field.fieldLabel}]`;
          } else {
            frontmatterKey = field.fieldType;
          }
        }
        
        // Normalize the value based on field type
        const normalizedValue = normalizeFieldValue(field.value, field.fieldType);
        
        // Remove from deletion tracking
        existingContactKeys.delete(frontmatterKey);
        
        // Check if value differs from current frontmatter
        const currentValue = currentFrontmatter[frontmatterKey];
        if (currentValue !== normalizedValue) {
          updates[frontmatterKey] = normalizedValue;
          changeCount++;
          
          // Track change type for confirmation modal
          if (currentValue === undefined) {
            changes.push({
              key: frontmatterKey,
              newValue: normalizedValue,
              changeType: 'added'
            });
          } else {
            changes.push({
              key: frontmatterKey,
              oldValue: currentValue,
              newValue: normalizedValue,
              changeType: 'modified'
            });
          }
          
          console.debug(`[ContactToFrontMatterProcessor] Will update ${frontmatterKey}: ${normalizedValue}`);
        }
      }
      
      // Handle deletions - fields in frontmatter but not in Contact section
      // Note: We only delete if explicitly removed from Contact section, not if section is incomplete
      // To avoid data loss, we require Contact section to be "complete" before deleting fields
      // For now, we skip deletion to be safe
      // TODO: Future enhancement - detect if Contact section is complete/authoritative
      
      
      if (changeCount === 0) {
        console.debug(`[ContactToFrontMatterProcessor] No changes needed, Contact section matches frontmatter`);
        return Promise.resolve(undefined);
      }
      
      // Check if confirmation is required
      const requireConfirmation = settings.contactSectionSyncConfirmation;
      
      if (requireConfirmation && !isManualInvocation) {
        // Show confirmation modal
        console.debug(`[ContactToFrontMatterProcessor] Showing confirmation modal for ${changeCount} changes`);
        
        return new Promise<CuratorQueItem | undefined>((resolve) => {
          const modal = new UpdateContactModal(
            app,
            changes,
            async () => {
              // User confirmed - apply changes
              console.debug(`[ContactToFrontMatterProcessor] User confirmed - updating ${changeCount} frontmatter fields`);
              await contactNote.updateMultipleFrontmatterValues(updates, true); // true = update REV
              
              resolve({
                name: this.name,
                runType: this.runType,
                file: contact.file,
                message: `Synced ${changeCount} contact field${changeCount > 1 ? 's' : ''} from Contact section to frontmatter in ${contact.file.name}`,
                render,
                renderGroup
              });
            },
            () => {
              // User cancelled
              console.debug(`[ContactToFrontMatterProcessor] User cancelled sync`);
              resolve(undefined);
            }
          );
          modal.open();
        });
      } else {
        // No confirmation needed or manual invocation - apply directly
        console.debug(`[ContactToFrontMatterProcessor] Updating ${changeCount} frontmatter fields without confirmation`);
        await contactNote.updateMultipleFrontmatterValues(updates, true); // true = update REV
        
        return Promise.resolve({
          name: this.name,
          runType: this.runType,
          file: contact.file,
          message: `Synced ${changeCount} contact field${changeCount > 1 ? 's' : ''} from Contact section to frontmatter in ${contact.file.name}`,
          render,
          renderGroup
        });
      }
      
    } catch (error: any) {
      console.error(`[ContactToFrontMatterProcessor] Error processing contact ${contact.file.name}:`);
      console.error(`[ContactToFrontMatterProcessor] Error message: ${error.message}`);
      console.error(`[ContactToFrontMatterProcessor] Error stack: ${error.stack}`);
      return Promise.resolve(undefined);
    }
  }
};
