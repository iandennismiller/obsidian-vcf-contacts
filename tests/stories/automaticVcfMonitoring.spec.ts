import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { VcardManager } from '../../src/models/vcardManager';
import { ContactsPluginSettings } from 'src/plugin/settings';

/**
 * User Story 4: Automatic VCF Monitoring
 * As a user, I want the plugin to monitor my VCF watch folder for changes and 
 * automatically update my Obsidian contacts when VCF files are modified externally.
 */
describe('Automatic VCF Monitoring Story', () => {
  let mockApp: Partial<App>;
  let mockSettings: ContactsPluginSettings;
  let vcardManager: VcardManager;

  beforeEach(() => {
    mockApp = {
      vault: {
        read: vi.fn(),
        modify: vi.fn(),
        create: vi.fn(),
        getMarkdownFiles: vi.fn(),
        getAbstractFileByPath: vi.fn()
      } as any,
      metadataCache: {
        getFileCache: vi.fn()
      } as any
    };

    mockSettings = {
      contactsFolder: 'Contacts',
      defaultHashtag: '#Contact',
      vcfStorageMethod: 'vcf-folder',
      vcfFilename: 'contacts.vcf',
      vcfWatchFolder: '/test/vcf',
      vcfWatchEnabled: true,
      vcfWatchPollingInterval: 30,
      vcfWriteBackEnabled: false,
      vcfCustomizeIgnoreList: false,
      vcfIgnoreFilenames: [],
      vcfIgnoreUIDs: [],
      logLevel: 'INFO'
    };

    vcardManager = new VcardManager(mockSettings);
  });

  it('should have VCF monitoring enabled when configured', () => {
    expect(mockSettings.vcfWatchEnabled).toBe(true);
    expect(mockSettings.vcfWatchFolder).toBe('/test/vcf');
    expect(mockSettings.vcfWatchPollingInterval).toBe(30);
    expect(vcardManager.isMonitoringEnabled()).toBe(true);
  });

  it('should detect when VCF files are added to watch folder', async () => {
    // Simulate a new VCF file being added to the watch folder
    const newVcfContent = `BEGIN:VCARD
VERSION:4.0
UID:new-contact-123
FN:New Contact
EMAIL:new@example.com
END:VCARD`;

    const newVcfFile = {
      path: '/test/vcf/new-contact.vcf',
      content: newVcfContent,
      lastModified: Date.now()
    };

    // Mock file system watch detection
    const watchResult = await vcardManager.processNewFile(newVcfFile.path, newVcfFile.content);
    
    expect(watchResult.processed).toBe(true);
    expect(watchResult.action).toBe('create');
    expect(watchResult.contactUID).toBe('new-contact-123');
  });

  it('should detect when existing VCF files are modified in watch folder', async () => {
    const originalVcfContent = `BEGIN:VCARD
VERSION:4.0
UID:existing-contact-123
FN:John Doe
EMAIL:john@example.com
REV:20240101T120000Z
END:VCARD`;

    const modifiedVcfContent = `BEGIN:VCARD
VERSION:4.0
UID:existing-contact-123
FN:John Smith
EMAIL:johnsmith@example.com
REV:20240201T120000Z
END:VCARD`;

    const modifiedFile = {
      path: '/test/vcf/existing-contact.vcf',
      originalContent: originalVcfContent,
      modifiedContent: modifiedVcfContent,
      lastModified: Date.now()
    };

    // Mock existing contact in Obsidian
    const existingContactFile = { 
      basename: 'john-doe', 
      path: 'Contacts/john-doe.md' 
    } as TFile;
    
    mockApp.vault!.getMarkdownFiles = vi.fn().mockReturnValue([existingContactFile]);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'existing-contact-123',
        FN: 'John Doe',
        EMAIL: 'john@example.com',
        REV: '20240101T120000Z'
      }
    });

    const watchResult = await vcardManager.processModifiedFile(
      modifiedFile.path, 
      modifiedFile.modifiedContent
    );

    expect(watchResult.processed).toBe(true);
    expect(watchResult.action).toBe('update');
    expect(watchResult.contactUID).toBe('existing-contact-123');
    // Should detect that the VCF has newer REV timestamp
    expect(watchResult.hasNewer).toBe(true);
  });

  it('should detect when VCF files are deleted from watch folder', async () => {
    const deletedFile = {
      path: '/test/vcf/deleted-contact.vcf',
      uid: 'deleted-contact-123'
    };

    // Mock existing contact in Obsidian that should be cleaned up
    const existingContactFile = { 
      basename: 'deleted-contact', 
      path: 'Contacts/deleted-contact.md' 
    } as TFile;
    
    mockApp.vault!.getMarkdownFiles = vi.fn().mockReturnValue([existingContactFile]);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'deleted-contact-123',
        FN: 'Deleted Contact'
      }
    });

    const watchResult = await vcardManager.processDeletedFile(deletedFile.path, deletedFile.uid);

    expect(watchResult.processed).toBe(true);
    expect(watchResult.action).toBe('delete');
    expect(watchResult.contactUID).toBe('deleted-contact-123');
  });

  it('should respect ignore list settings during monitoring', async () => {
    // Configure ignore list
    mockSettings.vcfCustomizeIgnoreList = true;
    mockSettings.vcfIgnoreFilenames = ['temp.vcf', 'backup.vcf'];
    mockSettings.vcfIgnoreUIDs = ['ignored-uid-123'];

    const ignoredByFilename = {
      path: '/test/vcf/temp.vcf',
      content: `BEGIN:VCARD
VERSION:4.0
UID:temp-contact-123
FN:Temp Contact
END:VCARD`
    };

    const ignoredByUID = {
      path: '/test/vcf/ignored-contact.vcf',
      content: `BEGIN:VCARD
VERSION:4.0
UID:ignored-uid-123
FN:Ignored Contact
END:VCARD`
    };

    // Both should be ignored
    const filenameResult = await vcardManager.shouldIgnoreFile(ignoredByFilename.path);
    const uidResult = await vcardManager.shouldIgnoreUID('ignored-uid-123');

    expect(filenameResult).toBe(true);
    expect(uidResult).toBe(true);
  });

  it('should handle polling interval configuration', () => {
    // Test different polling intervals
    const testIntervals = [5, 30, 60, 300]; // seconds

    testIntervals.forEach(interval => {
      mockSettings.vcfWatchPollingInterval = interval;
      const vcManager = new VcardManager(mockSettings);
      
      expect(vcManager.getPollingInterval()).toBe(interval * 1000); // Should convert to milliseconds
    });
  });

  it('should handle concurrent file changes gracefully', async () => {
    // Simulate multiple files being changed simultaneously
    const concurrentChanges = [
      {
        path: '/test/vcf/contact1.vcf',
        content: `BEGIN:VCARD\nVERSION:4.0\nUID:contact1-123\nFN:Contact 1\nEND:VCARD`
      },
      {
        path: '/test/vcf/contact2.vcf',
        content: `BEGIN:VCARD\nVERSION:4.0\nUID:contact2-456\nFN:Contact 2\nEND:VCARD`
      },
      {
        path: '/test/vcf/contact3.vcf',
        content: `BEGIN:VCARD\nVERSION:4.0\nUID:contact3-789\nFN:Contact 3\nEND:VCARD`
      }
    ];

    // Process all changes concurrently
    const results = await Promise.all(
      concurrentChanges.map(change => 
        vcardManager.processNewFile(change.path, change.content)
      )
    );

    // All should be processed successfully
    expect(results).toHaveLength(3);
    results.forEach(result => {
      expect(result.processed).toBe(true);
      expect(result.action).toBe('create');
    });
  });

  it('should stop monitoring when disabled', () => {
    // Start with monitoring enabled
    expect(vcardManager.isMonitoringEnabled()).toBe(true);

    // Disable monitoring
    mockSettings.vcfWatchEnabled = false;
    const vcManager = new VcardManager(mockSettings);
    
    expect(vcManager.isMonitoringEnabled()).toBe(false);
  });

  it('should handle file system errors during monitoring', async () => {
    // Simulate file system errors
    const errorScenarios = [
      { error: 'ENOENT', description: 'File not found' },
      { error: 'EACCES', description: 'Permission denied' },
      { error: 'EMFILE', description: 'Too many open files' }
    ];

    for (const scenario of errorScenarios) {
      const result = await vcardManager.handleFileSystemError(scenario.error, '/test/vcf/error.vcf');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain(scenario.error);
      expect(result.recovered).toBe(false);
    }
  });

  it('should validate VCF content before processing changes', async () => {
    // Test with invalid VCF content
    const invalidVcfContent = `INVALID VCARD CONTENT
This is not a valid VCF file
Missing BEGIN and END tags`;

    const validationResult = await vcardManager.validateVcfContent(invalidVcfContent);
    
    expect(validationResult.isValid).toBe(false);
    expect(validationResult.errors).toContain('Missing BEGIN:VCARD');
    expect(validationResult.errors).toContain('Missing END:VCARD');

    // Should not process invalid content
    const processResult = await vcardManager.processNewFile('/test/vcf/invalid.vcf', invalidVcfContent);
    expect(processResult.processed).toBe(false);
    expect(processResult.error).toContain('Invalid VCF content');
  });
});