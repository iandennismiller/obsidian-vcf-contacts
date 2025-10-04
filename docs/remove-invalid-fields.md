# Remove Invalid Frontmatter Fields Feature

## Overview

This feature allows you to automatically remove invalid contact fields from frontmatter to clean up data quality issues.

## How It Works

The plugin validates the following field types:
- **EMAIL fields** - Must contain @ symbol and domain (e.g., `user@domain.com`)
- **TEL fields** - Must contain at least some digits
- **URL fields** - Must start with `http://` or `https://`
- **Date fields** (BDAY, REV, ANNIVERSARY) - Must be valid date formats

## Commands

### Remove invalid frontmatter fields from current contact

This command removes invalid fields from the currently active contact file.

1. Open a contact file in your vault
2. Open the command palette (Cmd/Ctrl + P)
3. Search for "Remove invalid frontmatter fields from current contact"
4. Run the command
5. You'll see a notice showing how many fields were removed

### Remove invalid frontmatter fields from all contacts

This command removes invalid fields from all contacts in your vault.

1. Open the command palette (Cmd/Ctrl + P)
2. Search for "Remove invalid frontmatter fields from all contacts"
3. Run the command
4. You'll see a notice showing the total number of fields removed and how many contacts were affected

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
ORG: Example Corp
---

## Notes
...
```

**Removed fields:**
- `EMAIL[HOME]` (invalid email format)
- `TEL[HOME]` (no digits)
- `URL[HOME]` (missing http/https protocol)
- `BDAY` (invalid date format)

**Preserved fields:**
- `EMAIL[WORK]` (valid email)
- `TEL[CELL]` (contains digits)
- `URL[WORK]` (valid URL)
- `ORG` (not validated)

## Notes

- The command only removes fields that fail validation
- Valid fields are preserved unchanged
- Required fields like `UID` and `FN` are never removed
- Non-string values (like arrays) are skipped
- Empty frontmatter is handled gracefully
- You'll see a notice confirming how many fields were removed
