# Relationship Management Feature - Example Usage

This example demonstrates the relationship management system for vCard 4.0 contacts in Obsidian.

## Contact File Example: `Alice Smith.md`

```markdown
---
UID: alice-12345-uuid
FN: Alice Smith
N.GN: Alice
N.FN: Smith
GENDER: F
RELATED[spouse]: urn:uuid:bob-67890-uuid
RELATED[child]: urn:uuid:charlie-11111-uuid
RELATED[1:child]: urn:uuid:diana-22222-uuid
RELATED[parent]: urn:uuid:mom-33333-uuid
REV: 20241215T141630Z
VERSION: "4.0"
---

# Alice Smith

Alice is a software engineer and mother of two.

## Related
- husband [[Bob Johnson]]
- daughter [[Charlie Smith]]
- son [[Diana Smith]]
- mother [[Dorothy Smith]]

## Notes
- Works at Tech Company Inc.
- Enjoys hiking and photography
```

## How the System Works

### 1. **Bidirectional Sync**
- When you edit the "## Related" section in markdown, the system automatically updates the RELATED fields in the front matter
- Changes to the front matter also update the Related section
- All changes maintain a consistent relationship graph

### 2. **Gender-Aware Relationships**
- You can use gendered terms like "husband", "daughter", "mother" in the Related list
- These are automatically converted to genderless forms ("spouse", "child", "parent") for storage
- The system displays the appropriate gendered form based on each contact's GENDER field
- If you specify "mother [[Dorothy]]", the system infers Dorothy's gender as 'F' and updates her GENDER field

### 3. **Automatic Reciprocal Relationships**
- When Alice lists Bob as "husband", the system automatically adds Alice as "wife" to Bob's relationships
- Parent-child, sibling, and other family relationships work bidirectionally
- The system prevents inconsistent relationship states

### 4. **Front Matter Storage Format**
- Single relationships: `RELATED[friend]: urn:uuid:contact-uid`
- Multiple relationships of same type: `RELATED[parent]`, `RELATED[1:parent]`, `RELATED[2:parent]`
- Uses UUID format when possible: `urn:uuid:12345-uuid`
- Falls back to UID format: `uid:contact-uid`
- Name format for missing contacts: `name:Full Name`

### 5. **REV Field Management**
- The REV field is automatically updated whenever relationships change
- Follows vCard 4.0 timestamp format: `20241215T141630Z`
- Only updates when meaningful changes occur (not just reordering)

## Available Commands

The plugin adds these Obsidian commands:

1. **"Sync relationships for current contact"** - Manually sync the current contact file
2. **"Rebuild relationship graph"** - Rebuild the entire relationship graph from all contacts
3. **"Check relationship consistency"** - Check for inconsistencies in the relationship data
4. **"Fix relationship consistency issues"** - Automatically fix detected inconsistencies

## Automatic Features

- **File Watching**: Automatically detects changes to contact files and syncs relationships
- **Name Updates**: When you rename a contact file, all references to that contact are updated
- **Contact Creation**: Missing contacts are automatically created when referenced in relationships
- **Graph Consistency**: The system maintains a consistent relationship graph and prevents orphaned references

## Supported Relationship Types

### Genderless Forms (used internally)
- parent, child, sibling, spouse
- grandparent, grandchild, auncle, nibling
- cousin, friend, colleague, relative, partner

### Gendered Forms (for display/input)
- mother/father, son/daughter, brother/sister
- grandmother/grandfather, grandson/granddaughter
- aunt/uncle, nephew/niece
- wife/husband, boyfriend/girlfriend

The system automatically converts between gendered and genderless forms as needed.

## Example Family Network

```
Dorothy Smith (F)
└─ mother of → Alice Smith (F)
                └─ spouse of → Bob Johnson (M)
                └─ mother of → Charlie Smith (F)
                └─ mother of → Diana Smith (M)

Bob Johnson (M)
└─ spouse of → Alice Smith (F)
└─ father of → Charlie Smith (F)
└─ father of → Diana Smith (M)

Charlie Smith (F)
└─ daughter of → Alice Smith (F)
└─ daughter of → Bob Johnson (M)
└─ sister of → Diana Smith (M)

Diana Smith (M)
└─ son of → Alice Smith (F)
└─ son of → Bob Johnson (M)
└─ brother of → Charlie Smith (F)
```

Each relationship is stored bidirectionally in the graph and synchronized across all involved contact files.