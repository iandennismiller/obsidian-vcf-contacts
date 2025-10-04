# vdirsyncer Configuration UI Mockup

## Settings Page - External Integrations Section

```
┌─────────────────────────────────────────────────────────────────┐
│ Obsidian VCF Contacts Plugin - Settings                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ... [other settings sections above] ...                         │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│ EXTERNAL INTEGRATIONS                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ vdirsyncer Integration                                       ││
│ │                                                              ││
│ │ vdirsyncer is a command-line tool that syncs vCard files   ││
│ │ with CardDAV servers. Use these settings to view and edit  ││
│ │ your vdirsyncer configuration file from within Obsidian.    ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│ Custom vdirsyncer filename                           [OFF] ◯    │
│ Enable to customize the path to your vdirsyncer config file.    │
│                                                                  │
│ ┌─ When toggle is ON: ──────────────────────────────────────┐  │
│ │ vdirsyncer Config Filename                                │  │
│ │ ┌──────────────────────────────────────────────────────┐  │  │
│ │ │ $HOME/.config/vdirsyncer/config                      │  │  │
│ │ └──────────────────────────────────────────────────────┘  │  │
│ │ Path to your vdirsyncer config file.                      │  │
│ │ Use $HOME for your home directory.                        │  │
│ └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│ Edit vdirsyncer Config                                          │
│ ┌─────────────────┐                                             │
│ │  Open Config    │  ← Disabled if file doesn't exist          │
│ └─────────────────┘                                             │
│ Opens a modal to view and edit your vdirsyncer configuration    │
│ file. The button is only enabled when the config file exists.   │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ... [other settings sections below] ...                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## vdirsyncer Configuration Modal

### When File Exists and Modal Opens (Status: unchanged)

```
┌──────────────────────────────────────────────────────────────────┐
│ vdirsyncer Configuration                                    [×]  │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│ ╔═════════════════════════════════════════════════════════════╗ │
│ ║ Status: unchanged                                           ║ │
│ ╚═════════════════════════════════════════════════════════════╝ │
│    ↑ GREEN background indicating file matches disk              │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ # vdirsyncer configuration file                             │ │
│ │ # See https://vdirsyncer.pimutils.org/                      │ │
│ │                                                             │ │
│ │ [general]                                                   │ │
│ │ status_path = "~/.vdirsyncer/status/"                       │ │
│ │                                                             │ │
│ │ [pair my_contacts]                                          │ │
│ │ a = "my_contacts_local"                                     │ │
│ │ b = "my_contacts_remote"                                    │ │
│ │ collections = ["from a", "from b"]                          │ │
│ │                                                             │ │
│ │ [storage my_contacts_local]                                 │ │
│ │ type = "filesystem"                                         │ │
│ │ path = "~/.contacts/"                                       │ │
│ │ fileext = ".vcf"                                            │ │
│ │                                                             │ │
│ │ [storage my_contacts_remote]                                │ │
│ │ type = "carddav"                                            │ │
│ │ url = "https://contacts.example.com/"                       │ │
│ │ username = "user@example.com"                               │ │
│ │ password = "your-password-here"                             │ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│    ↑ Scrollable textarea, ~20 lines visible, monospace font     │
│                                                                   │
│ ┌────────┐  ┌────────┐  ┌────────┐                              │
│ │ Reload │  │  Save  │  │ Close  │                              │
│ └────────┘  └────────┘  └────────┘                              │
│   ↑            ↑ Disabled    ↑ Primary button                   │
│   Always       when                                              │
│   enabled      unchanged                                         │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### After User Edits Content (Status: unsaved changes)

```
┌──────────────────────────────────────────────────────────────────┐
│ vdirsyncer Configuration                                    [×]  │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│ ╔═════════════════════════════════════════════════════════════╗ │
│ ║ Status: unsaved changes                                     ║ │
│ ╚═════════════════════════════════════════════════════════════╝ │
│    ↑ ORANGE/RED background indicating unsaved changes           │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ # vdirsyncer configuration file                             │ │
│ │ # Modified by user                                          │ │
│ │                                                             │ │
│ │ [general]                                                   │ │
│ │ status_path = "~/.vdirsyncer/status/"                       │ │
│ │                                                             │ │
│ │ [pair my_contacts]                                          │ │
│ │ a = "my_contacts_local"                                     │ │
│ │ b = "my_contacts_remote"                                    │ │
│ │ collections = ["from a", "from b"]                          │ │
│ │ conflict_resolution = "b wins"  ← NEW LINE ADDED            │ │
│ │                                                             │ │
│ │ [storage my_contacts_local]                                 │ │
│ │ type = "filesystem"                                         │ │
│ │ path = "~/.contacts/"                                       │ │
│ │ fileext = ".vcf"                                            │ │
│ │                                                             │ │
│ │ [storage my_contacts_remote]                                │ │
│ │ type = "carddav"                                            │ │
│ │ url = "https://contacts.example.com/"                       │ │
│ │ username = "user@example.com"                               │ │
│ │ password = "your-password-here"                             │ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ┌────────┐  ┌────────┐  ┌────────┐                              │
│ │ Reload │  │  Save  │  │ Close  │                              │
│ └────────┘  └────────┘  └────────┘                              │
│                ↑ Now enabled                                     │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### After User Clicks Save (Status: saved changes)

```
┌──────────────────────────────────────────────────────────────────┐
│ vdirsyncer Configuration                                    [×]  │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│ ╔═════════════════════════════════════════════════════════════╗ │
│ ║ Status: saved changes                                       ║ │
│ ╚═════════════════════════════════════════════════════════════╝ │
│    ↑ BLUE background indicating saved this session              │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ # vdirsyncer configuration file                             │ │
│ │ # Modified by user                                          │ │
│ │                                                             │ │
│ │ [general]                                                   │ │
│ │ status_path = "~/.vdirsyncer/status/"                       │ │
│ │                                                             │ │
│ │ [pair my_contacts]                                          │ │
│ │ a = "my_contacts_local"                                     │ │
│ │ b = "my_contacts_remote"                                    │ │
│ │ collections = ["from a", "from b"]                          │ │
│ │ conflict_resolution = "b wins"  ← SAVED TO DISK             │ │
│ │                                                             │ │
│ │ [storage my_contacts_local]                                 │ │
│ │ type = "filesystem"                                         │ │
│ │ path = "~/.contacts/"                                       │ │
│ │ fileext = ".vcf"                                            │ │
│ │                                                             │ │
│ │ [storage my_contacts_remote]                                │ │
│ │ type = "carddav"                                            │ │
│ │ url = "https://contacts.example.com/"                       │ │
│ │ username = "user@example.com"                               │ │
│ │ password = "your-password-here"                             │ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ┌────────┐  ┌────────┐  ┌────────┐                              │
│ │ Reload │  │  Save  │  │ Close  │                              │
│ └────────┘  └────────┘  └────────┘                              │
│                ↑ Disabled again                                  │
│                  (no changes)                                    │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘

 💾 Notice: "Config saved successfully"
```

## Command Palette Integration

```
┌──────────────────────────────────────────────────────────────────┐
│ Command Palette                                                  │
├──────────────────────────────────────────────────────────────────┤
│ Search commands...                                               │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ vdir█                                                        │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ Results:                                                          │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ ▸ Contacts: Edit vdirsyncer config                          │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

## Status Color Legend

```
┌───────────────────────────────────────────────────────────────┐
│ Status Color Coding:                                          │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  🟢 GREEN (unchanged)                                         │
│     Textarea content matches file on disk                     │
│     No saves during this modal session                        │
│                                                               │
│  🟠 ORANGE (unsaved changes)                                  │
│     Textarea content differs from file on disk                │
│     User has made edits that haven't been saved               │
│                                                               │
│  🔵 BLUE (saved changes)                                      │
│     File was saved during this modal session                  │
│     AND textarea currently matches file on disk               │
│     (Resets to "unchanged" if modal is closed and reopened)   │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

## Button Behavior Matrix

```
┌────────────────┬───────────┬───────────┬──────────────────────┐
│ Status         │ Reload    │ Save      │ Close                │
├────────────────┼───────────┼───────────┼──────────────────────┤
│ unchanged      │ Enabled   │ Disabled  │ Enabled              │
├────────────────┼───────────┼───────────┼──────────────────────┤
│ unsaved        │ Enabled   │ Enabled   │ Enabled              │
├────────────────┼───────────┼───────────┼──────────────────────┤
│ saved          │ Enabled   │ Disabled  │ Enabled              │
└────────────────┴───────────┴───────────┴──────────────────────┘

Reload: Always enabled - reloads content from disk
Save:   Enabled only when there are unsaved changes
Close:  Always enabled - closes modal without saving
```

## User Workflow Diagram

```
         ┌─────────────────────┐
         │ Open Settings       │
         │ → External Integ.   │
         └──────────┬──────────┘
                    │
                    ▼
         ┌─────────────────────┐
         │ Click "Open Config" │
         │ Button              │
         └──────────┬──────────┘
                    │
                    ▼
         ┌─────────────────────┐
    ┌───│ Modal Opens         │
    │   │ Status: unchanged   │
    │   └──────────┬──────────┘
    │              │
    │              ▼
    │   ┌─────────────────────┐
    │   │ User Edits Content  │
    │   │ Status: unsaved     │
    │   └──────────┬──────────┘
    │              │
    │    ┌─────────┴─────────┐
    │    │                   │
    │    ▼                   ▼
    │  ┌────────┐       ┌────────┐
    │  │ Reload │       │  Save  │
    │  └───┬────┘       └────┬───┘
    │      │                 │
    │      ▼                 ▼
    │  unchanged          saved
    └──────────────────────┬─┘
                           │
                           ▼
                    ┌────────────┐
                    │   Close    │
                    └─────┬──────┘
                          │
                          ▼
                     Modal Closes
```

## Integration with Obsidian Theme

The modal uses Obsidian's built-in CSS variables for theming:
- `--background-primary`: Main background
- `--background-modifier-border`: Borders
- `--background-modifier-success`: Green status (unchanged)
- `--background-modifier-error`: Orange/red status (unsaved)
- `--interactive-accent`: Blue status (saved)
- `--text-normal`: Regular text
- `--text-on-accent`: Text on colored backgrounds

This ensures the modal automatically adapts to:
- Light/dark theme
- Custom theme colors
- Obsidian updates
