# Relationship Management Specification

## Overview

The Relationship Management feature enables users to store their social network locally by projecting a social graph onto vCard files through the RELATED field. Users manage relationships through a simple markdown interface.

## The Related Section

### Purpose

Enable users to curate relationships between contacts through a markdown list interface.

### Related Heading

- **Format**: `## Related` (case-insensitive, depth-agnostic)
- **Frequency**: Exactly one per contact note
- **Automatic addition**: Added when needed if missing
- **Cleanup**: Removes empty duplicates, fixes capitalization

### Relationship List Format

- A list under the Related heading maps onto RELATED items in front matter
- A relationship is a triple: (subject, relationship_kind, object)
- On a contact note, the subject is always the current contact
- In markdown, this renders as: `- relationship_kind [[Contact Name]]`
- The object appears in Obsidian wiki-link format
- The UID in the linked contact's frontmatter serves as the identifier

### User Editing

- Users manage relationships by adding items to the list: `- relationship_kind [[Contact Name]]`
- The plugin handles syncing edits with the graph
- The plugin ensures frontmatter and Related list match the graph

### Gender Inference

If the user specifies a gendered relationship type:
- Attempt to infer the gender to update the other contact
- Set the relationship type to the genderless kind
- Detect gendered terms (mom/mother, dad/father, sister, brother, etc.)
- Update the other contact's GENDER field in frontmatter
- Update the REV field when GENDER changes

## The RELATED Field

### Field Format

The value of RELATED fields in vcard 4.0 conforms to this format:
```
RELATED;TYPE=friend:urn:uuid:03a0e51f-d1aa-4385-8a53-e29025acd8af
```

This could be represented in flat YAML as:

```yaml
RELATED.friend.0: :urn:uuid:03a0e51f-d1aa-4385-8a53-e29025acd8af
```

### Namespace Formats

Three namespace formats for referring to another contact:

1. **`urn:uuid:`** - Preferred namespace when the UID is a valid UUID
   - Format: `urn:uuid:03a0e51f-d1aa-4385-8a53-e29025acd8af`
   - Use whenever the UID is a valid UUID

2. **`name:`** - Used when the other contact note does not exist yet
   - Format: `name:First Last`
   - Allows forward references to contacts not yet created

3. **`uid:`** - Used when the vCard has a non-UUID unique identifier
   - Format: `uid:custom-identifier-123`
   - For non-UUID unique identifiers

### Multiple Relationships of Same Type

When multiple relationships of the same type exist, they are indexed with numeric suffixes:

```yaml
RELATED.friend.0: urn:uuid:first-friend-uuid
RELATED.friend.1: urn:uuid:second-friend-uuid
RELATED.friend.2: name:Third Friend
```

### Deterministic Ordering

Relationships are ordered deterministically by:
1. Sorting keys alphabetically
2. Using consistent dot notation for nested structures
3. Maintaining stable array indices

This prevents unnecessary changes when relationships are refreshed.

### Library Integration

The RELATED field handling uses the **yaml** and **flat** libraries:

- **yaml**: Parses and generates YAML frontmatter with dot notation keys
- **flat**: Converts between flat keys (`RELATED.friend.0`) and nested objects
- **Dot Notation**: Natively supported by both libraries for hierarchical data
- **Type Safety**: yaml library preserves value types and handles special characters

See [Library Integration Specification](library-integration.md) for details on yaml and flat library usage.

## Gender Support

### The GENDER Field

vCard 4.0 GENDER field values:

```yaml
GENDER: M    # Male
GENDER: F    # Female
GENDER: NB   # Non-binary
GENDER: U    # Unspecified
```

### Gender-Aware Rendering

- When GENDER is NB, U, blank, or not present, render with genderless terms
- When GENDER is M or F, render with gender-specific terms
- Examples:
  - `parent` renders as "father" (M) or "mother" (F)
  - `child` renders as "son" (M) or "daughter" (F)
  - `sibling` renders as "brother" (M) or "sister" (F)

### Storage vs. Display

- Use genderless relationship kind in frontmatter, graph, and vCard
- Apply gender only when rendering or parsing the Related list
- Genderless forms:
  - `parent` (not mother/father)
  - `child` (not son/daughter)
  - `sibling` (not brother/sister)
  - `aunt-uncle` (not aunt/uncle)
  - `niece-nephew` (not niece/nephew)

## Bidirectional Synchronization

### Propagation Rules

- When one relationship edge is created or changed, both contacts must be updated
- Verify whether anything would change before modifying frontmatter
- If nothing would change, do not modify (to avoid unnecessary REV updates)

### Sync Operation Behavior

1. **Additive Syncing**: Merging, not replacing
   - Add missing relationships to frontmatter, preserve existing
   - Add missing relationships to Related list, preserve existing
   - Never delete relationships unless they are duplicates

2. **Preservation**: Relationships preserved in both representations
   - Add to frontmatter if exists in Related list
   - Add to Related list if exists in frontmatter
   - Don't delete from one location just because missing from the other

3. **Deduplication**: Relationships removed only during deduplication
   - Remove exact duplicates (same type and contact)
   - Remove redundant gendered/ungendered pairs (keep gendered version)
   - Update both frontmatter and Related list to reflect deduplicated state

### Manual Synchronization

Users can manually trigger synchronization across all contacts via Obsidian command.

## The REV Field

### Purpose

REV is a timestamp field indicating when information most recently changed.

### Format

- Format: `20250925T141344Z`
- Pattern: `YYYYMMDDTHHMMSSZ`
- Example: September 25, 2025 at 14:13:44 UTC

### Update Rules

- Update REV any time frontmatter changes
- Ensure REV does not update unless frontmatter actually changed
- Prevents unnecessary updates and ensures efficient synchronization

## Bidirectional Mapping

The plugin establishes bidirectional mapping:
- From RELATED frontmatter items onto the markdown Related list
- From the markdown Related list onto RELATED frontmatter items

The feature does not touch any other headings or parts of the document.

## Validation and Consistency

### Pre-Change Validation

Before changing frontmatter:
1. Check if anything would actually change
2. If no changes needed, do not modify the file
3. Prevents unnecessary REV updates

### Relationship Consistency

Ensure that:
- All relationships are reciprocal
- UIDs are correctly resolved
- Names are kept up-to-date
- Frontmatter and Related list stay synchronized

### Error Handling

The plugin handles:
- Missing contacts gracefully (using `name:` namespace)
- UID conflicts
- Malformed relationship data
- Missing or invalid GENDER values
