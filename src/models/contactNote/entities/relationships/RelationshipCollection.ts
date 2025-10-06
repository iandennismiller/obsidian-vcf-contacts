/**
 * RelationshipCollection - Collection of relationships with deduplication support
 * 
 * Provides utilities for managing collections of relationships including
 * deduplication logic that prefers gendered terms and infers gender information.
 */

import { Relationship } from './Relationship';
import { RelationshipType } from './RelationshipType';
import type { Gender } from '../../types';

/**
 * Result of relationship deduplication
 */
export interface DeduplicationResult {
  deduplicated: Relationship[];
  inferredGender: Map<string, Gender>;
}

/**
 * RelationshipCollection manages collections of relationships
 */
export class RelationshipCollection {
  /**
   * Deduplicate relationships, preferring gendered terms over ungendered
   * 
   * When duplicate relationships exist (same type and contact, different gender specificity),
   * this method prefers the gendered version and infers gender information.
   * 
   * @param relationships - Array of relationships to deduplicate
   * @param convertToGenderlessType - Function to convert relationship type to genderless form
   * @param inferGenderFromRelationship - Function to infer gender from relationship type
   * @returns Deduplicated relationships and inferred gender map
   */
  static deduplicate(
    relationships: Relationship[],
    convertToGenderlessType: (type: string) => string,
    inferGenderFromRelationship: (type: string) => Gender | null
  ): DeduplicationResult {
    const seen = new Map<string, Relationship>();
    const inferredGender = new Map<string, Gender>();
    
    for (const rel of relationships) {
      const type = rel.getType().toString();
      const contactName = rel.getTarget().getValue();
      
      const genderlessType = convertToGenderlessType(type);
      const contactKey = `${genderlessType}:${contactName.toLowerCase()}`;
      const existing = seen.get(contactKey);
      
      if (!existing) {
        seen.set(contactKey, rel);
        const gender = inferGenderFromRelationship(type);
        if (gender) {
          inferredGender.set(contactName, gender);
        }
        continue;
      }
      
      const existingType = existing.getType().toString();
      const existingGender = inferGenderFromRelationship(existingType);
      const currentGender = inferGenderFromRelationship(type);
      
      if (currentGender && !existingGender) {
        seen.set(contactKey, rel);
        inferredGender.set(contactName, currentGender);
      } else if (currentGender) {
        const existingContactName = existing.getTarget().getValue();
        inferredGender.set(existingContactName, existingGender!);
      }
    }
    
    return {
      deduplicated: Array.from(seen.values()),
      inferredGender
    };
  }

  /**
   * Merge relationships from multiple sources (e.g., markdown and frontmatter)
   * 
   * This method combines relationships from different sources while handling
   * duplicates and maintaining consistency.
   * 
   * @param sources - Array of relationship arrays from different sources
   * @param convertToGenderlessType - Function to convert relationship type to genderless form
   * @param inferGenderFromRelationship - Function to infer gender from relationship type
   * @returns Merged and deduplicated relationships
   */
  static merge(
    sources: Relationship[][],
    convertToGenderlessType: (type: string) => string,
    inferGenderFromRelationship: (type: string) => Gender | null
  ): Relationship[] {
    // Flatten all sources into a single array
    const allRelationships = sources.flat();
    
    // Deduplicate the combined relationships
    const result = RelationshipCollection.deduplicate(
      allRelationships,
      convertToGenderlessType,
      inferGenderFromRelationship
    );
    
    return result.deduplicated;
  }

  /**
   * Group relationships by contact name
   * 
   * @param relationships - Array of relationships to group
   * @returns Map of contact name to relationships
   */
  static groupByContact(relationships: Relationship[]): Map<string, Relationship[]> {
    const groups = new Map<string, Relationship[]>();
    
    for (const rel of relationships) {
      const contactName = rel.getTarget().getValue();
      const existing = groups.get(contactName) || [];
      existing.push(rel);
      groups.set(contactName, existing);
    }
    
    return groups;
  }

  /**
   * Group relationships by type
   * 
   * @param relationships - Array of relationships to group
   * @returns Map of relationship type to relationships
   */
  static groupByType(relationships: Relationship[]): Map<string, Relationship[]> {
    const groups = new Map<string, Relationship[]>();
    
    for (const rel of relationships) {
      const type = rel.getType().toString();
      const existing = groups.get(type) || [];
      existing.push(rel);
      groups.set(type, existing);
    }
    
    return groups;
  }

  /**
   * Filter relationships by contact name
   * 
   * @param relationships - Array of relationships to filter
   * @param contactName - Name of contact to filter by
   * @returns Filtered relationships
   */
  static filterByContact(relationships: Relationship[], contactName: string): Relationship[] {
    const normalizedName = contactName.toLowerCase();
    return relationships.filter(rel => 
      rel.getTarget().getValue().toLowerCase() === normalizedName
    );
  }

  /**
   * Filter relationships by type
   * 
   * @param relationships - Array of relationships to filter
   * @param typeName - Relationship type to filter by
   * @returns Filtered relationships
   */
  static filterByType(relationships: Relationship[], typeName: string): Relationship[] {
    const normalizedType = typeName.toLowerCase();
    return relationships.filter(rel => 
      rel.getType().toString().toLowerCase() === normalizedType
    );
  }
}
