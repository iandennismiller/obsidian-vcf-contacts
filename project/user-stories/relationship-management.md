# Relationship Management User Stories

Stories related to creating, managing, and synchronizing contact relationships.

## 6. Bidirectional Relationship Sync

**As a user**, when I edit the relationships listed under the "## Related" section on a contact note, I expect the plugin to update this contact's frontmatter and other related contacts' frontmatter and Related lists to reflect the new relationship. The relationship list is a markdown list where each item follows the format `- relationship_kind [[Contact Name]]`, using Obsidian's wiki-link syntax to reference other contacts.

**Test Location**: `tests/stories/bidirectionalRelationshipSync.spec.ts`

## 7. Automatic Reverse Relationships

**As a user**, when I add "- father [[John Doe]]" to Jane's contact, I want John's contact to automatically get "- daughter [[Jane Doe]]" (or "- child [[Jane Doe]]" if gender is not specified) in his relationships. The plugin handles bidirectional synchronization, ensuring both contacts are updated.

**Test Location**: `tests/stories/automaticReverseRelationships.spec.ts`

## 8. Complex Family Relationships

**As a user**, I want to manage complex family relationships like "mother-in-law", "step-father", "adopted-daughter" and have the plugin understand and maintain these relationships bidirectionally.

**Test Location**: `tests/stories/complexFamilyRelationships.spec.ts`

## 9. Professional Relationships

**As a user**, I want to track professional relationships like "colleague", "boss", "employee", "client", "vendor" and have them properly categorized and synced.

**Test Location**: `tests/stories/professionalRelationships.spec.ts`

## 10. Social Relationships

**As a user**, I want to manage social relationships like "friend", "neighbor", "classmate", "teammate" and maintain them across my contact network.

**Test Location**: `tests/stories/socialRelationships.spec.ts`

## 11. Incremental Relationship Management

**As a user**, I want to add relationships (one at a time) to a contact over the course of several plugin load/unload cycles, with the expectation that relationships in the front matter and vcards will be curated and consistent.

**Test Location**: `tests/stories/incrementalRelationshipManagement.spec.ts`

## 11a. Relationship De-duplication

**As a user**, when I have duplicate relationships in my Related list (including cases where the same relationship appears with both gendered and ungendered terms like "mother" and "parent"), I want the plugin to automatically de-duplicate them. When a relationship appears twice - once with a gendered term (like "mother", "father", "sister", "brother") and once with an ungendered term (like "parent", "sibling") - the plugin should keep only the gendered version and infer the contact's gender from it. The plugin should also remove exact duplicate relationships where the same relationship type and contact appear multiple times. This ensures my Related list and frontmatter stay clean and consistent without manual intervention.

**Test Location**: `tests/stories/relationshipDeduplication.spec.ts`

## 11b. Relationship Sync Preservation

**As a user**, when I manually invoke contact processing and a relationship exists in the Related list but is missing from frontmatter, I expect the plugin to add the missing relationship to frontmatter, not delete it from the Related list. Similarly, when a relationship exists in frontmatter but is missing from the Related list, the plugin should add it to the Related list, not delete it from frontmatter. The sync operations should always be additive (merging), never destructive (replacing), ensuring that relationships are preserved across both representations.

**Test Location**: `tests/stories/relationshipSyncPreservation.spec.ts`

---

**Related Specifications**: 
- [Relationship Management Specification](../specifications/relationship-management-spec.md)
- [Gender Processing Specification](../specifications/gender-processing-spec.md)
