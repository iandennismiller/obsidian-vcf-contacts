/**
 * Sync operations optimized for data locality with ContactData
 */

import { ContactData } from './contactData';
import { RelationshipOperations, ParsedRelationship, FrontmatterRelationship } from './relationshipOperations';

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
   * Sync Related list from markdown to frontmatter
   * Groups sync logic with data access for better cache locality
   */
  async syncRelatedListToFrontmatter(): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    try {
      const relationships = await this.relationshipOps.parseRelatedSection();
      const frontmatterUpdates: Record<string, string> = {};
      let relatedIndex = 0;

      // First, clear existing RELATED fields from frontmatter
      const frontmatter = await this.contactData.getFrontmatter();
      if (frontmatter) {
        Object.keys(frontmatter).forEach(key => {
          if (key.startsWith('RELATED')) {
            frontmatterUpdates[key] = ''; // Mark for deletion
          }
        });
      }

      // Process each relationship
      for (const relationship of relationships) {
        try {
          const resolvedContact = await this.relationshipOps.resolveContact(relationship.contactName);
          
          if (resolvedContact) {
            const relatedValue = this.relationshipOps.formatRelatedValue(
              resolvedContact.uid, 
              resolvedContact.name
            );
            
            // Use indexed RELATED fields for multiple relationships of the same type
            const key = relatedIndex === 0 
              ? `RELATED[${relationship.type}]`
              : `RELATED[${relatedIndex}:${relationship.type}]`;
              
            frontmatterUpdates[key] = relatedValue;
            relatedIndex++;
          } else {
            // Keep unresolved relationships as name references
            const key = relatedIndex === 0 
              ? `RELATED[${relationship.type}]`
              : `RELATED[${relatedIndex}:${relationship.type}]`;
              
            frontmatterUpdates[key] = `name:${relationship.contactName}`;
            relatedIndex++;
            
            errors.push(`Could not resolve contact: ${relationship.contactName}`);
          }
        } catch (error) {
          errors.push(`Error processing relationship ${relationship.contactName}: ${error.message}`);
        }
      }

      // Apply all frontmatter updates in one operation
      if (Object.keys(frontmatterUpdates).length > 0) {
        // Remove empty/deleted fields
        const filteredUpdates: Record<string, string> = {};
        Object.entries(frontmatterUpdates).forEach(([key, value]) => {
          if (value !== '') {
            filteredUpdates[key] = value;
          }
        });
        
        await this.contactData.updateMultipleFrontmatterValues(filteredUpdates);
      }

      return { success: true, errors };
    } catch (error) {
      errors.push(`Sync operation failed: ${error.message}`);
      return { success: false, errors };
    }
  }

  /**
   * Sync relationships from frontmatter to markdown
   * Co-locates frontmatter access with sync logic
   */
  async syncFrontmatterToRelatedList(): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    try {
      const frontmatterRelationships = await this.relationshipOps.parseFrontmatterRelationships();
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
        } catch (error) {
          errors.push(`Error processing frontmatter relationship ${fmRel.key}: ${error.message}`);
        }
      }

      // Update the Related section in markdown
      await this.relationshipOps.updateRelatedSectionInContent(markdownRelationships);

      return { success: true, errors };
    } catch (error) {
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
    } catch (error) {
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
          return {
            name: file.basename,
            file: file
          };
        }
      } catch (error) {
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
    } catch (error) {
      issues.push(`Validation failed: ${error.message}`);
      return {
        isConsistent: false,
        issues,
        recommendations: ['Fix validation errors before checking consistency']
      };
    }
  }
}