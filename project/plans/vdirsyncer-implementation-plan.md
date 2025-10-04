# vdirsyncer Configuration Integration - Implementation Plan

## Overview

This document outlines the implementation plan for integrating vdirsyncer configuration management into the Obsidian VCF Contacts plugin. The goal is to provide a quality-of-life improvement that allows users to view and edit their vdirsyncer config file from within Obsidian.

## Scope

**In Scope:**
- View and edit vdirsyncer config file from within Obsidian
- Configure config file path (default and custom)
- Auto-expand $HOME environment variable
- Check file existence and enable/disable UI accordingly
- Track file changes (unchanged/unsaved/saved states)
- Reload config from disk
- Save config to disk

**Out of Scope:**
- Full vdirsyncer integration
- Running vdirsyncer commands
- Validating vdirsyncer config syntax
- Managing vdirsyncer service lifecycle
- Installing or updating vdirsyncer

## Architecture

### Component Structure

```
src/plugin/
├── services/
│   └── vdirsyncerService.ts          # New: vdirsyncer service layer
├── ui/
│   └── modals/
│       └── vdirsyncerConfigModal.tsx # New: Config editor modal
└── settings.ts                        # Modified: Add vdirsyncer settings
```

### Data Flow

```
Settings UI
    ↓
    ├─→ Toggle "Custom filename" 
    │   ↓
    │   ├─→ Show/hide text field
    │   └─→ Reset to default on disable
    │
    ├─→ Change filename text
    │   ↓
    │   └─→ vdirsyncerService.checkConfigExists()
    │       ↓
    │       └─→ Update button state
    │
    └─→ Click "Edit vdirsyncer Config"
        ↓
        └─→ vdirsyncerConfigModal.onOpen()
            ├─→ vdirsyncerService.readConfig()
            ├─→ Display in textarea
            └─→ Set status: "unchanged"
            
Modal Actions
    ├─→ Edit textarea
    │   └─→ Set status: "unsaved changes"
    │
    ├─→ Click Reload
    │   ├─→ vdirsyncerService.readConfig()
    │   ├─→ Update textarea
    │   └─→ Set status: "unchanged"
    │
    ├─→ Click Save
    │   ├─→ vdirsyncerService.writeConfig()
    │   └─→ Set status: "saved changes"
    │
    └─→ Click Close
        └─→ Modal closes (doesn't reset state)
```

## Implementation Steps

### Step 1: Create vdirsyncerService.ts

**File**: `src/plugin/services/vdirsyncerService.ts`

**Purpose**: Encapsulate all file system operations for vdirsyncer config

**Interface**:
```typescript
export class VdirsyncerService {
  /**
   * Expands $HOME in path to actual home directory
   */
  static expandHomePath(filePath: string): string;

  /**
   * Checks if config file exists
   */
  static async checkConfigExists(filePath: string): Promise<boolean>;

  /**
   * Reads config file contents
   */
  static async readConfig(filePath: string): Promise<string | null>;

  /**
   * Writes content to config file
   */
  static async writeConfig(filePath: string, content: string): Promise<boolean>;
}
```

**Implementation Notes**:
- Use Node.js `os.homedir()` for $HOME expansion
- Use `fs/promises` for async file operations
- Use VCardFileOperations pattern as reference (similar static methods)
- Handle errors gracefully, return null/false on failure
- Add console.debug logging for diagnostics

**Testing Approach**:
- Unit tests with mocked file system
- Test $HOME expansion on various platforms
- Test file existence checking
- Test read/write operations
- Test error handling

### Step 2: Update Settings Interface

**File**: `src/plugin/settings.ts`

**Changes to `ContactsPluginSettings` interface**:
```typescript
export interface ContactsPluginSettings {
  // ... existing properties
  vdirsyncerCustomFilename: boolean;
  vdirsyncerConfigPath: string;
}
```

**Changes to `DEFAULT_SETTINGS`**:
```typescript
export const DEFAULT_SETTINGS: ContactsPluginSettings = {
  // ... existing defaults
  vdirsyncerCustomFilename: false,
  vdirsyncerConfigPath: "$HOME/.config/vdirsyncer/config",
}
```

**Implementation Notes**:
- Add new properties to interface
- Set sensible defaults
- Default path follows vdirsyncer conventions

### Step 3: Add Settings UI Controls

**File**: `src/plugin/settings.ts` (ContactsSettingTab class)

**New Section**: Add after "Sync Contacts" section

**UI Elements**:
1. Section header: "External Integrations"
2. Toggle: "Custom vdirsyncer filename"
   - onChange: Toggle visibility of text field, reset path if disabled
3. Text field: "vdirsyncer Config Filename" (conditional)
   - Only visible when toggle is enabled
   - onChange: Check file existence, update button state
4. Description: Brief explanation of vdirsyncer integration
5. Button: "Edit vdirsyncer Config"
   - Disabled when file doesn't exist
   - Opens modal when clicked

**Implementation Pattern**: Follow existing pattern from vcfWatchEnabled toggle

**State Management**:
- Use `this.display()` to refresh UI on toggle change
- Store button reference to update enabled state
- Call `checkConfigExists()` on path change

### Step 4: Create vdirsyncerConfigModal Component

**File**: `src/plugin/ui/modals/vdirsyncerConfigModal.tsx`

**Component Structure**:
```typescript
interface VdirsyncerConfigModalProps {
  filePath: string;
  onClose: () => void;
}

type ModalStatus = 'unchanged' | 'unsaved' | 'saved';

export class VdirsyncerConfigModal extends Modal {
  filePath: string;
  private reactRoot: Root | null = null;
  
  constructor(app: App, filePath: string);
  onOpen(): void;
  onClose(): void;
}
```

**React Component**:
```typescript
const VdirsyncerConfigModalContent: React.FC<VdirsyncerConfigModalProps> = ({
  filePath,
  onClose
}) => {
  const [content, setContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [status, setStatus] = useState<ModalStatus>('unchanged');
  const [savedThisSession, setSavedThisSession] = useState<boolean>(false);
  
  // Status calculation logic
  // Load config on mount
  // Handle reload, save, close buttons
  // Return JSX
}
```

**UI Layout**:
- Title: "vdirsyncer Configuration"
- Status line: Shows current status with appropriate styling
- Textarea: Scrollable, ~20 lines, monospace font
- Button row: [Reload] [Save] [Close]

**Status Logic**:
- Track `originalContent` (loaded from disk)
- Track `savedThisSession` (reset to false on close)
- Calculate status based on:
  - If `content === originalContent` and not `savedThisSession`: "unchanged"
  - If `content !== originalContent`: "unsaved changes"
  - If `content === originalContent` and `savedThisSession`: "saved changes"

**Implementation Pattern**: Follow fileExistsModal.tsx as reference

**Button Handlers**:
- Reload: Call readConfig, update content and originalContent, set status
- Save: Call writeConfig, update originalContent, set savedThisSession
- Close: Call onClose (parent handles modal.close())

### Step 5: Register Obsidian Command

**File**: `src/main.ts` (ContactsPlugin class)

**Command Registration**:
```typescript
this.addCommand({
  id: 'edit-vdirsyncer-config',
  name: 'Edit vdirsyncer config',
  callback: async () => {
    const filePath = VdirsyncerService.expandHomePath(
      this.settings.vdirsyncerCustomFilename
        ? this.settings.vdirsyncerConfigPath
        : DEFAULT_SETTINGS.vdirsyncerConfigPath
    );
    
    const exists = await VdirsyncerService.checkConfigExists(filePath);
    if (!exists) {
      new Notice('vdirsyncer config file not found');
      return;
    }
    
    new VdirsyncerConfigModal(this.app, filePath).open();
  }
});
```

**Implementation Notes**:
- Check file existence before opening modal
- Show Notice if file doesn't exist
- Use expanded path for operations

### Step 6: Create Integration Tests

**File**: `tests/stories/vdirsyncerConfigIntegration.spec.ts`

**Test Scenarios**:

1. **Default Configuration**
   - Verify default settings
   - Verify button disabled when file doesn't exist
   - Create file, verify button enabled

2. **Custom Filename Toggle**
   - Enable custom filename
   - Verify text field appears
   - Change path, verify existence check
   - Disable toggle, verify reset to default

3. **Modal Lifecycle**
   - Open modal with existing file
   - Verify content loaded
   - Verify status is "unchanged"

4. **Edit and Status Changes**
   - Edit textarea content
   - Verify status changes to "unsaved changes"
   - Continue editing, verify status remains "unsaved changes"

5. **Save Operation**
   - Make changes
   - Click Save
   - Verify file written
   - Verify status changes to "saved changes"
   - Make more changes, verify status changes to "unsaved changes"

6. **Reload Operation**
   - Make changes (don't save)
   - Click Reload
   - Verify content reloaded from disk
   - Verify unsaved changes discarded
   - Verify status is "unchanged"

7. **Close and Reopen**
   - Make changes and save
   - Close modal
   - Reopen modal
   - Verify status is "unchanged" (not "saved changes")
   - Verify content loaded from disk

8. **$HOME Expansion**
   - Set path with $HOME
   - Verify expansion to actual home directory
   - Verify file operations use expanded path

9. **Command Execution**
   - Execute command with existing file
   - Verify modal opens
   - Execute command with non-existent file
   - Verify Notice shown, modal doesn't open

10. **File System Edge Cases**
    - Non-existent file
    - Non-existent directory
    - Permission errors (read/write)
    - Empty file

**Testing Pattern**: Follow existing integration test patterns in `tests/stories/`

**Mocking Strategy**:
- Mock file system operations
- Track file state in test
- Verify service calls
- Verify UI state changes

## Technical Considerations

### File System Operations

**Platform Compatibility**:
- Use `os.homedir()` instead of environment variables for cross-platform support
- Handle Windows paths (backslashes) vs Unix paths (forward slashes)
- Test on Windows, macOS, Linux

**Error Handling**:
- File not found: Return null/false, don't throw
- Permission denied: Log error, return null/false
- Invalid path: Validate and handle gracefully

**Security**:
- Don't expose sensitive config content in logs
- Validate file paths to prevent directory traversal
- Only allow reading/writing to specified config path

### UI/UX Considerations

**Status Display**:
- Use color coding for status (e.g., green for "saved", orange for "unsaved")
- Make status prominent but not intrusive
- Clear, concise wording

**Button State**:
- Disable save button when status is "unchanged"
- Keep reload button always enabled
- Keep close button always enabled

**User Feedback**:
- Show Notice on successful save
- Show Notice on errors
- Show Notice when command fails (file not found)

**Modal Behavior**:
- Don't reset textarea on close (preserve user edits)
- Load fresh content on each open (ignore stale edits)
- Support Escape key to close

### Performance

**File Operations**:
- Config files are typically small (<1KB)
- No need for streaming or chunking
- Simple read/write operations are sufficient

**UI Responsiveness**:
- File operations are async, don't block UI
- Show loading state during file operations
- Handle slow file systems gracefully

## Testing Strategy

### Unit Tests

**vdirsyncerService.ts**:
- Test each method independently
- Mock file system
- Test error conditions
- Test edge cases

**Expected Coverage**: >90% for service layer

### Integration Tests

**vdirsyncerConfigIntegration.spec.ts**:
- Test complete user workflows
- Simulate user interactions
- Verify state changes
- Test error paths

**Expected Coverage**: All user stories from requirements

### Manual Testing

**Checklist**:
- [ ] Install plugin with vdirsyncer config feature
- [ ] Test with non-existent config file
- [ ] Create config file, test detection
- [ ] Open modal, verify content
- [ ] Edit content, verify status changes
- [ ] Save changes, verify file written
- [ ] Reload content, verify reload works
- [ ] Close and reopen, verify reset
- [ ] Test custom filename path
- [ ] Test $HOME expansion
- [ ] Test on Windows/macOS/Linux (if possible)
- [ ] Take screenshots of all UI elements

## Implementation Order

1. **Phase 1: Core Service**
   - Create vdirsyncerService.ts
   - Add unit tests
   - Verify file operations work

2. **Phase 2: Settings**
   - Update settings interface
   - Add settings UI controls
   - Test settings persistence

3. **Phase 3: Modal**
   - Create modal component
   - Implement status tracking
   - Add button handlers
   - Test modal behavior

4. **Phase 4: Integration**
   - Register command
   - Connect all components
   - Create integration tests
   - Fix any issues

5. **Phase 5: Validation**
   - Manual testing
   - Screenshot all UI
   - Document behavior
   - Update README if needed

## Success Criteria

- [ ] vdirsyncer config file can be viewed and edited from Obsidian
- [ ] Custom file path configuration works
- [ ] $HOME expansion works correctly
- [ ] File existence checking works
- [ ] Modal status tracking works correctly
- [ ] All buttons (reload/save/close) work as specified
- [ ] Command registration works
- [ ] All integration tests pass
- [ ] Manual testing complete with screenshots
- [ ] Documentation updated

## Risk Mitigation

**Risk**: File system permissions
- Mitigation: Graceful error handling, clear error messages

**Risk**: Platform-specific path issues
- Mitigation: Use Node.js path utilities, test on multiple platforms

**Risk**: Large config files
- Mitigation: Config files are typically small, but add textarea scrolling

**Risk**: Concurrent edits (user edits file externally while modal open)
- Mitigation: Reload button allows user to refresh, status warns of changes

**Risk**: Invalid vdirsyncer syntax
- Mitigation: Out of scope - user responsible for valid config

## Future Enhancements (Out of Scope)

- Syntax highlighting for vdirsyncer config
- Config validation
- Running vdirsyncer commands from Obsidian
- Managing multiple config files
- Config file templates
- Integration with vdirsyncer CLI for status checking
