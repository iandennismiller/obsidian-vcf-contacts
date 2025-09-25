# Relationship Management in Obsidian VCF Contacts

The Obsidian VCF Contacts plugin now supports comprehensive relationship management based on vCard 4.0 specifications. This feature allows you to create and maintain a social network of your contacts directly within Obsidian.

## Features

### Core Functionality
- **Bidirectional Relationships**: Relationships are automatically synced between contacts
- **Gender-Aware Terms**: Use natural terms like "father", "mother", "brother", "sister"
- **vCard 4.0 Compliance**: Full support for the RELATED field specification
- **Graph-Based Storage**: Efficient relationship storage using directed graphs
- **Atomic Operations**: All relationship changes are atomic and consistent

### Supported Relationship Types
- **Family**: parent, child, sibling, spouse, auncle (aunt/uncle), nibling (niece/nephew), grandparent, grandchild, cousin
- **Social**: friend, partner, colleague, relative

### Gender Support
- **Male (M)**: father, son, brother, husband, uncle, nephew, grandfather, grandson
- **Female (F)**: mother, daughter, sister, wife, aunt, niece, grandmother, granddaughter  
- **Non-binary/Unspecified (NB/U)**: Uses neutral terms like parent, child, sibling, spouse, auncle, nibling
- **Automatic Inference**: The system can infer gender from relationship terms when editing

## How to Use

### Adding Relationships

1. **Open any contact file** in your contacts folder
2. **Add a "Related" section** if it doesn't exist:
   ```markdown
   ## Related
   ```
3. **Add relationships** using the format:
   ```markdown
   ## Related
   - friend [[John Doe]]
   - colleague [[Jane Smith]]
   - father [[Bob Johnson]]
   ```

### Relationship Format
- Use standard list format with dashes (`-`)
- Reference contacts using Obsidian's link syntax `[[Contact Name]]`
- Use natural relationship terms (father, mother, friend, colleague, etc.)

### Example Contact with Relationships
```markdown
---
N.FN: Stark
N.GN: Tony
GENDER: M
"RELATED[friend]":
  - urn:uuid:019730a76c14a-4d32-a36e-a0f5dbf86fa3
"RELATED[colleague]":
  - name:Steve Rogers
UID: urn:uuid:019730a76c09e-4768-b9bc-f4e7ff3b8b8d
REV: 20250115T154200Z
---

## Related
- friend [[Bruce Wayne]]
- colleague [[Steve Rogers]]

#### Notes
Tony Stark, also known as Iron Man.
```

## How It Works

### Synchronization Process
1. **Edit the Related list** in any contact's markdown
2. **Automatic parsing** detects relationship changes
3. **Graph update** maintains the relationship network
4. **Front matter sync** updates vCard RELATED fields
5. **Reciprocal creation** adds the reverse relationship to the other contact

### Data Storage
- **Graph**: Internal directed graph for efficient relationship queries
- **Front matter**: vCard-compliant RELATED fields with sorted arrays
- **Markdown**: Human-readable Related sections in contact files

### Gender Inference
When you use gendered terms like "father" or "mother", the system:
1. **Infers the target's gender** (father = male, mother = female)
2. **Updates the target contact's GENDER field** if not already set
3. **Stores the relationship** using neutral terms internally (parent)
4. **Displays** using appropriate gendered terms based on actual gender

## Commands

The plugin adds several commands accessible via Ctrl+P (Cmd+P on Mac):

- **"Rebuild Relationship Graph"**: Reconstructs the entire relationship network
- **"Check Relationship Consistency"**: Identifies missing reciprocal relationships
- **"Fix Relationship Consistency"**: Automatically fixes consistency issues

## Technical Details

### vCard 4.0 RELATED Field Format
```
RELATED[friend]: urn:uuid:12345678-1234-1234-1234-123456789abc
RELATED[parent]: uid:contact-id-123  
RELATED[colleague]: name:John Doe
```

### Relationship Types (Internal)
The system uses gender-neutral terms internally:
- `parent` (displays as father/mother based on gender)
- `child` (displays as son/daughter)
- `sibling` (displays as brother/sister)
- `auncle` (displays as uncle/aunt)
- `nibling` (displays as nephew/niece)

### REV Timestamp Management
The plugin automatically updates the REV field in vCard format whenever relationships change:
```
REV: 20250115T154200Z
```

## Troubleshooting

### Common Issues
1. **Missing reciprocal relationships**: Run "Check Relationship Consistency"
2. **Duplicate relationships**: The system prevents duplicates automatically
3. **Gender not displaying correctly**: Check the GENDER field in front matter

### Consistency Checking
The system automatically detects and can fix:
- Missing reciprocal relationships
- Inconsistent front matter
- Graph synchronization issues

### Best Practices
1. **Use consistent contact names** that match file names
2. **Let the system handle reciprocals** - don't manually add both directions
3. **Use natural terms** - the system understands father, mother, etc.
4. **Check consistency periodically** using the built-in commands

## Example Workflow

1. **Create contacts** with basic information
2. **Add relationships** using the Related section:
   ```markdown
   ## Related
   - father [[John Smith]]
   - sister [[Jane Smith]]
   - friend [[Bob Johnson]]
   ```
3. **Save the file** - relationships sync automatically
4. **Check related contacts** - they now show reciprocal relationships
5. **Use consistency check** if needed to verify everything is in sync

The relationship management system provides a powerful way to model and maintain your personal social network directly within Obsidian, making it easy to understand connections between your contacts.