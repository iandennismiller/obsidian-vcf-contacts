# Contact Section Sync Feature

## Overview

The Contact Section Sync feature allows you to edit contact information in the human-readable `## Contact` section of your notes, and automatically sync those changes back to the frontmatter. This provides a two-way sync between the structured frontmatter fields and the markdown-formatted Contact section.

**Architecture Note**: This feature uses the [marked](https://www.npmjs.com/package/marked) library for markdown structure parsing (extracting list items, headings, etc.). Custom parsing focuses only on:
- Contact field pattern recognition (emails, phones, URLs)
- Kind/type label extraction
- Obsidian-specific wiki-links

This approach eliminates the need for custom markdown syntax edge case handling.

## How It Works

### Automatic Field Detection

The parser can automatically detect contact information even without explicit headers. It uses pattern matching to identify:

- **Email addresses**: `user@example.com`
- **Phone numbers**: Including international formats like `+1-555-123-4567`, `(555) 123-4567`, etc.
- **URLs/Websites**: `https://example.com`, `www.example.com`, `example.com`

**Note**: Markdown list parsing (extracting `-` list items, handling whitespace, line breaks) is handled by the marked library. Pattern matching is applied to the parsed content.

### Contact List Parsing (Recommended Format)

The **Contact List** format is the recommended way to enter contact information. It provides a simple, flexible syntax that's easy to parse and doesn't require rigid templates.

#### How It Works

Each line in the Contact section can be a markdown list item (starting with `-`) containing a single piece of contact information. The parser:

1. **Detects the field type** using pattern matching (email, phone, URL, or address)
2. **Extracts an optional kind/type prefix** (like `home`, `work`, `personal`)
3. **Automatically adds emoji prefixes** when displaying the information
4. **Syncs to frontmatter** using the format `FIELDTYPE[KIND]: value`

#### Supported Patterns

The following are all valid contact list entries:

```markdown
## Contact

- home 555-555-5555
- contact@example.com
- work contact@example.com
- 123 Some street
- 123 Some street, Town
- http://example.com
- personal http://example.com
```

#### Kind/Type Prefix

You can optionally prefix any contact line with a "kind" label:

- **Email kinds**: `home`, `work`, `personal`, `vacation`, or any custom label
- **Phone kinds**: `home`, `work`, `cell`, `mobile`, `fax`, or any custom label
- **URL kinds**: `home`, `work`, `personal`, or any custom label
- **Address kinds**: `home`, `work`, or any custom label

The kind is **optional** - if omitted, the field is indexed (e.g., first is bare `EMAIL`, second is `EMAIL[1]`, third is `EMAIL[2]`).

#### Auto-Detection Examples

**Email Detection:**
- `- contact@example.com` → Detected as email, syncs to `EMAIL`
- `- work contact@example.com` → Detected as email with kind "work", syncs to `EMAIL[WORK]`

**Phone Detection:**
- `- 555-555-5555` → Detected as phone, normalized and syncs to `TEL`
- `- home 555-555-5555` → Detected as phone with kind "home", syncs to `TEL[HOME]`

**URL Detection:**
- `- http://example.com` → Detected as URL, syncs to `URL`
- `- personal http://example.com` → Detected as URL with kind "personal", syncs to `URL[PERSONAL]`

**Address Detection:**
- `- 123 Some street` → Detected as address, syncs to `ADR.STREET`
- `- 123 Some street, Town` → Detected as address with locality, syncs to address fields

#### Frontmatter Mapping

When syncing to frontmatter, the parser uses this format:

```yaml
# Email with kind
EMAIL[WORK]: contact@example.com

# Phone with kind
TEL[HOME]: +1-555-555-5555

# URL with kind
URL[PERSONAL]: http://example.com

# Email without kind (first is bare, second indexed)
EMAIL: first@example.com
EMAIL[1]: second@example.com
```

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

#### Format 5: Contact List with Optional Kinds (Recommended)
```markdown
## Contact

- home 555-555-5555
- contact@example.com
- work contact@example.com
- 123 Some street
- 123 Some street, Town
- http://example.com
- personal http://example.com
```

This format provides maximum flexibility by allowing users to optionally specify "kind" labels (like `home`, `work`, `personal`) before the contact information. The parser automatically:

- Detects the field type (email, phone, URL, address) from the value
- Extracts the optional kind/type prefix
- Adds appropriate emoji prefixes when displaying
- Syncs to frontmatter using the pattern `FIELDTYPE[KIND]`

**Example parsing:**
- `- work contact@example.com` → `EMAIL[WORK]: contact@example.com` (📧 email detected)
- `- home 555-555-5555` → `TEL[HOME]: +1-555-555-5555` (📞 phone detected and normalized)
- `- personal http://example.com` → `URL[PERSONAL]: http://example.com` (🌐 URL detected)
- `- 123 Some street, Town` → `ADR.STREET: 123 Some street, Town` (🏠 address detected)

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

The system uses intelligent pattern matching to identify field types from contact list entries.

### Detection Process

When parsing a contact list item like `- work contact@example.com`:

1. **Extract the value**: Remove the list marker (`-`) and trim whitespace
2. **Check for kind prefix**: Look for an optional label at the beginning
3. **Identify field type**: Use pattern matching to determine if it's email, phone, URL, or address
4. **Parse components**: Extract the kind (if present) and the actual value
5. **Sync to frontmatter**: Create the appropriate frontmatter key like `EMAIL[WORK]`

### Email Detection
- Must contain `@` symbol
- Valid domain format
- Examples: `user@example.com`, `name+tag@domain.co.uk`
- Pattern: `optional_kind email@domain.com`

**Valid formats:**
- `contact@example.com` → `EMAIL` (first email, bare key)
- `second@example.com` → `EMAIL[1]` (second email)
- `work contact@example.com` → `EMAIL[WORK]`
- `personal user+tag@example.com` → `EMAIL[PERSONAL]`

### Phone Number Detection
- 7-15 digits
- Supports various formats:
  - `(555) 123-4567`
  - `555-123-4567`
  - `+1-555-123-4567`
  - `+86-10-1234-5678`
  - `555 123 4567`
- Pattern: `optional_kind phone_number`

**Valid formats:**
- `555-555-5555` → `TEL` (first phone, bare key, normalized to `+1-555-555-5555`)
- `222-222-2222` → `TEL[1]` (second phone)
- `home 555-555-5555` → `TEL[HOME]`
- `cell (555) 123-4567` → `TEL[CELL]`

### URL Detection
- Valid domain structure
- Optional protocol (`http://`, `https://`)
- Examples: `https://example.com`, `www.example.com`, `example.com`
- Pattern: `optional_kind url`

**Valid formats:**
- `http://example.com` → `URL[1]`
- `personal http://example.com` → `URL[PERSONAL]`
- `work https://company.com` → `URL[WORK]`

### Address Detection
- Street address patterns
- City, state, zip patterns
- Multi-line address support
- Pattern: `optional_kind address_line`

**Valid formats:**
- `123 Some street` → `ADR[1].STREET`
- `123 Some street, Town` → `ADR[1].STREET` + `ADR[1].LOCALITY`
- `home 123 Main St, Springfield, IL 62701` → `ADR[HOME].*`

### Kind/Type Extraction

The parser extracts kind/type prefixes using a general method:

1. **Split the line**: Separate potential kind from value
2. **Validate the value**: Check if the remainder matches a known pattern
3. **Use the kind**: If valid, use the prefix as the kind; otherwise, treat the whole line as the value

**Examples:**
- `work email@example.com` → kind=`work`, value=`email@example.com`
- `555-5555` → kind=`1` (auto-indexed), value=`555-5555`
- `home 123 Main St` → kind=`home`, value=`123 Main St`

### Postal Code Detection
Used for address components:
- US ZIP: `12345` or `12345-6789`
- Canadian: `K1A 0B1`
- UK: `SW1A 1AA`

## Best Practices

1. **Use Contact List Format**: The contact list format (with `-` prefix) is recommended for its flexibility and ease of use

2. **Use Headers**: While auto-detection works, using section headers like `📧 Email` makes the Contact section more readable

3. **Label Your Fields**: Use kind labels like `home:`, `work:`, `cell:` for better organization

4. **Check the Preview**: When confirmation is enabled, review changes before confirming

5. **Keep It Simple**: The parser handles multiple formats, but consistent formatting makes it easier to read

6. **Backup First**: Always have backups when testing new features

7. **Use Optional Kinds**: Add kind prefixes (like `work`, `home`) when you need to distinguish multiple values of the same type

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

### Parsing Architecture

The contact list parsing uses a two-stage approach:

#### Stage 1: Field Type Detection

The `identifyFieldType()` function determines what kind of information a line contains:

```typescript
import { identifyFieldType } from 'src/models/contactNote/fieldPatternDetection';

// Detect field type from value
identifyFieldType('contact@example.com'); // 'EMAIL'
identifyFieldType('555-123-4567'); // 'TEL'
identifyFieldType('https://example.com'); // 'URL'
```

This uses pattern matching to check (in order):
1. Email pattern (contains `@` and valid domain)
2. URL pattern (valid domain with optional protocol)
3. Phone pattern (7-15 digits with various formatting)

#### Stage 2: Line Parsing

For each contact list item, the parser:

1. **Extracts the line content**: Removes list marker and whitespace
2. **Splits kind from value**: Attempts to separate optional kind prefix
3. **Validates the pattern**: Confirms the value matches a known field type
4. **Creates frontmatter key**: Generates key like `EMAIL[WORK]` or bare `TEL` (first field) or indexed `TEL[1]` (second field)

**Parsing separate methods by type:**

Each field type has its own parsing logic:

- **Email parsing**: Extracts kind and email address
- **Phone parsing**: Extracts kind, normalizes phone number format
- **URL parsing**: Extracts kind, adds protocol if missing
- **Address parsing**: Handles multi-line addresses with street, city, state, etc.

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
