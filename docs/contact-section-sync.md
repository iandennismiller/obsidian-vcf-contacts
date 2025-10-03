# Contact Section Sync Feature

## Overview

The Contact Section Sync feature allows you to edit contact information in the human-readable `## Contact` section of your notes, and automatically sync those changes back to the frontmatter. This provides a two-way sync between the structured frontmatter fields and the markdown-formatted Contact section.

## How It Works

### Automatic Field Detection

The parser can automatically detect contact information even without explicit headers. It uses pattern matching to identify:

- **Email addresses**: `user@example.com`
- **Phone numbers**: Including international formats like `+1-555-123-4567`, `(555) 123-4567`, etc.
- **URLs/Websites**: `https://example.com`, `www.example.com`, `example.com`

### Supported Input Formats

The Contact section parser is flexible and supports multiple user input formats:

#### Format 1: Labeled with Colon
```markdown
## Contact

📧 Email
Home: john@personal.com
Work: john@company.com

📞 Phone
Cell: (555) 123-4567
```

#### Format 2: Space-Separated Label
```markdown
## Contact

Email
Personal john@personal.com
Work john@work.com
```

#### Format 3: Dash-Prefixed
```markdown
## Contact

Email
- john@personal.com
- jane@work.com
```

#### Format 4: Bare Values (Auto-Detected)
```markdown
## Contact

john@example.com
555-123-4567
https://johndoe.com
```

### Field Normalization

Contact fields are automatically normalized to standard formats:

- **Phone numbers**: Converted to international format `+1-555-123-4567`
- **Email addresses**: Converted to lowercase `user@example.com`
- **URLs**: Protocol added if missing `https://example.com`

## Configuration

### Enable/Disable Sync Confirmation

In Settings → Contact Section Template, you can toggle "Confirm before syncing Contact section to frontmatter":

- **Enabled** (default): Shows a confirmation dialog listing all changes before syncing
- **Disabled**: Automatically syncs changes without confirmation

## The Confirmation Modal

When sync confirmation is enabled, you'll see a modal dialog showing:

### Fields to Add
New fields that will be created in frontmatter:
- `EMAIL[Home]`: john@personal.com
- `TEL[Cell]`: +1-555-123-4567

### Fields to Update
Existing fields that will be modified:
- `EMAIL[Work]`: old@work.com → new@work.com

### Fields to Remove
Fields that will be deleted from frontmatter (not currently implemented to prevent data loss)

## Sync Scenarios

### Scenario 1: Creating a New Contact Section

When you add a `## Contact` section to a note that didn't have one:

```markdown
---
UID: john-doe-123
FN: John Doe
---

## Contact

john@example.com
555-123-4567

#Contact
```

**Result**: The parser detects and adds:
- `EMAIL[1]: john@example.com`
- `TEL[1]: +1-555-123-4567`

### Scenario 2: Adding Fields to Existing Contact

When you add new contact information to an existing Contact section:

```markdown
## Contact

📧 Email
Work: john@company.com  # ← New field added
Home: john@personal.com  # Existing field
```

**Result**: Only the new `EMAIL[Work]` field is synced to frontmatter.

### Scenario 3: Modifying Existing Fields

When you edit a field value:

```markdown
## Contact

Phone
Cell: +1-555-999-8888  # ← Changed from +1-555-123-4567
```

**Result**: The `TEL[Cell]` frontmatter field is updated with the new value.

### Scenario 4: Multiple Changes at Once

The sync handles combinations of additions, modifications, and deletions in a single operation.

## Field Type Detection

The system uses intelligent pattern matching to identify field types:

### Email Detection
- Must contain `@` symbol
- Valid domain format
- Examples: `user@example.com`, `name+tag@domain.co.uk`

### Phone Number Detection
- 7-15 digits
- Supports various formats:
  - `(555) 123-4567`
  - `555-123-4567`
  - `+1-555-123-4567`
  - `+86-10-1234-5678`
  - `555 123 4567`

### URL Detection
- Valid domain structure
- Optional protocol (`http://`, `https://`)
- Examples: `https://example.com`, `www.example.com`, `example.com`

### Postal Code Detection
Used for address components:
- US ZIP: `12345` or `12345-6789`
- Canadian: `K1A 0B1`
- UK: `SW1A 1AA`

## Best Practices

1. **Use Headers**: While auto-detection works, using section headers like `📧 Email` makes the Contact section more readable

2. **Label Your Fields**: Use labels like `Home:`, `Work:`, `Cell:` for better organization

3. **Check the Preview**: When confirmation is enabled, review changes before confirming

4. **Keep It Simple**: The parser handles multiple formats, but consistent formatting makes it easier to read

5. **Backup First**: Always have backups when testing new features

## Integration with VCF Sync

The Contact Section sync works alongside VCF sync:

1. VCF file → Frontmatter (via VCF Sync Pre Processor)
2. Frontmatter → Contact Section (via Front Matter to Contact Processor)
3. Contact Section → Frontmatter (via Contact to Front Matter Processor - this feature)
4. Frontmatter → VCF file (via VCF Sync Post Processor)

This creates a complete bidirectional sync between:
- External VCF files
- Obsidian frontmatter
- Human-readable Contact sections

## Troubleshooting

### Contact Section Not Syncing

1. **Check if Contact section exists**: Must have a header like `## Contact`
2. **Verify processor is enabled**: Check Settings → Contact to Front Matter Processor
3. **Review field formats**: Ensure fields match supported formats
4. **Check logs**: Look for `[ContactToFrontMatterProcessor]` debug messages

### Fields Not Detected

1. **Use explicit headers**: Add `Email`, `Phone`, etc. headers
2. **Check field format**: Ensure values match patterns (valid email, phone, etc.)
3. **Add labels**: Use `Label: value` format for clarity

### Validation Warnings

If you see warnings about invalid formats:
- **Email**: Ensure proper `user@domain.com` format
- **Phone**: Include enough digits (7-15)
- **URL**: Must be a valid domain

## API Reference

### Field Pattern Detection

```typescript
import { 
  isEmail, 
  isPhoneNumber, 
  isUrl,
  identifyFieldType,
  normalizeFieldValue
} from 'src/models/contactNote/fieldPatternDetection';

// Check field types
isEmail('user@example.com'); // true
isPhoneNumber('+1-555-123-4567'); // true
isUrl('https://example.com'); // true

// Auto-identify
identifyFieldType('user@example.com'); // 'EMAIL'

// Normalize
normalizeFieldValue('555-123-4567', 'TEL'); // '+1-555-123-4567'
```

### Update Contact Modal

```typescript
import { UpdateContactModal, FieldChange } from 'src/plugin/ui/modals/updateContactModal';

const changes: FieldChange[] = [
  {
    key: 'EMAIL[Home]',
    newValue: 'john@example.com',
    changeType: 'added'
  },
  {
    key: 'TEL[Cell]',
    oldValue: '+1-555-111-2222',
    newValue: '+1-555-123-4567',
    changeType: 'modified'
  }
];

const modal = new UpdateContactModal(
  app,
  changes,
  () => console.log('Confirmed'),
  () => console.log('Cancelled')
);
modal.open();
```

## Future Enhancements

Planned improvements:
- **Field Deletion**: Safe deletion of fields removed from Contact section
- **Address Parsing**: Better multi-line address handling
- **Custom Patterns**: User-defined field type patterns
- **Conflict Resolution**: Handle conflicts between frontmatter and Contact section
- **Batch Operations**: Sync multiple contacts at once
