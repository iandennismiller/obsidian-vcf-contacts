# Update Contact Modal - Visual Guide

## Modal Structure

The Update Contact Modal is shown when the Contact section has been edited and `contactSectionSyncConfirmation` is enabled in settings.

```
┌─────────────────────────────────────────────────────────────┐
│ Sync Contact Section to Frontmatter                   [×]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ The Contact section has been edited. The following         │
│ changes will be synced to frontmatter:                     │
│                                                             │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ Fields to Add (2)                                   │   │
│ │ • EMAIL[Home]: john@personal.com                    │   │
│ │ • TEL[Cell]: +1-555-123-4567                        │   │
│ └─────────────────────────────────────────────────────┘   │
│                                                             │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ Fields to Update (1)                                │   │
│ │ • EMAIL[Work]: old@work.com → new@work.com          │   │
│ └─────────────────────────────────────────────────────┘   │
│                                                             │
│                                                             │
│                    [ Confirm Sync ]  [ Cancel ]             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Example Scenarios

### Scenario 1: Adding New Fields

User adds email to Contact section:

**Contact Section:**
```markdown
## Contact

Email
john@example.com
```

**Modal Shows:**
```
Fields to Add (1)
• EMAIL[1]: john@example.com
```

### Scenario 2: Modifying Existing Fields

User changes phone number:

**Contact Section:**
```markdown
## Contact

Phone
Cell: +1-555-999-8888  ← Changed from +1-555-123-4567
```

**Modal Shows:**
```
Fields to Update (1)
• TEL[Cell]: +1-555-123-4567 → +1-555-999-8888
```

### Scenario 3: Multiple Changes

User adds email and changes phone:

**Modal Shows:**
```
Fields to Add (1)
• EMAIL[Home]: john@personal.com

Fields to Update (1)
• TEL[Cell]: +1-555-123-4567 → +1-555-999-8888
```

## Button Actions

- **Confirm Sync**: Applies all changes to frontmatter and updates REV timestamp
- **Cancel**: Closes modal without applying changes

## Configuration

Enable/disable in Settings → Contact Section Template:
- Toggle: "Confirm before syncing Contact section to frontmatter"
- Default: Enabled (shows modal)
- When disabled: Changes sync automatically without confirmation
