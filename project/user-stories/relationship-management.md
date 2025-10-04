# Relationship Management User Stories

Stories related to creating, managing, and synchronizing contact relationships.

## 6. Bidirectional Relationship Sync

**As a user**, when I edit the relationships in my contact notes, I expect the changes to propagate to related contacts so that my contact network stays consistent.

**Test Location**: `tests/stories/bidirectionalRelationshipSync.spec.ts`

**Related Specifications**: [Relationship Management Specification](../specifications/relationship-management.md)

## 7. Automatic Reverse Relationships

**As a user**, when I add a relationship to one contact, I want the reverse relationship to automatically appear on the related contact so that my contact network is bidirectionally consistent without manual effort.

**Test Location**: `tests/stories/automaticReverseRelationships.spec.ts`

**Related Specifications**: [Relationship Management Specification](../specifications/relationship-management.md)

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

**As a user**, when I have duplicate relationships in my Related list, I want the plugin to automatically clean them up so that my contact data stays organized without manual intervention.

**Test Location**: `tests/stories/relationshipDeduplication.spec.ts`

**Related Specifications**: [Relationship Management Specification](../specifications/relationship-management.md)

## 11b. Relationship Sync Preservation

**As a user**, when the plugin syncs relationships, I expect it to preserve existing relationships in both frontmatter and the Related list rather than delete them, so that I don't lose data during synchronization.

**Test Location**: `tests/stories/relationshipSyncPreservation.spec.ts`

**Related Specifications**: [Relationship Management Specification](../specifications/relationship-management.md)

---

**Related Specifications**: 
- [Relationship Management Specification](../specifications/relationship-management.md)
- [Gender Processing Specification](../specifications/gender-processing.md)
