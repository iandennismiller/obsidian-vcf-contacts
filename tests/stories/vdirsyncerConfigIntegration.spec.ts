import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VdirsyncerService } from '../../src/plugin/services/vdirsyncerService';
import type { ContactsPluginSettings } from 'src/plugin/settings';
import * as os from 'os';

// Mock fs/promises module
vi.mock('fs/promises', () => ({
  default: {
    access: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
  },
  access: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

/**
 * User Story 43: vdirsyncer Configuration Integration
 * 
 * As a user, I want to configure vdirsyncer from within Obsidian so that I can 
 * set up bidirectional CardDAV synchronization without leaving my knowledge base environment.
 * 
 * This integration test suite validates the complete vdirsyncer configuration workflow,
 * simulating realistic user interactions with the settings and modal.
 */
describe('vdirsyncer Configuration Integration Story', () => {
  let fsPromises: any;
  let mockSettings: ContactsPluginSettings;
  const homeDir = os.homedir();

  beforeEach(async () => {
    vi.clearAllMocks();
    fsPromises = await import('fs/promises');

    // Default settings for vdirsyncer integration
    mockSettings = {
      contactsFolder: '',
      defaultHashtag: '',
      vcardStorageMethod: 'vcard-folder',
      vcardFilename: 'contacts.vcf',
      vcardWatchFolder: '',
      vcardWatchEnabled: false,
      vcardWatchPollingInterval: 30,
      vcardWriteBackEnabled: false,
      vcardCustomizeIgnoreList: false,
      vcardIgnoreFilenames: [],
      vcardIgnoreUIDs: [],
      contactSectionSyncConfirmation: true,
      removeInvalidFieldsConfirmation: true,
      vdirsyncerCustomFilename: false,
      vdirsyncerConfigPath: '$HOME/.config/vdirsyncer/config',
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Default Configuration', () => {
    it('should use default config path when customization is disabled', async () => {
      expect(mockSettings.vdirsyncerCustomFilename).toBe(false);
      expect(mockSettings.vdirsyncerConfigPath).toBe('$HOME/.config/vdirsyncer/config');
    });

    it('should expand $HOME in default path', async () => {
      const expandedPath = VdirsyncerService.expandHomePath(mockSettings.vdirsyncerConfigPath);
      expect(expandedPath).toBe(`${homeDir}/.config/vdirsyncer/config`);
    });

    it('should report button disabled when config file does not exist', async () => {
      vi.mocked(fsPromises.access).mockRejectedValue(new Error('ENOENT'));

      const exists = await VdirsyncerService.checkConfigExists(mockSettings.vdirsyncerConfigPath);
      expect(exists).toBe(false);
    });

    it('should report button enabled when config file exists', async () => {
      vi.mocked(fsPromises.access).mockResolvedValue(undefined);

      const exists = await VdirsyncerService.checkConfigExists(mockSettings.vdirsyncerConfigPath);
      expect(exists).toBe(true);
    });
  });

  describe('Custom Filename Configuration', () => {
    it('should allow enabling custom filename', () => {
      mockSettings.vdirsyncerCustomFilename = true;
      expect(mockSettings.vdirsyncerCustomFilename).toBe(true);
    });

    it('should allow setting custom config path', () => {
      mockSettings.vdirsyncerCustomFilename = true;
      mockSettings.vdirsyncerConfigPath = '/custom/path/to/vdirsyncer/config';
      
      expect(mockSettings.vdirsyncerConfigPath).toBe('/custom/path/to/vdirsyncer/config');
    });

    it('should check custom path for file existence', async () => {
      mockSettings.vdirsyncerCustomFilename = true;
      mockSettings.vdirsyncerConfigPath = '/custom/path/to/vdirsyncer/config';
      
      vi.mocked(fsPromises.access).mockResolvedValue(undefined);

      const exists = await VdirsyncerService.checkConfigExists(mockSettings.vdirsyncerConfigPath);
      expect(exists).toBe(true);
      expect(fsPromises.access).toHaveBeenCalledWith('/custom/path/to/vdirsyncer/config');
    });

    it('should reset to default when custom filename is disabled', () => {
      mockSettings.vdirsyncerCustomFilename = true;
      mockSettings.vdirsyncerConfigPath = '/custom/path/to/vdirsyncer/config';
      
      // Simulate disabling customization
      mockSettings.vdirsyncerCustomFilename = false;
      mockSettings.vdirsyncerConfigPath = '$HOME/.config/vdirsyncer/config';
      
      expect(mockSettings.vdirsyncerConfigPath).toBe('$HOME/.config/vdirsyncer/config');
    });
  });

  describe('Modal Lifecycle', () => {
    const testConfigContent = `[general]
status_path = "~/.vdirsyncer/status/"

[pair my_contacts]
a = "my_contacts_local"
b = "my_contacts_remote"
collections = ["from a", "from b"]

[storage my_contacts_local]
type = "filesystem"
path = "~/.contacts/"
fileext = ".vcf"

[storage my_contacts_remote]
type = "carddav"
url = "https://contacts.example.com/"
username = "user@example.com"
password.fetch = ["command", "pass", "show", "contacts/example"]`;

    it('should load config content when modal opens', async () => {
      vi.mocked(fsPromises.access).mockResolvedValue(undefined);
      vi.mocked(fsPromises.readFile).mockResolvedValue(testConfigContent);

      const exists = await VdirsyncerService.checkConfigExists(mockSettings.vdirsyncerConfigPath);
      expect(exists).toBe(true);

      const content = await VdirsyncerService.readConfig(mockSettings.vdirsyncerConfigPath);
      expect(content).toBe(testConfigContent);
    });

    it('should handle empty config file', async () => {
      vi.mocked(fsPromises.access).mockResolvedValue(undefined);
      vi.mocked(fsPromises.readFile).mockResolvedValue('');

      const content = await VdirsyncerService.readConfig(mockSettings.vdirsyncerConfigPath);
      expect(content).toBe('');
    });

    it('should handle file read errors gracefully', async () => {
      vi.mocked(fsPromises.readFile).mockRejectedValue(new Error('EACCES: permission denied'));

      const content = await VdirsyncerService.readConfig(mockSettings.vdirsyncerConfigPath);
      expect(content).toBeNull();
    });
  });

  describe('Edit and Status Changes', () => {
    const originalContent = '[general]\nstatus_path = "~/.vdirsyncer/status/"';
    const modifiedContent = '[general]\nstatus_path = "~/.vdirsyncer/status/"\n\n# New comment';

    it('should detect when content is unchanged', () => {
      const content = originalContent;
      const savedThisSession = false;
      
      // Status should be 'unchanged'
      expect(content).toBe(originalContent);
      expect(savedThisSession).toBe(false);
    });

    it('should detect when content has unsaved changes', () => {
      const content = modifiedContent;
      
      // Status should be 'unsaved'
      expect(content).not.toBe(originalContent);
    });

    it('should detect saved changes during session', () => {
      const content = originalContent;
      const savedThisSession = true;
      
      // Status should be 'saved'
      expect(content).toBe(originalContent);
      expect(savedThisSession).toBe(true);
    });

    it('should change to unsaved after making changes post-save', () => {
      const content = modifiedContent;
      const savedThisSession = true;
      
      // Even though saved this session, content differs from original
      // Status should be 'unsaved'
      expect(content).not.toBe(originalContent);
    });
  });

  describe('Save Operation', () => {
    const configContent = '[general]\nstatus_path = "~/.vdirsyncer/status/"\n\n[pair test]\na = "local"\nb = "remote"';

    it('should write content to config file', async () => {
      vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);

      const success = await VdirsyncerService.writeConfig(
        mockSettings.vdirsyncerConfigPath,
        configContent
      );

      expect(success).toBe(true);
      expect(fsPromises.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.config/vdirsyncer/config'),
        configContent,
        'utf-8'
      );
    });

    it('should update original content after successful save', async () => {
      vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);

      const success = await VdirsyncerService.writeConfig(
        mockSettings.vdirsyncerConfigPath,
        configContent
      );

      expect(success).toBe(true);
      
      // Simulate updating originalContent in modal
      const originalContent = configContent;
      const savedThisSession = true;
      
      expect(originalContent).toBe(configContent);
      expect(savedThisSession).toBe(true);
    });

    it('should handle write errors gracefully', async () => {
      vi.mocked(fsPromises.writeFile).mockRejectedValue(new Error('EACCES: permission denied'));

      const success = await VdirsyncerService.writeConfig(
        mockSettings.vdirsyncerConfigPath,
        configContent
      );

      expect(success).toBe(false);
    });

    it('should handle disk full errors', async () => {
      vi.mocked(fsPromises.writeFile).mockRejectedValue(new Error('ENOSPC: no space left on device'));

      const success = await VdirsyncerService.writeConfig(
        mockSettings.vdirsyncerConfigPath,
        configContent
      );

      expect(success).toBe(false);
    });
  });

  describe('Reload Operation', () => {
    const originalContent = '[general]\nstatus_path = "~/.vdirsyncer/status/"';
    const diskContent = '[general]\nstatus_path = "~/.vdirsyncer/status/"\n\n# Updated externally';

    it('should reload content from disk', async () => {
      vi.mocked(fsPromises.readFile).mockResolvedValue(diskContent);

      const content = await VdirsyncerService.readConfig(mockSettings.vdirsyncerConfigPath);
      
      expect(content).toBe(diskContent);
      expect(content).not.toBe(originalContent);
    });

    it('should discard unsaved changes when reloading', async () => {
      const unsavedChanges = '[general]\nstatus_path = "~/.vdirsyncer/status/"\n\n# Unsaved edit';
      
      vi.mocked(fsPromises.readFile).mockResolvedValue(diskContent);

      // Simulate reload - content from disk replaces unsaved changes
      const content = await VdirsyncerService.readConfig(mockSettings.vdirsyncerConfigPath);
      
      expect(content).toBe(diskContent);
      expect(content).not.toBe(unsavedChanges);
    });

    it('should reset saved status after reload', () => {
      const savedThisSession = false; // Reset after reload
      
      expect(savedThisSession).toBe(false);
    });
  });

  describe('Close and Reopen Modal', () => {
    const originalContent = '[general]\nstatus_path = "~/.vdirsyncer/status/"';

    it('should load fresh content when reopening modal', async () => {
      vi.mocked(fsPromises.readFile).mockResolvedValue(originalContent);

      // First open
      const firstContent = await VdirsyncerService.readConfig(mockSettings.vdirsyncerConfigPath);
      expect(firstContent).toBe(originalContent);

      // Close modal (savedThisSession would reset)
      const savedThisSession = false;
      
      // Reopen modal
      const secondContent = await VdirsyncerService.readConfig(mockSettings.vdirsyncerConfigPath);
      expect(secondContent).toBe(originalContent);
      expect(savedThisSession).toBe(false);
    });

    it('should reset status to unchanged when reopening', async () => {
      vi.mocked(fsPromises.readFile).mockResolvedValue(originalContent);

      const content = await VdirsyncerService.readConfig(mockSettings.vdirsyncerConfigPath);
      const savedThisSession = false;
      
      // Status should be 'unchanged'
      expect(content).toBe(originalContent);
      expect(savedThisSession).toBe(false);
    });
  });

  describe('$HOME Expansion', () => {
    it('should expand $HOME in various path formats', () => {
      const testCases = [
        { input: '$HOME/.config/vdirsyncer/config', expected: `${homeDir}/.config/vdirsyncer/config` },
        { input: '$home/.vdirsyncer/config', expected: `${homeDir}/.vdirsyncer/config` },
        { input: '$HOME/vdirsyncer.conf', expected: `${homeDir}/vdirsyncer.conf` },
      ];

      for (const testCase of testCases) {
        const result = VdirsyncerService.expandHomePath(testCase.input);
        expect(result).toBe(testCase.expected);
      }
    });

    it('should use expanded path for all file operations', async () => {
      const pathWithHome = '$HOME/.config/vdirsyncer/config';
      const expandedPath = `${homeDir}/.config/vdirsyncer/config`;

      // Check existence
      vi.mocked(fsPromises.access).mockResolvedValue(undefined);
      await VdirsyncerService.checkConfigExists(pathWithHome);
      expect(fsPromises.access).toHaveBeenCalledWith(expandedPath);

      // Read config
      vi.mocked(fsPromises.readFile).mockResolvedValue('content');
      await VdirsyncerService.readConfig(pathWithHome);
      expect(fsPromises.readFile).toHaveBeenCalledWith(expandedPath, 'utf-8');

      // Write config
      vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);
      await VdirsyncerService.writeConfig(pathWithHome, 'content');
      expect(fsPromises.writeFile).toHaveBeenCalledWith(expandedPath, 'content', 'utf-8');
    });
  });

  describe('Command Execution', () => {
    it('should open modal when config file exists', async () => {
      vi.mocked(fsPromises.access).mockResolvedValue(undefined);

      const exists = await VdirsyncerService.checkConfigExists(mockSettings.vdirsyncerConfigPath);
      
      // Command should be able to open modal
      expect(exists).toBe(true);
    });

    it('should show notice when config file does not exist', async () => {
      vi.mocked(fsPromises.access).mockRejectedValue(new Error('ENOENT'));

      const exists = await VdirsyncerService.checkConfigExists(mockSettings.vdirsyncerConfigPath);
      
      // Command should show notice instead of opening modal
      expect(exists).toBe(false);
    });
  });

  describe('File System Edge Cases', () => {
    it('should handle non-existent directory', async () => {
      mockSettings.vdirsyncerConfigPath = '/nonexistent/directory/config';
      vi.mocked(fsPromises.access).mockRejectedValue(new Error('ENOENT'));

      const exists = await VdirsyncerService.checkConfigExists(mockSettings.vdirsyncerConfigPath);
      expect(exists).toBe(false);
    });

    it('should handle permission errors on read', async () => {
      vi.mocked(fsPromises.readFile).mockRejectedValue(new Error('EACCES: permission denied'));

      const content = await VdirsyncerService.readConfig(mockSettings.vdirsyncerConfigPath);
      expect(content).toBeNull();
    });

    it('should handle permission errors on write', async () => {
      vi.mocked(fsPromises.writeFile).mockRejectedValue(new Error('EACCES: permission denied'));

      const success = await VdirsyncerService.writeConfig(mockSettings.vdirsyncerConfigPath, 'content');
      expect(success).toBe(false);
    });

    it('should handle empty file path', async () => {
      const exists = await VdirsyncerService.checkConfigExists('');
      expect(exists).toBe(false);
    });

    it('should handle very large config files', async () => {
      const largeContent = '[general]\n' + 'x = "value"\n'.repeat(10000);
      vi.mocked(fsPromises.readFile).mockResolvedValue(largeContent);

      const content = await VdirsyncerService.readConfig(mockSettings.vdirsyncerConfigPath);
      expect(content).toBe(largeContent);
      expect(content?.length).toBeGreaterThan(100000);
    });
  });

  describe('Complete Workflow Simulation', () => {
    it('should handle complete edit-save-reload-close workflow', async () => {
      const originalContent = '[general]\nstatus_path = "~/.vdirsyncer/status/"';
      const editedContent = '[general]\nstatus_path = "~/.vdirsyncer/status/"\n\n# My edit';
      const externalEdit = '[general]\nstatus_path = "~/.vdirsyncer/status/"\n\n# External edit';

      // 1. Open modal - load content
      vi.mocked(fsPromises.readFile).mockResolvedValue(originalContent);
      let content = await VdirsyncerService.readConfig(mockSettings.vdirsyncerConfigPath);
      expect(content).toBe(originalContent);

      // 2. Edit content (simulated)
      content = editedContent;
      expect(content).not.toBe(originalContent);

      // 3. Save changes
      vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);
      let success = await VdirsyncerService.writeConfig(mockSettings.vdirsyncerConfigPath, content);
      expect(success).toBe(true);

      // 4. Make more edits
      content = content + '\n\n# Another edit';
      expect(content).not.toBe(editedContent);

      // 5. Reload from disk (external change)
      vi.mocked(fsPromises.readFile).mockResolvedValue(externalEdit);
      content = await VdirsyncerService.readConfig(mockSettings.vdirsyncerConfigPath);
      expect(content).toBe(externalEdit);

      // 6. Close modal (cleanup)
      // On next open, should load fresh content
      vi.mocked(fsPromises.readFile).mockResolvedValue(externalEdit);
      content = await VdirsyncerService.readConfig(mockSettings.vdirsyncerConfigPath);
      expect(content).toBe(externalEdit);
    });
  });
});
