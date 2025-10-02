/**
 * Sync operations optimized for data locality with ContactData
 */

import { ContactData } from './contactData';
import { RelationshipOperations, ParsedRelationship, FrontmatterRelationship } from './relationshipOperations';
import { Gender } from './types';

/**
 * Synchronization operations that work directly with ContactData
 * and RelationshipOperations for optimal data locality.
 */
export class SyncOperations {
  private contactData: ContactData;
  private relationshipOps: RelationshipOperations;

  constructor(contactData: ContactData, relationshipOps: RelationshipOperations) {
    this.contactData = contactData;
    this.relationshipOps = relationshipOps;
  }

  // === Relationship Sync Operations (co-located with relationship data access) ===

  /**
   * Deduplicate relationships, preferring gendered terms over ungendered
   * Returns deduplicated relationships and inferred gender information
   */
  private deduplicateRelationships(relationships: ParsedRelationship[]): {
    deduplicated: ParsedRelationship[];
    inferredGender: Map<string, Gender>;
  } {
    const seen = new Map<string, ParsedRelationship>(); // key: genderlessType:contactName (lowercase)
    const inferredGender = new Map<string, Gender>();
    
    for (const rel of relationships) {
      // Convert to genderless type first to properly identify duplicates
      const genderlessType = this.relationshipOps.convertToGenderlessType(rel.type);
      const contactKey = `${genderlessType}:${rel.contactName.toLowerCase()}`;
      const existing = seen.get(contactKey);
      
      if (!existing) {
        // First occurrence of this relationship type for this contact
        seen.set(contactKey, rel);
        
        // Check if this is a gendered term and infer gender
        const gender = this.relationshipOps.inferGenderFromRelationship(rel.type);
        if (gender) {
          inferredGender.set(rel.contactName, gender);
        }
        continue;
      }
      
      // We have a duplicate of the same relationship type for the same contact
      // Prefer the gendered version
      const existingGender = this.relationshipOps.inferGenderFromRelationship(existing.type);
      const currentGender = this.relationshipOps.inferGenderFromRelationship(rel.type);
      
      // If current is gendered but existing is not, replace with current
      if (currentGender && !existingGender) {
        seen.set(contactKey, rel);
        inferredGender.set(rel.contactName, currentGender);
        console.log(`[SyncOperations] De-duplication: Replacing "${existing.type}" with gendered "${rel.type}" for [[${rel.contactName}]]`);
      } else if (currentGender) {
        // Both are gendered, keep the first one but update inferred gender
        inferredGender.set(existing.contactName, existingGender!);
        console.log(`[SyncOperations] De-duplication: Keeping "${existing.type}" (both gendered) for [[${existing.contactName}]]`);
      } else {
        // Both ungendered or existing is gendered, keep existing
        console.log(`[SyncOperations] De-duplication: Keeping "${existing.type}" for [[${existing.contactName}]]`);
      }
    }
    
    return {
      deduplicated: Array.from(seen.values()),
      inferredGender
    };
  }

  /**
   * Sync Related list from markdown to frontmatter
   * Groups sync logic with data access for better cache locality
   */
  async syncRelatedListToFrontmatter(): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    try {
      const relationships = await this.relationshipOps.parseRelatedSection();
      
      // Deduplicate relationships before processing
      const { deduplicated, inferredGender } = this.deduplicateRelationships(relationships);
      
      if (relationships.length !== deduplicated.length) {
        console.log(`[SyncOperations] Deduplicated ${relationships.length} relationships to ${deduplicated.length}`);
      }
      
      const frontmatterUpdates: Record<string, string> = {};
      const typeIndices = new Map<string, number>(); // Track index per relationship type

      // First, clear existing RELATED fields from frontmatter
      const frontmatter = await this.contactData.getFrontmatter();
      if (frontmatter) {
        Object.keys(frontmatter).forEach(key => {
          if (key.startsWith('RELATED') || key === 'RELATED') {
            frontmatterUpdates[key] = ''; // Mark for deletion
          }
        });
      }

      // Process each deduplicated relationship
      for (const relationship of deduplicated) {
        try {
          // Convert to genderless type for storage in frontmatter
          const genderlessType = this.relationshipOps.convertToGenderlessType(relationship.type);
          console.log(`[SyncOperations] Processing relationship: ${relationship.type} -> ${relationship.contactName}, genderless type: ${genderlessType}`);
          
          // Get or initialize index for this relationship type
          const currentIndex = typeIndices.get(genderlessType) || 0;
          console.log(`[SyncOperations]   Current index for type '${genderlessType}': ${currentIndex}`);
          typeIndices.set(genderlessType, currentIndex + 1);
          console.log(`[SyncOperations]   Updated index for type '${genderlessType}' to: ${currentIndex + 1}`);
          
          const resolvedContact = await this.relationshipOps.resolveContact(relationship.contactName);
          
          if (resolvedContact) {
            const relatedValue = this.relationshipOps.formatRelatedValue(
              resolvedContact.uid, 
              resolvedContact.name
            );
            
            // Use indexed RELATED fields for multiple relationships of the same type
            const key = currentIndex === 0 
              ? `RELATED[${genderlessType}]`
              : `RELATED[${currentIndex}:${genderlessType}]`;
            
            console.log(`[SyncOperations]   Generated key: ${key}`);
            frontmatterUpdates[key] = relatedValue;
          } else {
            // Keep unresolved relationships as name references
            const key = currentIndex === 0 
              ? `RELATED[${genderlessType}]`
              : `RELATED[${currentIndex}:${genderlessType}]`;
            
            console.log(`[SyncOperations]   Generated key (unresolved): ${key}`);
            frontmatterUpdates[key] = `name:${relationship.contactName}`;
            
            errors.push(`Could not resolve contact: ${relationship.contactName}`);
          }
        } catch (error: any) {
          errors.push(`Error processing relationship ${relationship.contactName}: ${error.message}`);
        }
      }

      // Apply all frontmatter updates in one operation
      // Note: We need to pass empty values to delete malformed keys
      if (Object.keys(frontmatterUpdates).length > 0) {
        console.log(`[SyncOperations] Applying ${Object.keys(frontmatterUpdates).length} frontmatter updates`);
        Object.entries(frontmatterUpdates).forEach(([key, value]) => {
          if (value === '') {
            console.log(`[SyncOperations]   Deleting: ${key}`);
          } else {
            console.log(`[SyncOperations]   Setting: ${key} = ${value}`);
          }
        });
        await this.contactData.updateMultipleFrontmatterValues(frontmatterUpdates);
        console.log(`[SyncOperations] Frontmatter updates applied successfully`);
      }
      
      // If we deduplicated, also update the Related section to match
      if (relationships.length !== deduplicated.length) {
        console.log(`[SyncOperations] Updating Related section to reflect deduplicated relationships`);
        await this.relationshipOps.updateRelatedSectionInContent(
          deduplicated.map(rel => ({
            type: rel.type,
            contactName: rel.contactName
          }))
        );
      }

      return { success: true, errors };
    } catch (error: any) {
      errors.push(`Sync operation failed: ${error.message}`);
      return { success: false, errors };
    }
  }

  /**
   * Sync relationships from frontmatter to markdown
   * Co-locates frontmatter access with sync logic
   */
  async syncFrontmatterToRelatedList(): Promise<{ 
    success: boolean; 
    errors: string[];
    updatedRelationships?: Array<{ newName: string; uid: string; oldName?: string }>;
  }> {
    const errors: string[] = [];
    const updatedRelationships: Array<{ newName: string; uid: string; oldName?: string }> = [];
    
    try {
      const frontmatterRelationships = await this.relationshipOps.parseFrontmatterRelationships();
      const existingMarkdownRelationships = await this.relationshipOps.parseRelatedSection();
      const markdownRelationships: { type: string; contactName: string }[] = [];

      for (const fmRel of frontmatterRelationships) {
        try {
          if (fmRel.parsedValue) {
            let contactName: string;
            
            // Resolve the contact name based on the value type
            if (fmRel.parsedValue.type === 'name') {
              contactName = fmRel.parsedValue.value;
            } else {
              // For UUID/UID, try to find the contact
              const resolvedContact = await this.findContactByUid(fmRel.parsedValue.value);
              if (resolvedContact) {
                contactName = resolvedContact.name;
                
                // Check if this is an update (name changed for same UID)
                const existingRel = existingMarkdownRelationships.find(rel => 
                  rel.type === fmRel.type
                );
                if (existingRel && existingRel.contactName !== contactName) {
                  updatedRelationships.push({
                    newName: contactName,
                    uid: fmRel.parsedValue.value,
                    oldName: existingRel.contactName
                  });
                }
              } else {
                contactName = fmRel.parsedValue.value; // Fallback to raw value
                errors.push(`Could not resolve UID/UUID: ${fmRel.parsedValue.value}`);
              }
            }
            
            markdownRelationships.push({
              type: fmRel.type,
              contactName: contactName
            });
          } else {
            errors.push(`Could not parse RELATED value: ${fmRel.value}`);
          }
        } catch (error: any) {
          errors.push(`Error processing frontmatter relationship ${fmRel.key}: ${error.message}`);
        }
      }

      // Update the Related section in markdown
      await this.relationshipOps.updateRelatedSectionInContent(markdownRelationships);

      return { success: true, errors, updatedRelationships };
    } catch (error: any) {
      errors.push(`Frontmatter to markdown sync failed: ${error.message}`);
      return { success: false, errors };
    }
  }

  // === Bidirectional Sync (co-located with sync operations) ===

  /**
   * Perform full bidirectional sync between markdown and frontmatter
   * Groups all sync operations together for better data locality
   */
  async performFullSync(): Promise<{ success: boolean; errors: string[] }> {
    const allErrors: string[] = [];
    let overallSuccess = true;

    try {
      // Sync markdown to frontmatter first (primary direction)
      const markdownToFm = await this.syncRelatedListToFrontmatter();
      if (!markdownToFm.success) {
        overallSuccess = false;
      }
      allErrors.push(...markdownToFm.errors);

      // Then sync frontmatter back to markdown for consistency
      const fmToMarkdown = await this.syncFrontmatterToRelatedList();
      if (!fmToMarkdown.success) {
        overallSuccess = false;
      }
      allErrors.push(...fmToMarkdown.errors);

      return { success: overallSuccess, errors: allErrors };
    } catch (error: any) {
      allErrors.push(`Full sync operation failed: ${error.message}`);
      return { success: false, errors: allErrors };
    }
  }

  // === Helper Methods (grouped with sync operations) ===

  /**
   * Find contact by UID - helper for sync operations
   * Co-located with sync logic for better cache locality
   */
  private async findContactByUid(uid: string): Promise<{ name: string; file: any } | null> {
    const app = this.contactData.getApp();
    const allFiles = app.vault.getMarkdownFiles();

    for (const file of allFiles) {
      try {
        // Create temporary ContactData to check UID
        const tempContactData = new ContactData(app, file);
        const fileUid = await tempContactData.getUID();
        
        if (fileUid === uid) {
          // Get FN from frontmatter, fallback to basename
          const frontmatter = await tempContactData.getFrontmatter();
          const contactName = frontmatter?.FN || file.basename;
          
          return {
            name: contactName,
            file: file
          };
        }
      } catch (error: any) {
        // Skip files that can't be processed
        continue;
      }
    }

    return null;
  }

  /**
   * Validate relationship consistency
   * Groups validation with sync operations
   */
  async validateRelationshipConsistency(): Promise<{ 
    isConsistent: boolean; 
    issues: string[]; 
    recommendations: string[] 
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      const markdownRels = await this.relationshipOps.parseRelatedSection();
      const frontmatterRels = await this.relationshipOps.parseFrontmatterRelationships();

      // Check if counts match
      if (markdownRels.length !== frontmatterRels.length) {
        issues.push(`Relationship count mismatch: ${markdownRels.length} in markdown, ${frontmatterRels.length} in frontmatter`);
        recommendations.push('Run full sync to resolve count discrepancies');
      }

      // Check for unresolved relationships
      for (const rel of markdownRels) {
        const resolvedContact = await this.relationshipOps.resolveContact(rel.contactName);
        if (!resolvedContact) {
          issues.push(`Unresolved contact in markdown: ${rel.contactName}`);
          recommendations.push(`Check if contact file exists for: ${rel.contactName}`);
        }
      }

      // Check for orphaned frontmatter entries
      for (const fmRel of frontmatterRels) {
        if (fmRel.parsedValue?.type === 'uid' || fmRel.parsedValue?.type === 'uuid') {
          const resolvedContact = await this.findContactByUid(fmRel.parsedValue.value);
          if (!resolvedContact) {
            issues.push(`Orphaned UID in frontmatter: ${fmRel.parsedValue.value}`);
            recommendations.push(`Remove or update orphaned relationship: ${fmRel.key}`);
          }
        }
      }

      return {
        isConsistent: issues.length === 0,
        issues,
        recommendations
      };
    } catch (error: any) {
      issues.push(`Validation failed: ${error.message}`);
      return {
        isConsistent: false,
        issues,
        recommendations: ['Fix validation errors before checking consistency']
      };
    }
  }
}