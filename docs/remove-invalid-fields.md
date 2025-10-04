# Remove Invalid Frontmatter Fields Feature

## Overview

This feature allows you to automatically remove invalid contact fields from frontmatter to clean up data quality issues.

## Configuration

### Confirmation Setting

In Settings → Data Quality, you can configure:

**"Confirm before removing invalid fields"** (default: enabled)
- When enabled: Shows a preview modal with all fields that will be removed
- When disabled: Removes invalid fields immediately without confirmation

## How It Works

The plugin validates the following field types:
- **EMAIL fields** - Must contain @ symbol and domain (e.g., `user@domain.com`)
- **TEL fields** - Must contain at least some digits (7+ characters)
- **URL fields** - Must start with `http://` or `https://`

**Note:** Date fields (BDAY, REV, ANNIVERSARY) are NOT validated and will remain even if invalid.

## Commands

### Remove invalid frontmatter fields from current contact

This command removes invalid fields from the currently active contact file.

1. Open a contact file in your vault
2. Open the command palette (Cmd/Ctrl + P)
3. Search for "Remove invalid frontmatter fields from current contact"
4. Run the command
5. If confirmation is enabled, review the preview modal showing which fields will be removed
6. Click "Remove Invalid Fields" to confirm, or "Cancel" to abort
7. You'll see a notice showing how many fields were removed

### Remove invalid frontmatter fields from all contacts

This command removes invalid fields from all contacts in your vault.

1. Open the command palette (Cmd/Ctrl + P)
2. Search for "Remove invalid frontmatter fields from all contacts"
3. Run the command
4. If confirmation is enabled, review the preview modal showing all invalid fields across all contacts
5. Click "Remove Invalid Fields" to confirm, or "Cancel" to abort
6. You'll see a notice showing the total number of fields removed and how many contacts were affected

## Preview Modal

When confirmation is enabled, the modal shows:

- **Field key**: The frontmatter field name (e.g., `EMAIL[HOME]`)
- **Current value**: What's currently stored in that field
- **Reason**: Why the field is considered invalid

Example modal content:
```
Fields to Remove (3)

• EMAIL[HOME]: not-an-email
  Invalid email format (must contain @ and domain)

• TEL[WORK]: no-numbers-here
  Invalid phone format (must contain digits)

• URL[PERSONAL]: bad-url
  Invalid URL format (must start with http:// or https://)
```

## Example

### Before

```markdown
---
UID: john-doe-123
FN: John Doe
EMAIL[HOME]: not-an-email
EMAIL[WORK]: john@example.com
TEL[HOME]: no-numbers-here
TEL[CELL]: 555-1234
URL[HOME]: bad-url
URL[WORK]: https://example.com
BDAY: invalid-date
ORG: Example Corp
---

## Notes
...
```

### After running the command

```markdown
---
UID: john-doe-123
FN: John Doe
EMAIL[WORK]: john@example.com
TEL[CELL]: 555-1234
URL[WORK]: https://example.com
BDAY: invalid-date
ORG: Example Corp
---

## Notes
...
```

**Removed fields:**
- `EMAIL[HOME]` (invalid email format)
- `TEL[HOME]` (no digits)
- `URL[HOME]` (missing http/https protocol)

**Preserved fields:**
- `EMAIL[WORK]` (valid email)
- `TEL[CELL]` (contains digits)
- `URL[WORK]` (valid URL)
- `BDAY` (date fields are not validated)
- `ORG` (not a contact field - not validated)

## Notes

- The command only removes contact fields (EMAIL, TEL, URL) that fail validation
- Date fields like BDAY, REV, and ANNIVERSARY are never removed, even if invalid
- Valid fields are preserved unchanged
- Required fields like `UID` and `FN` are never removed
- Non-string values (like arrays) are skipped
- Empty frontmatter is handled gracefully
- Confirmation can be disabled in settings for faster operation
