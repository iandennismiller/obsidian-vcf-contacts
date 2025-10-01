# Relationship Management Specification

## Overview

This document provides a comprehensive specification for relationship management in the Obsidian VCF Contacts plugin, based on vCard 4.0 standard.

## Core Concepts

### Obsidian Integration

- **Vault**: Obsidian maintains a "vault" of markdown documents
- **Plugin API**: Robust plugin subsystem with API access to vault files
- **YAML Front Matter**: Markdown files include YAML front matter that Obsidian can leverage
- **Event Hooks**: Many event hooks available for plugins to attach to

### vCard Integration

- The plugin extends rudimentary vCard import/export to Obsidian markdown
- vCard fields map onto YAML front matter during import
- After import, Obsidian note has all info the vCard originally had
- We treat these as Obsidian Contact Notes, contacts, notes, or markdown files

## The Related Section

### Purpose

Enable users to store their own social network locally by projecting a social graph onto vCard files through carefully curated RELATED fields.

### User Experience

The primary user interface for curating relationships is the contact note itself:

#### The Related Heading

- The plugin adds "## Related" to each contact note
- There should be exactly one such heading per contact
- If a contact doesn't have a Related list when opened, then add it when needed
- If multiple Related headings exist but one has nothing under it and the other has a list, remove the empty one
- Do not add a Related heading if it already exists
- The heading is **case insensitive**: "## related" is equivalent to "## Related"
- The heading **depth is not relevant**: works on "### related" or "#### RELATED" too
- The plugin should fix capitalization if the user entered it incorrectly
- The plugin should clean up extra newlines beneath the Related heading, both before and after the list
- The plugin should not touch any other heading or anything else in the note
- Add both "## Related" heading and the list when a relationship change is being propagated to a contact

#### Relationship List Format

- A list under the Related heading maps onto RELATED items in front matter
- A relationship is a triple: (subject, relationship_kind, object)
- On a contact note, the subject is always the current contact; therefore relationships can be specified as tuples: (kind, object)
- In markdown, this renders as a list item: `- relationship_kind [[Contact Name]]`
- The object, appearing in double-square brackets, is an Obsidian-flavored markdown link (wiki-link)
- If the object's note exists as a contact, then the UID in its front matter serves as the identifier in front matter and the graph
- In the Related list, it always renders as the human-readable contact name (the name of the contact note in Obsidian)

#### User Editing

- The user manages relationships by adding items to the list: `- relationship_kind [[Contact Name]]`
- The plugin handles syncing the user's edits with the graph
- The plugin ensures contacts' front matter and Related list match what's in the graph

#### Gender Inference

If the user specifies a gendered relationship type:
- Attempt to infer the gender to update the other contact with that info
- Then set the relationship type according to the genderless kind
- Detect mom/mother/etc and update other contact's GENDER in front matter; relation kind is "parent"
- Similarly, dad/father/etc implies GENDER of other contact; update its front matter
- Also: sister, brother, son, daughter, aunt, uncle, niece, nephew, etc.
- Like any other change to front matter, this updates the REV field as well

## The RELATED Field in vCard and Front Matter

### Field Format

The value of RELATED fields in front matter conforms to this format:
```
RELATED;TYPE=friend:urn:uuid:03a0e51f-d1aa-4385-8a53-e29025acd8af
```

### Namespace Formats

Three namespace formats are used for unambiguously referring to another contact:

1. **`urn:uuid:`** - Preferred namespace when the UID for a contact is a valid UUID
   - Format: `urn:uuid:03a0e51f-d1aa-4385-8a53-e29025acd8af`
   - Use whenever the UID is a valid UUID

2. **`name:`** - Used when the other contact note does not exist in Obsidian yet
   - Format: `name:First Last`
   - Allows forward references to contacts not yet created

3. **`uid:`** - Used when the vCard has a UID that is not blank, is unique, but is not a valid UUID
   - Format: `uid:custom-identifier-123`
   - For non-UUID unique identifiers

To find the UID for a contact, inspect its front matter in the contact note in Obsidian.

### Multiple Relationships of Same Type

Obsidian front matter is YAML-like but strictly key-value (not hierarchical). Arrays use specific notation:
- Within a contact, relationships of the same kind imply a set
- Although implemented as an array, index is not meaningful
- When there is one friend (array size is 1), the front matter key is `RELATED[friend]`
- The next friendship is added with the key `RELATED[1:friend]`
- A 3-element set would include `RELATED[2:friend]` ... and so on

### Deterministic Ordering

When a set of relationships is mapped onto front matter:
1. First sort by key
2. Then sort by value
3. The goal is to create a deterministic ordering for serialization

This prevents unnecessary changes when relationships (which have no inherent order) are refreshed.

## Gender Support

### The GENDER Field

vCard 4.0 specifies a separate GENDER field which we must parse and add to front matter:

```yaml
GENDER: M    # Male
GENDER: F    # Female
GENDER: NB   # Non-binary
GENDER: U    # Unspecified
```

### Gender-Aware Rendering

- When GENDER is NB, U, blank, or not present, render the relationship kind with a genderless term
- `aunt-uncle` is internally "aunt-uncle" but renders as "aunt" or "uncle" if the contact specifies gender
- If a parent contact has GENDER value of M, render as "father" in the user interface
- If a parent contact has GENDER value of F, render as "mother" in the user interface

### Storage vs. Display

- Use genderless relationship kind in front matter, graph, and vCard
- It's only when rendering or parsing the Related list that gender should be encoded/decoded
- Examples of genderless forms:
  - `parent` (not mother/father)
  - `child` (not son/daughter)
  - `sibling` (not brother/sister)
  - `aunt-uncle` (not aunt/uncle)
  - `niece-nephew` (not niece/nephew)

## Bidirectional Relationship Synchronization

### Propagation Rules

- When one relationship edge is created or changed, this affects two contacts: the subject and the object
- Both contacts must be updated
- Before changing front matter of any contact, verify whether anything would change
- If nothing would change, do not change anything (to avoid unnecessary REV updates)

### Manual Synchronization

Create an Obsidian command to manually trigger this synchronization across all contacts.

## The REV Field

### Purpose

REV is a timestamp field in the vCard that indicates when information most recently changed.

### Format

- Format: `20250925T141344Z`
- Pattern: `YYYYMMDDTHHMMSSZ`
- Example: September 25, 2025 at 14:13:44 UTC

### Update Rules

- Any time we change the front matter of a contact, we must update the REV field
- Be sure REV does not update unless the front matter actually changed
- This prevents unnecessary updates and ensures efficient synchronization

## Bidirectional Mapping

The plugin must establish a bidirectional mapping:
- From RELATED front matter items onto the markdown Related list
- From the markdown Related list onto RELATED front matter items

The feature must not touch any other headings or other parts of the document—just the list under the Related heading.

## Validation and Consistency

### Pre-Change Validation

Before changing front matter:
1. Check if anything would actually change
2. If no changes needed, do not modify the file
3. This prevents unnecessary REV updates

### Relationship Consistency

Ensure that:
- All relationships are reciprocal
- UIDs are correctly resolved
- Names are kept up-to-date
- Front matter and Related list stay synchronized

### Error Handling

The plugin should handle:
- Missing contacts gracefully (using `name:` namespace)
- UID conflicts
- Malformed relationship data
- Missing or invalid GENDER values

## Summary

This specification defines how the plugin:
1. Projects a social graph onto vCard files via RELATED fields
2. Provides an intuitive markdown-based user interface via the Related section
3. Maintains bidirectional synchronization between markdown and front matter
4. Handles gender-aware relationship rendering
5. Ensures data consistency and efficient updates through deterministic ordering and REV management
