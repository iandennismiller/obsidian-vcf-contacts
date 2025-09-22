# vCard 4.0 Relationship Management

This document describes the new relationship management features that have been added to the VCF Contacts plugin for Obsidian.

## Overview

The plugin now supports vCard 4.0 RELATED fields to represent connections between contacts. This enables you to:

- Define relationships between contacts using vCard 4.0 standard RELATED fields
- Automatically sync bidirectional relationships (when you add John as Jane's friend, Jane is automatically added as John's friend)
- View and edit relationships through a human-readable markdown interface
- Maintain consistency between the contact frontmatter and the relationships section in notes

## Supported Relationship Types

The plugin supports a comprehensive set of relationship types with intelligent complement mapping:

### Family Relationships
- **parent** ↔ **child**
- **spouse** ↔ **spouse** (symmetric)
- **partner** ↔ **partner** (symmetric)
- **sibling** ↔ **sibling** (symmetric)
- **grandparent** ↔ **grandchild**
- **aunt/uncle** ↔ **niece/nephew**
- **cousin** ↔ **cousin** (symmetric)

### Social Relationships
- **friend** ↔ **friend** (symmetric)
- **colleague** ↔ **colleague** (symmetric)
- **acquaintance** ↔ **acquaintance** (symmetric)

### Professional Relationships
- **manager** ↔ **subordinate**
- **mentor** ↔ **mentee**

### Generic
- **related** ↔ **related** (symmetric)
- **contact** ↔ **contact** (symmetric)

## How Relationships Work

### In vCard Format
Relationships are stored in the contact's frontmatter as RELATED fields:

```yaml
---
FN: John Smith
N.GN: John
N.FN: Smith
UID: urn:uuid:john-smith-12345
RELATED[spouse]: urn:uuid:jane-smith-67890
RELATED[child]: urn:uuid:tommy-smith-11111
RELATED[1:child]: urn:uuid:sally-smith-22222
RELATED[friend]: urn:uuid:mike-johnson-44444
---
```

### In Markdown Format
Relationships are displayed in a dedicated "Relationships" section in the contact note:

```markdown
## Relationships

- [[Jane Smith]] is a spouse of John Smith
- [[Tommy Smith]] is a child of John Smith  
- [[Sally Smith]] is a child of John Smith
- [[Mike Johnson]] is a friend of John Smith
```

## Using Relationships

### Viewing Relationships
Relationships are automatically rendered in the contact notes under a "Relationships" heading. The plugin will:

1. Read RELATED fields from the contact's frontmatter
2. Resolve UIDs to contact names
3. Render human-readable relationship descriptions with Obsidian links

### Adding Relationships
You can add relationships in two ways:

#### 1. Edit the Frontmatter Directly
Add RELATED fields to the contact's frontmatter:

```yaml
RELATED[friend]: urn:uuid:target-contact-uid
```

#### 2. Edit the Markdown Relationships Section
Edit the relationships list in the markdown:

```markdown
## Relationships

- [[New Friend Name]] is a friend of Current Contact
- [[Boss Name]] is a manager of Current Contact
```

### Automatic Bidirectional Sync
When you add a relationship, the plugin automatically:

1. **Updates the target contact** - If you add "Jane is John's spouse", Jane's contact will automatically get "John is Jane's spouse"
2. **Uses appropriate complement types** - Adding "Bob is Alice's parent" automatically adds "Alice is Bob's child"
3. **Maintains consistency** - Changes in one contact are reflected in the related contact

### Commands
The plugin provides these commands:

- **Update All Contact Relationships** - Manually refresh the relationships section for all contacts

## Technical Details

### UID Management
- Every contact automatically gets a unique UID (Universally Unique Identifier)
- UIDs are in the format `urn:uuid:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- UIDs are used internally to link contacts, ensuring links work even if contact names change

### Relationship Storage
- Relationships are stored as vCard 4.0 RELATED fields in the frontmatter
- Field format: `RELATED[type]: urn:uuid:target-uid`
- Multiple relationships of the same type get indexed: `RELATED[1:friend]`, `RELATED[2:friend]`

### Conflict Resolution
- The plugin intelligently handles relationship type conflicts
- Uses gender-neutral terms (spouse instead of husband/wife)
- Gracefully handles unknown relationship types by defaulting to "related"

## Example Contact Network

Here's an example of how a family might be represented:

**John Smith (Father)**
```markdown
## Relationships

- [[Jane Smith]] is a spouse of John Smith
- [[Tommy Smith]] is a child of John Smith
- [[Sally Smith]] is a child of John Smith
```

**Jane Smith (Mother)**  
```markdown
## Relationships

- [[John Smith]] is a spouse of Jane Smith
- [[Tommy Smith]] is a child of Jane Smith
- [[Sally Smith]] is a child of Jane Smith
```

**Tommy Smith (Son)**
```markdown
## Relationships

- [[John Smith]] is a parent of Tommy Smith
- [[Jane Smith]] is a parent of Tommy Smith
- [[Sally Smith]] is a sibling of Tommy Smith
```

All these relationships are automatically maintained - change one, and the others update accordingly!

## Migration and Compatibility

- Existing contacts without relationships continue to work normally
- Adding the first relationship to a contact automatically creates the Relationships section
- The feature is fully compatible with vCard 4.0 standard
- Export/import maintains all relationship data

## Troubleshooting

If relationships aren't showing up correctly:

1. **Check UIDs** - Ensure all contacts have unique UIDs in their frontmatter
2. **Run Update Command** - Use "Update All Contact Relationships" command to refresh
3. **Verify Format** - Check that RELATED fields follow the correct format
4. **Check Names** - Ensure contact names in markdown match actual contact file names

The relationship management system provides a powerful way to represent and navigate your contact network while maintaining data integrity and vCard 4.0 compliance.