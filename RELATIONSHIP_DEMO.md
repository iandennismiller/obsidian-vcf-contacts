# Demo: vCard 4.0 RELATED Field Support

This demo shows the new relationship functionality in action.

## Example 1: Basic Relationship Creation

### Contact: John Doe
```markdown
---
UID: 12345-abcde
FN: John Doe
GENDER: male
RELATED[friend]: RELATED;TYPE=friend:urn:uuid:67890-fghij
RELATED[parent]: RELATED;TYPE=parent:name:Jane Doe
REV: 2024-01-15T10:30:00Z
---

# John Doe

## Related

- friend [[Alice Smith]]
- parent [[Jane Doe]]
```

### Contact: Alice Smith  
```markdown
---
UID: 67890-fghij
FN: Alice Smith
GENDER: female
RELATED[friend]: RELATED;TYPE=friend:urn:uuid:12345-abcde
REV: 2024-01-15T10:30:00Z
---

# Alice Smith

## Related

- friend [[John Doe]]
```

## Example 2: Gendered Relationships

### Contact: Bob Wilson
```markdown
---
UID: 99999-zzzzz
FN: Bob Wilson
GENDER: male
RELATED[auncle]: RELATED;TYPE=auncle:name:Sarah Wilson
REV: 2024-01-15T10:30:00Z
---

# Bob Wilson

## Related

- uncle [[Sarah Wilson]]
```

Note: "uncle" displays because Sarah Wilson has gender=female in her contact, but the front matter stores the genderless "auncle" type.

## Example 3: VCF File Drop

Drop this VCF file into your vault:

```vcf
BEGIN:VCARD
VERSION:4.0
UID:11111-22222
FN:Mike Johnson
GENDER:M
RELATED;TYPE=friend:urn:uuid:12345-abcde
RELATED;TYPE=colleague:name:Susan Brown
END:VCARD
```

The plugin will:
1. Create a contact note for Mike Johnson
2. Parse the RELATED fields  
3. Add appropriate Related section
4. Move VCF to configured folder
5. Remove VCF from vault

## Key Features Demonstrated

1. **Bidirectional Sync**: Changes in markdown lists sync to front matter and vice versa
2. **Gender Awareness**: Relationships display with appropriate gender (uncle/aunt, father/mother, etc.)
3. **Contact References**: Supports UUID, UID, and name-based contact references
4. **Multiple Relationships**: Same contacts can have multiple relationship types
5. **Auto-propagation**: Changes propagate to related contacts automatically
6. **VCF Integration**: Import and export RELATED fields in vCard format

## Commands

- **Sync All Relationships**: Manually sync all contact relationships
- Access via Command Palette (Ctrl/Cmd + P) → "Sync All Relationships"