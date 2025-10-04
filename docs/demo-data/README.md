# Demo Data - Relationship Examples

This directory contains example contacts demonstrating the relationship management features of the Obsidian VCF Contacts plugin.

## Relationship Examples

The following contacts form a connected social network demonstrating various relationship types:

### The Johnson Family

**Sarah Johnson** (Mother)
- Spouse: Michael Johnson
- Children: Emma Johnson, Noah Johnson
- UID: `urn:uuid:a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d`

**Michael Johnson** (Father)
- Spouse: Sarah Johnson
- Children: Emma Johnson, Noah Johnson
- Sibling: Jennifer Martinez
- UID: `urn:uuid:b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e`

**Emma Johnson** (Daughter)
- Parents: Sarah Johnson, Michael Johnson
- Sibling: Noah Johnson
- Friends: Olivia Smith, Alex Chen (not yet in system)
- UID: `urn:uuid:c3d4e5f6-a7b8-4c5d-0e1f-2a3b4c5d6e7f`

**Noah Johnson** (Son)
- Parents: Sarah Johnson, Michael Johnson
- Sibling: Emma Johnson
- Aunt: Jennifer Martinez
- UID: `urn:uuid:d4e5f6a7-b8c9-4d5e-1f2a-3b4c5d6e7f8a`

### Extended Family & Friends

**Jennifer Martinez** (Aunt)
- Brother: Michael Johnson
- Niece: Emma Johnson
- Nephew: Noah Johnson
- Colleague: Olivia Smith
- UID: `urn:uuid:e5f6a7b8-c9d0-4e5f-2a3b-4c5d6e7f8a9b`

**Olivia Smith** (Friend/Colleague)
- Friend: Emma Johnson
- Colleague: Jennifer Martinez
- UID: `urn:uuid:f6a7b8c9-d0e1-4f5a-3b4c-5d6e7f8a9b0c`

## Key Features Demonstrated

### 1. RELATED Field Format in Front Matter

The front matter shows proper formatting for relationships using dot notation:

```yaml
RELATED.spouse: urn:uuid:b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e
RELATED.child.0: urn:uuid:c3d4e5f6-a7b8-4c5d-0e1f-2a3b4c5d6e7f
RELATED.child.1: urn:uuid:d4e5f6a7-b8c9-4d5e-1f2a-3b4c5d6e7f8a
```

### 2. Multiple Relationships of Same Type

When a contact has multiple relationships of the same kind (e.g., multiple children), the flat library automatically indexes them:
- First: `RELATED.child.0`
- Second: `RELATED.child.1`
- Third: `RELATED.child.2`

### 3. Three Namespace Formats

**`urn:uuid:`** (Preferred - Used for valid UUIDs)
```yaml
RELATED.spouse: urn:uuid:b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e
```

**`uid:`** (For non-UUID unique identifiers)
```yaml
RELATED.colleague: uid:olivia-smith-work-id
```

**`name:`** (For contacts not yet in the system)
```yaml
RELATED.friend: name:Alex Chen
```

### 4. Gender-Aware Rendering

The markdown Related list shows gender-specific terms based on the GENDER field:

For Noah (GENDER: M) with Sarah (GENDER: F):
- Front matter stores: `RELATED[parent]`
- Related list renders as: `- mother [[Sarah Johnson]]`

For Emma (GENDER: F) with Jennifer (GENDER: F):
- Front matter stores: `RELATED[aunt-uncle]`
- Related list renders as: `- aunt [[Jennifer Martinez]]` (because Jennifer's GENDER is F)

### 5. Bidirectional Relationships

All relationships are reciprocal:
- Sarah has Michael as spouse → Michael has Sarah as spouse
- Emma has Sarah as parent → Sarah has Emma as child
- Jennifer has Michael as sibling → Michael has Jennifer as sibling

### 6. Genderless Storage

Internally, relationships are stored in genderless form:
- `parent` (not mother/father)
- `child` (not son/daughter)
- `sibling` (not brother/sister)
- `aunt-uncle` (not aunt/uncle)
- `niece-nephew` (not niece/nephew)

Gender is only applied when rendering the Related list based on the contact's GENDER field.

## Files

### Markdown Files (`docs/demo-data/markdown/`)
- `Sarah Johnson.md` - Mother, demonstrates spouse and child relationships
- `Michael Johnson.md` - Father, demonstrates spouse, child, and sibling relationships
- `Emma Johnson.md` - Daughter, demonstrates parent, sibling, and friend relationships
- `Noah Johnson.md` - Son, demonstrates parent, sibling, and aunt relationships
- `Jennifer Martinez.md` - Aunt, demonstrates sibling, niece/nephew, and colleague relationships
- `Olivia Smith.md` - Friend/Colleague, demonstrates friend and colleague relationships

### VCF File (`docs/demo-data/vcf/`)
- `relationships.vcf` - Contains all six contacts with RELATED fields in vCard 4.0 format

## Usage

These examples can be used to:
1. Understand how RELATED fields map between front matter and markdown
2. Test the relationship synchronization features
3. Learn the correct format for different relationship types
4. See how gender-aware rendering works
5. Understand the three namespace formats (urn:uuid:, uid:, name:)

## Notes

- All UIDs are in valid UUID format with `urn:uuid:` prefix (except the colleague relationships which demonstrate the `uid:` format)
- REV timestamps are set to `20250101T120000Z` for consistency
- The relationship graph is complete and bidirectional
- Emma's friend "Alex Chen" demonstrates a forward reference using `name:` namespace (contact doesn't exist yet)
