# External Integration User Stories

Stories related to integrating with external tools and services.

## 43. vdirsyncer Configuration Integration

**As a user**, I want to configure vdirsyncer from within Obsidian so that I can set up bidirectional CardDAV synchronization without leaving my knowledge base environment.

**Context**: [vdirsyncer](https://github.com/pimutils/vdirsyncer) is an open source utility that enables vCard files (.VCF) to be bidirectionally synced via CardDAV with popular mail services and connected devices. Since vcard sync is complex and requires an always-on utility service, full vdirsyncer integration is beyond the scope of this plugin. However, the plugin provides a quality-of-life improvement by allowing users to view and edit the vdirsyncer config file from within Obsidian.

**Configuration:**
- Setting: "Custom vdirsyncer filename" toggle
  - When disabled: Uses default path `$HOME/.config/vdirsyncer/config`
  - When enabled: Reveals text field to customize config file path
  - Auto-expands `$HOME` to user's home directory
- Setting: "vdirsyncer Config Filename" text field
  - Only visible when customization is enabled
  - Changes trigger immediate file existence check
  - Updates button state based on file existence

**Settings UI:**
- Toggle labeled "Custom vdirsyncer filename"
- Text field for config path (conditionally visible)
- Button labeled "Edit vdirsyncer Config"
  - Enabled when config file exists
  - Disabled/grayed out when file doesn't exist
  - Includes brief explanation about file existence requirement

**vdirsyncer Config Modal:**

The modal provides a simple editor for the vdirsyncer config file with the following features:

*Layout:*
- Modal title: "vdirsyncer Configuration"
- Status line in header showing current state
- Scrolling textarea (~20 lines visible) with config file contents
- Button row at bottom: Reload | Save | Close

*Status States:*
- **"unchanged"**: Textarea content matches file on disk
  - Initial state when modal opens
  - State after successful save
  - State after reload
- **"unsaved changes"**: Textarea content differs from file on disk
  - Triggered by any edit to textarea
  - Persists until save or reload
  - Can occur after save if user continues editing
- **"saved changes"**: File was saved during this modal session
  - Triggered by clicking Save button
  - Only during current modal session (not persistent)
  - Resets to "unchanged" on modal close/reopen

*Buttons:*
- **Reload**: Reloads config from disk, updates textarea, doesn't close modal
- **Save**: Writes textarea content to file, doesn't close modal
- **Close**: Closes modal without resetting textarea content
- Clicking outside modal behaves same as Close button

*Obsidian Command:*
- Command: "Edit vdirsyncer config"
- Opens the vdirsyncer config modal
- Only available when config file exists

**Expected Behavior:**

1. **Default Configuration**:
   - Custom filename toggle is disabled by default
   - Config path defaults to `$HOME/.config/vdirsyncer/config`
   - $HOME expands to actual user home directory
   - Button is disabled if file doesn't exist

2. **Enabling Custom Filename**:
   - Toggle "Custom vdirsyncer filename" to enabled
   - Text field appears with default path
   - User can edit path
   - Each change triggers file existence check
   - Button state updates based on existence

3. **Disabling Custom Filename**:
   - Toggle "Custom vdirsyncer filename" to disabled
   - Text field hides
   - Path resets to default `$HOME/.config/vdirsyncer/config`
   - Button state updates based on default file existence

4. **Opening Modal**:
   - Click "Edit vdirsyncer Config" button
   - Modal opens with file contents in textarea
   - Status shows "unchanged"
   - All buttons are enabled

5. **Editing in Modal**:
   - Type in textarea
   - Status changes to "unsaved changes"
   - Changes remain in textarea even after save/reload

6. **Saving Changes**:
   - Click Save button
   - Content writes to file
   - Status changes to "saved changes"
   - Modal remains open
   - Further edits change status to "unsaved changes"

7. **Reloading from Disk**:
   - Click Reload button
   - Textarea updates with disk content
   - Status changes to "unchanged"
   - Modal remains open
   - Unsaved changes are discarded

8. **Closing Modal**:
   - Click Close or click outside modal
   - Modal closes
   - Textarea content is not reset
   - Next open loads fresh content from disk
   - Status resets to "unchanged" on next open

**Technical Implementation:**
- Service file: `src/plugin/services/vdirsyncerService.ts`
  - Method: `checkConfigExists(filePath: string): Promise<boolean>`
  - Method: `expandHomePath(filePath: string): string`
  - Method: `readConfig(filePath: string): Promise<string | null>`
  - Method: `writeConfig(filePath: string, content: string): Promise<boolean>`
- Settings interface: `ContactsPluginSettings`
  - Property: `vdirsyncerCustomFilename: boolean` (default: false)
  - Property: `vdirsyncerConfigPath: string` (default: "$HOME/.config/vdirsyncer/config")
- Modal component: `src/plugin/ui/modals/vdirsyncerConfigModal.tsx`
  - React-based modal with controlled textarea
  - State tracking for status (unchanged/unsaved/saved)
  - Button handlers for reload/save/close
- Settings UI: `src/plugin/settings.ts`
  - Toggle for custom filename
  - Conditional text field
  - Button with dynamic enabled/disabled state
  - File existence checking on change
- Command registration in main plugin file

**Integration Testing:**

Test scenarios simulating user workflows:
1. Default config with non-existent file (button disabled)
2. Default config with existing file (button enabled, modal opens)
3. Enable custom filename, set to existing file, open modal
4. Edit content in modal, verify status changes
5. Save changes, verify file written, status updates
6. Reload content, verify disk content loaded, status updates
7. Make changes after save, verify status changes to unsaved
8. Close and reopen modal, verify status resets to unchanged
9. Disable custom filename, verify reset to default path
10. File existence checking on path changes

**Test Location**: `tests/stories/vdirsyncerIntegration.spec.ts`

---

**Related Specifications**: 
- [External Integration Specification](../specifications/external-integration-spec.md)
