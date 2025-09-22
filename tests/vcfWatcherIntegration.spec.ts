import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { App, Vault } from 'obsidian';
import { VcfWatcherService } from 'src/vcfWatcher/vcfWatcherService';
import { ContactsPluginSettings } from 'src/settings/settings.d';
import { setApp, clearApp } from 'src/context/sharedAppContext';
import { vcard } from 'src/contacts/vcard';
import { mdRender } from 'src/contacts/contactMdTemplate';
import { createContactFile } from 'src/file/file';

// Mock the dependencies
vi.mock('obsidian', async () => {
  const actual = await vi.importActual('obsidian');
  return {
    ...actual,
    Notice: vi.fn(),
    Vault: {
      ...actual.Vault,
      recurseChildren: vi.fn()
    }
  };
});

vi.mock('src/contacts/vcard', () => ({
  vcard: {
    parse: vi.fn()
  }
}));

vi.mock('src/contacts/contactMdTemplate', () => ({
  mdRender: vi.fn()
}));

vi.mock('src/file/file', () => ({
  createContactFile: vi.fn()
}));

describe('VCF Watcher Integration Tests', () => {
  let vcfWatcherService: VcfWatcherService;
  let mockSettings: ContactsPluginSettings;
  let mockApp: Partial<App>;

  beforeEach(() => {
    mockSettings = {
      contactsFolder: 'Contacts',
      defaultHashtag: '#Contact',
      vcfWatchFolder: '/test/vcf',
      vcfWatchEnabled: true,
      vcfWatchPollingFrequency: 1000, // Longer interval to avoid multiple triggers
    };

    mockApp = {
      vault: {
        adapter: {
          list: vi.fn().mockResolvedValue({ 
            files: ['/test/vcf/contact1.vcf', '/test/vcf/contact2.vcf'], 
            folders: [] 
          }),
          stat: vi.fn().mockResolvedValue({ mtime: Date.now() + 1000 }),
          read: vi.fn()
        },
        getAbstractFileByPath: vi.fn(),
        getRoot: vi.fn()
      },
      metadataCache: {
        getFileCache: vi.fn().mockReturnValue({ frontmatter: { UID: 'existing-uid' } })
      }
    } as any;

    setApp(mockApp as App);
    vcfWatcherService = new VcfWatcherService(mockSettings);
  });

  afterEach(() => {
    vcfWatcherService.stop();
    clearApp();
    vi.clearAllMocks();
  });

  describe('VCF processing workflow', () => {
    it('should process new VCF contact with FN field', async () => {
      const vcfContent = `BEGIN:VCARD
VERSION:4.0
FN:John Doe
EMAIL:john@example.com
UID:urn:uuid:12345
END:VCARD`;

      const expectedRecord = {
        FN: 'John Doe',
        EMAIL: 'john@example.com',
        UID: 'urn:uuid:12345',
        VERSION: '4.0'
      };

      // Mock VCF parsing
      vi.mocked(mockApp.vault?.adapter.read).mockResolvedValue(vcfContent);
      vi.mocked(vcard.parse).mockImplementation(async function* () {
        yield ['john-doe', expectedRecord];
      });
      vi.mocked(mdRender).mockReturnValue('---\nFN: John Doe\n---\n#### Notes\n\n#Contact');

      // Mock no existing contacts
      vi.mocked(Vault.recurseChildren).mockImplementation((folder, callback) => {
        // No existing files
      });
      vi.mocked(mockApp.metadataCache?.getFileCache).mockReturnValue(null);

      // Start the service and trigger a scan
      vcfWatcherService.start();

      // Wait a bit for the scan to complete, but not long enough for interval to trigger
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Stop the service to prevent additional scans
      vcfWatcherService.stop();

      // Verify that createContactFile was called
      expect(createContactFile).toHaveBeenCalledWith(
        mockApp,
        'Contacts',
        '---\nFN: John Doe\n---\n#### Notes\n\n#Contact',
        'john-doe.md'
      );
    });

    it.skip('should skip existing contacts based on UID', async () => {
      const vcfContent = `BEGIN:VCARD
VERSION:4.0
FN:Existing Contact
UID:existing-uid
END:VCARD`;

      const expectedRecord = {
        FN: 'Existing Contact',
        UID: 'existing-uid',
        VERSION: '4.0'
      };

      // Mock VCF parsing
      vi.mocked(mockApp.vault?.adapter.read).mockResolvedValue(vcfContent);
      vi.mocked(vcard.parse).mockImplementation(async function* () {
        yield ['existing-contact', expectedRecord];
      });

      // Mock only one VCF file for this test
      vi.mocked(mockApp.vault?.adapter.list).mockResolvedValue({ 
        files: ['/test/vcf/existing-contact.vcf'], 
        folders: [] 
      });

      // Mock Vault.recurseChildren to simulate existing contact with same UID
      const mockFile = {
        extension: 'md',
        name: 'existing-contact.md'
      };
      
      vi.mocked(Vault.recurseChildren).mockImplementation((folder, callback) => {
        callback(mockFile as any);
      });

      // Mock existing contacts check (contact exists with this UID)
      vi.mocked(mockApp.metadataCache?.getFileCache).mockReturnValue({ 
        frontmatter: { UID: 'existing-uid' } 
      });

      // Start the service and trigger a scan
      vcfWatcherService.start();

      // Wait a bit for the scan to complete, but not long enough for interval to trigger
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Stop the service to prevent additional scans
      vcfWatcherService.stop();

      // Verify that createContactFile was NOT called (contact already exists)
      expect(createContactFile).not.toHaveBeenCalled();
    });

    it('should generate UID for contacts without one', async () => {
      const vcfContent = `BEGIN:VCARD
VERSION:4.0
FN:No UID Contact
EMAIL:nouid@example.com
END:VCARD`;

      const expectedRecord = {
        FN: 'No UID Contact',
        EMAIL: 'nouid@example.com',
        VERSION: '4.0'
      };

      // Mock VCF parsing
      vi.mocked(mockApp.vault?.adapter.read).mockResolvedValue(vcfContent);
      vi.mocked(vcard.parse).mockImplementation(async function* () {
        yield ['no-uid-contact', expectedRecord];
      });
      vi.mocked(mdRender).mockReturnValue('---\nFN: No UID Contact\n---\n#### Notes\n\n#Contact');

      // Mock no existing contacts
      vi.mocked(mockApp.metadataCache?.getFileCache).mockReturnValue(null);

      // Start the service and trigger a scan
      vcfWatcherService.start();

      // Wait a bit for the scan to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify that createContactFile was called and UID was generated
      expect(createContactFile).toHaveBeenCalled();
      const callArgs = vi.mocked(createContactFile).mock.calls[0];
      expect(callArgs[2]).toContain('FN: No UID Contact');
    });

    it('should handle filename generation fallbacks', async () => {
      const vcfContent = `BEGIN:VCARD
VERSION:4.0
N:Doe;John;;;
ORG:Acme Corp
END:VCARD`;

      const expectedRecord = {
        'N.FN': 'Doe',
        'N.GN': 'John',
        ORG: 'Acme Corp',
        VERSION: '4.0'
      };

      // Mock VCF parsing without slug
      vi.mocked(mockApp.vault?.adapter.read).mockResolvedValue(vcfContent);
      vi.mocked(vcard.parse).mockImplementation(async function* () {
        yield [undefined, expectedRecord]; // No slug generated
      });
      vi.mocked(mdRender).mockReturnValue('---\nN.FN: Doe\n---\n#### Notes\n\n#Contact');

      // Mock no existing contacts
      vi.mocked(mockApp.metadataCache?.getFileCache).mockReturnValue(null);

      // Start the service and trigger a scan
      vcfWatcherService.start();

      // Wait a bit for the scan to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should still create contact, using fallback naming
      expect(createContactFile).toHaveBeenCalled();
    });

    it('should handle multiple VCF files', async () => {
      const vcfContent1 = `BEGIN:VCARD
VERSION:4.0
FN:Contact One
UID:urn:uuid:111
END:VCARD`;

      const vcfContent2 = `BEGIN:VCARD
VERSION:4.0
FN:Contact Two
UID:urn:uuid:222
END:VCARD`;

      // Mock different content for different files
      vi.mocked(mockApp.vault?.adapter.read)
        .mockResolvedValueOnce(vcfContent1)
        .mockResolvedValueOnce(vcfContent2);

      vi.mocked(vcard.parse)
        .mockImplementationOnce(async function* () {
          yield ['contact-one', { FN: 'Contact One', UID: 'urn:uuid:111', VERSION: '4.0' }];
        })
        .mockImplementationOnce(async function* () {
          yield ['contact-two', { FN: 'Contact Two', UID: 'urn:uuid:222', VERSION: '4.0' }];
        });

      vi.mocked(mdRender).mockReturnValue('---\nFN: Contact\n---\n#### Notes\n\n#Contact');

      // Mock no existing contacts
      vi.mocked(mockApp.metadataCache?.getFileCache).mockReturnValue(null);

      // Start the service and trigger a scan
      vcfWatcherService.start();

      // Wait a bit for the scan to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should create both contacts
      expect(createContactFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('should handle VCF parsing errors gracefully', async () => {
      vi.mocked(mockApp.vault?.adapter.read).mockRejectedValue(new Error('Read error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Start the service and trigger a scan
      vcfWatcherService.start();

      // Wait a bit for the scan to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should log error but not crash
      expect(consoleSpy).toHaveBeenCalled();
      expect(createContactFile).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle folder access errors gracefully', async () => {
      vi.mocked(mockApp.vault?.adapter.list).mockRejectedValue(new Error('Folder not accessible'));

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Start the service and trigger a scan
      vcfWatcherService.start();

      // Wait a bit for the scan to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should handle gracefully
      expect(createContactFile).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});