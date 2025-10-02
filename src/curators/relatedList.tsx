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
        <p><b>{queItems.length} contacts updated with Related list sync</b></p>
        <p>Missing relationships from Related sections have been added to frontmatter.</p>
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

export const RelatedListProcessor: CuratorProcessor = {
  name: "RelatedListProcessor",
  runType: RunType.IMPROVEMENT,

  async process(contact: Contact): Promise<CuratorQueItem | undefined> {
    const settings = getSettings();
    const app = getApp();
    const contactNote = new ContactNote(app, settings, contact.file);
    
    try {
      // First check if there are Related section relationships
      const relatedSectionRelationships = await contactNote.parseRelatedSection();
      
      console.log(`[RelatedListProcessor] Parsed ${relatedSectionRelationships.length} relationships from Related section`);
      
      if (relatedSectionRelationships.length === 0) {
        // No Related section relationships to sync
        console.log(`[RelatedListProcessor] No relationships in Related section, returning early`);
        return Promise.resolve(undefined);
      }
      
      // Get current frontmatter relationships
      const currentFrontmatterRelationships = await contactNote.parseFrontmatterRelationships();
      const currentFrontmatter = await contactNote.getFrontmatter() || {};
      
      console.log(`[RelatedListProcessor] Found ${relatedSectionRelationships.length} relationships in Related section`);
      relatedSectionRelationships.forEach(rel => {
        console.log(`[RelatedListProcessor]   Related section: ${rel.type} -> ${rel.contactName}`);
      });
      
      console.log(`[RelatedListProcessor] Found ${currentFrontmatterRelationships.length} relationships in frontmatter`);
      currentFrontmatterRelationships.forEach(rel => {
        console.log(`[RelatedListProcessor]   Frontmatter: ${rel.type} -> ${rel.value} (parsedValue: ${rel.parsedValue ? rel.parsedValue.type + ':' + rel.parsedValue.value : 'undefined'})`);
      });
      
      // Check for duplicates in Related section
      const seenRelationships = new Map<string, boolean>(); // key: genderlessType:contactName
      let hasDuplicates = false;
      
      for (const rel of relatedSectionRelationships) {
        const genderlessType = contactNote.convertToGenderlessType(rel.type);
        const key = `${genderlessType}:${rel.contactName.toLowerCase()}`;
        if (seenRelationships.has(key)) {
          hasDuplicates = true;
          console.log(`[RelatedListProcessor] Duplicate detected: ${rel.type} -> ${rel.contactName}`);
        } else {
          seenRelationships.set(key, true);
        }
      }
      
      if (hasDuplicates) {
        console.log(`[RelatedListProcessor] Duplicates found in Related section, triggering deduplication sync`);
        const syncResult = await contactNote.syncRelatedListToFrontmatter();
        
        if (!syncResult.success) {
          console.error(`[RelatedListProcessor] Failed to sync Related list to frontmatter for ${contact.file.name}`);
          syncResult.errors.forEach(error => console.error(error));
          return Promise.resolve(undefined);
        }
        
        console.log(`[RelatedListProcessor] Deduplication sync completed successfully for ${contact.file.basename}`);
        
        return Promise.resolve({
          name: this.name,
          runType: this.runType,
          file: contact.file,
          message: `Removed duplicate relationships from ${contact.file.name}`,
          render,
          renderGroup
        });
      }
      
      // Count missing relationships before sync
      let missingCount = 0;
      const missingRelationships: string[] = [];
      
      for (const relRel of relatedSectionRelationships) {
        // Check if this relationship is missing from frontmatter
        // Need to handle both name-based and UID-based frontmatter relationships
        let relationshipExists = false;
        
        console.log(`[RelatedListProcessor] Checking if ${relRel.type} -> ${relRel.contactName} exists in frontmatter...`);
        
        for (const fmRel of currentFrontmatterRelationships) {
          // Types must match (case-insensitive)
          if (fmRel.type.toLowerCase() !== relRel.type.toLowerCase()) {
            continue;
          }
          
          console.log(`[RelatedListProcessor]   Comparing with frontmatter ${fmRel.type}: ${fmRel.value}`);
          
          // Check if frontmatter uses name-based reference
          if (fmRel.parsedValue && fmRel.parsedValue.type === 'name') {
            console.log(`[RelatedListProcessor]     Parsed as name: ${fmRel.parsedValue.value}`);
            if (fmRel.parsedValue.value === relRel.contactName) {
              console.log(`[RelatedListProcessor]     MATCH! Relationship exists.`);
              relationshipExists = true;
              break;
            }
          }
          
          // Check if frontmatter uses UID-based reference - need to resolve it
          if (fmRel.parsedValue && (fmRel.parsedValue.type === 'uid' || fmRel.parsedValue.type === 'uuid')) {
            try {
              const resolvedName = await contactNote.resolveContactNameByUID(fmRel.parsedValue.value);
              console.log(`[RelatedListProcessor]     Parsed as UID, resolved to: ${resolvedName}`);
              if (resolvedName === relRel.contactName) {
                console.log(`[RelatedListProcessor]     MATCH! Relationship exists.`);
                relationshipExists = true;
                break;
              }
            } catch (error) {
              // If resolution fails, continue checking other relationships
              console.debug(`[RelatedListProcessor] Could not resolve UID ${fmRel.parsedValue.value}: ${error}`);
            }
          }
          
          // If parsedValue is undefined, this frontmatter entry can't be matched
          if (!fmRel.parsedValue) {
            console.log(`[RelatedListProcessor]     parsedValue is undefined, cannot match (malformed value)`);
          }
        }
        
        if (!relationshipExists) {
          console.log(`[RelatedListProcessor]   Result: MISSING from frontmatter`);
          missingCount++;
          missingRelationships.push(`${relRel.type} -> ${relRel.contactName}`);
        } else {
          console.log(`[RelatedListProcessor]   Result: EXISTS in frontmatter`);
        }
      }
      
      // Only perform sync if there are missing relationships
      if (missingCount === 0) {
        return Promise.resolve(undefined);
      }
      
      // Log what we're about to sync
      console.log(`[RelatedListProcessor] About to sync ${missingCount} missing relationship(s) for ${contact.file.basename}`);
      missingRelationships.forEach(rel => console.log(`[RelatedListProcessor]   - ${rel}`));
      
      // Use the existing syncRelatedListToFrontmatter method
      const syncResult = await contactNote.syncRelatedListToFrontmatter();
      
      if (!syncResult.success) {
        console.error(`[RelatedListProcessor] Failed to sync Related list to frontmatter for ${contact.file.name}`);
        syncResult.errors.forEach(error => console.error(error));
        return Promise.resolve(undefined);
      }
      
      console.log(`[RelatedListProcessor] Sync completed successfully for ${contact.file.basename}`);
      if (syncResult.errors.length > 0) {
        console.warn(`[RelatedListProcessor] Sync had warnings:`);
        syncResult.errors.forEach(error => console.warn(`[RelatedListProcessor]   - ${error}`));
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
      
    } catch (error: any) {
      console.error(`[RelatedListProcessor] Error processing contact ${contact.file.name}:`);
      console.error(`[RelatedListProcessor] Error message: ${error.message}`);
      console.error(`[RelatedListProcessor] Error stack: ${error.stack}`);
      return Promise.resolve(undefined);
    }
  }
};