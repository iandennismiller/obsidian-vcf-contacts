/**
 * FieldGrouper - Utility for grouping and sorting vCard fields
 * 
 * This class handles the organization of vCard record fields into logical groups
 * and ensures proper ordering for frontmatter serialization.
 */

import { FIELD_GROUPS } from '../../markdownConstants';

/**
 * Groups of vCard fields for frontmatter organization
 */
export interface FieldGroups {
  /** Name fields (N, FN) */
  name: Record<string, any>;
  /** Priority fields (EMAIL, TEL, BDAY, etc.) */
  priority: Record<string, any>;
  /** Address fields (ADR) */
  address: Record<string, any>;
  /** Other fields */
  other: Record<string, any>;
}

/**
 * FieldGrouper - Groups and sorts vCard fields for optimal frontmatter organization
 * 
 * This utility class provides static methods for categorizing and ordering
 * vCard record fields according to their semantic importance and display priority.
 */
export class FieldGrouper {
  /**
   * Group vCard fields into semantic categories
   * 
   * Organizes fields into name, priority, address, and other groups
   * based on the field type prefix.
   * 
   * @param record - vCard record with field key-value pairs
   * @returns Grouped fields organized by category
   * 
   * @example
   * ```typescript
   * const record = {
   *   'N.FN': 'Doe',
   *   'N.GN': 'John',
   *   'EMAIL.WORK': 'john@example.com',
   *   'ADR[HOME].STREET': '123 Main St'
   * };
   * 
   * const groups = FieldGrouper.groupVCardFields(record);
   * // groups.name = { 'N.FN': 'Doe', 'N.GN': 'John' }
   * // groups.priority = { 'EMAIL.WORK': 'john@example.com' }
   * // groups.address = { 'ADR[HOME].STREET': '123 Main St' }
   * ```
   */
  static groupVCardFields(record: Record<string, any>): FieldGroups {
    const nameKeys = FIELD_GROUPS.NAME as readonly string[];
    const priorityKeys = FIELD_GROUPS.PRIORITY as readonly string[];
    const addressKeys = FIELD_GROUPS.ADDRESS as readonly string[];

    const groups: FieldGroups = {
      name: {},
      priority: {},
      address: {},
      other: {}
    };

    // Group fields by category based on field type prefix
    for (const [key, value] of Object.entries(record)) {
      const baseKey = key.split('[')[0]; // Extract base key (e.g., "EMAIL" from "EMAIL[WORK]")
      
      if (nameKeys.includes(baseKey)) {
        groups.name[key] = value;
      } else if (priorityKeys.includes(baseKey)) {
        groups.priority[key] = value;
      } else if (addressKeys.includes(baseKey)) {
        groups.address[key] = value;
      } else {
        groups.other[key] = value;
      }
    }

    return groups;
  }

  /**
   * Sort name fields in logical display order
   * 
   * Ensures name components appear in a natural order:
   * PREFIX, Given Name, Middle Name, Family Name, SUFFIX, then Full Name
   * 
   * @param nameItems - Name field key-value pairs
   * @returns Sorted name fields
   * 
   * @example
   * ```typescript
   * const items = { 'FN': 'John Doe', 'N.GN': 'John', 'N.FN': 'Doe' };
   * const sorted = FieldGrouper.sortNameItems(items);
   * // Returns: { 'N.GN': 'John', 'N.FN': 'Doe', 'FN': 'John Doe' }
   * ```
   */
  static sortNameItems(nameItems: Record<string, any>): Record<string, any> {
    const nameOrder = ["N.PREFIX", "N.GN", "N.MN", "N.FN", "N.SUFFIX", "FN"];
    const sortedNameItems: Record<string, any> = {};

    // Add ordered fields first
    nameOrder
      .filter(key => nameItems[key] !== undefined)
      .forEach(key => {
        sortedNameItems[key] = nameItems[key];
      });

    // Add remaining fields that aren't in the standard order
    Object.keys(nameItems)
      .filter(key => !nameOrder.includes(key))
      .forEach(key => {
        sortedNameItems[key] = nameItems[key];
      });

    return sortedNameItems;
  }

  /**
   * Sort priority fields in logical display order
   * 
   * Organizes important contact fields (EMAIL, TEL, etc.) in a
   * consistent order for better readability.
   * 
   * @param priorityItems - Priority field key-value pairs
   * @returns Sorted priority fields
   * 
   * @example
   * ```typescript
   * const items = { 'URL': 'example.com', 'EMAIL.WORK': 'a@b.com', 'TEL.CELL': '555-1234' };
   * const sorted = FieldGrouper.sortedPriorityItems(items);
   * // Returns fields ordered: EMAIL, TEL, URL
   * ```
   */
  static sortedPriorityItems(priorityItems: Record<string, any>): Record<string, any> {
    const priorityOrder = [
      "EMAIL", "TEL", "BDAY", "URL", "ORG", "TITLE", "ROLE", 
      "PHOTO", "RELATED", "GENDER"
    ];
    const sortedPriorityItems: Record<string, any> = {};

    // Sort priority fields by base key according to priorityOrder
    priorityOrder.forEach(baseKey => {
      Object.keys(priorityItems).forEach(key => {
        if (key.startsWith(baseKey)) {
          sortedPriorityItems[key] = priorityItems[key];
        }
      });
    });

    return sortedPriorityItems;
  }
}
