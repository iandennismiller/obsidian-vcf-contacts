# Manual Testing for RELATED Field Support

This document outlines how to manually test the new RELATED field support and relationship graph functionality.

## Test Data

### Example Contact Files

Create these test contact files in your contacts folder:

#### `John Doe.md`
```markdown
---
FN: John Doe
N.GN: John
N.FN: Doe
EMAIL[HOME]: john.doe@example.com
UID: john-doe-uid-123
GENDER: M
VERSION: "4.0"
---

# John Doe

## Contact Information
- Email: john.doe@example.com

## Related

- friend [[Jane Smith]]
- brother [[Bob Doe]]
- colleague [[Mary Johnson]]

## Notes

John is a software developer.
```

#### `Jane Smith.md`
```markdown
---
FN: Jane Smith
N.GN: Jane
N.FN: Smith
EMAIL[HOME]: jane.smith@example.com
UID: jane-smith-uid-456
GENDER: F
VERSION: "4.0"
---

# Jane Smith

## Contact Information
- Email: jane.smith@example.com

## Related

- friend [[John Doe]]
- sister [[Alice Smith]]

## Notes

Jane is a designer.
```

#### `Bob Doe.md`
```markdown
---
FN: Bob Doe
N.GN: Bob
N.FN: Doe
EMAIL[HOME]: bob.doe@example.com
UID: bob-doe-uid-789
GENDER: M
VERSION: "4.0"
---

# Bob Doe

## Contact Information
- Email: bob.doe@example.com

## Related

- brother [[John Doe]]

## Notes

Bob is John's brother.
```

## Testing Steps

### 1. Basic Relationship Parsing
1. Create the test contact files above
2. Open a contact file and check the Related section
3. The plugin should parse the relationships and add them to the front matter
4. Check the front matter for entries like:
   ```yaml
   RELATED[friend]: urn:uuid:jane-smith-uid-456
   RELATED[brother]: urn:uuid:bob-doe-uid-789
   ```
   Note: The values use namespace format based on the target contact's UID type

### 2. Bidirectional Relationship Sync
1. In John Doe's file, add a new relationship: `- spouse [[Mary Doe]]`
2. When you save/close the file, the plugin should:
   - Add `RELATED[spouse]: urn:uuid:mary-doe-uid` or `name:Mary Doe` to John's front matter
   - If Mary Doe exists as a contact, update her relationships

### 3. Gendered Relationship Handling
1. Add gendered relationships like:
   - `- father [[Robert Doe]]`
   - `- mother [[Susan Doe]]`
2. The plugin should:
   - Store these as `RELATED[parent]` in the genderless form
   - Render them correctly based on the contact's gender

### 4. vCard Export with RELATED Fields
1. Export contacts to vCard format
2. Check that RELATED fields are included:
   ```
   RELATED;TYPE=friend:urn:uuid:jane-smith-uid-456
   RELATED;TYPE=brother:urn:uuid:bob-doe-uid-789
   ```

### 5. vCard Import with RELATED Fields
1. Create a vCard file with RELATED fields:
   ```
   BEGIN:VCARD
   VERSION:4.0
   FN:Test Contact
   RELATED;TYPE=friend:urn:uuid:john-doe-uid-123
   RELATED;TYPE=colleague:name:Jane Smith
   END:VCARD
   ```
2. Import this vCard
3. Check that the relationships are parsed correctly

### 6. Related Heading Cleanup
1. Create a contact with multiple Related headings:
   ```markdown
   ## Related
   
   ## related
   - friend [[John Doe]]
   
   ## RELATED
   ```
2. The plugin should clean up the headings, keeping only one with proper capitalization

### 7. Relationship Graph Consistency
1. Create circular relationships (A knows B, B knows A)
2. Modify one relationship and verify the other is updated
3. Delete a contact and verify relationships to that contact are cleaned up

## Expected Behaviors

### Front Matter Format
- Single relationship: `RELATED[friend]: Jane Smith`
- Multiple of same type: `RELATED[friend]: Jane Smith`, `RELATED[1:friend]: Bob Johnson`
- Relationships should be sorted alphabetically

### Markdown Format
- List items under `## Related` heading
- Format: `- relationshipType [[Contact Name]]`
- Sorted by relationship type, then by contact name

### Gendered Relationships
- Input: `father`, `mother`, `son`, `daughter`, etc.
- Storage: genderless forms (`parent`, `child`, etc.)
- Display: based on target contact's gender if available

### vCard Format
- `RELATED;TYPE=relationshipType:Contact Name`
- Multiple relationships should have separate RELATED lines

## Troubleshooting

If relationships aren't syncing:
1. Check the console for error messages
2. Verify contact files are in the correct folder
3. Check that contact files have valid front matter
4. Ensure relationships reference existing contact names

If gendered relationships aren't working:
1. Check that the target contact has a GENDER field
2. Verify the relationship type is in the supported list
3. Check the relationship mapping configuration