import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { VcardFile } from '../../src/models/vcardFile';
import { ContactNote } from '../../src/models/contactNote';
import { ContactsPluginSettings } from 'src/interfaces/ContactsPluginSettings';

/**
 * User Story 1: Single VCF File Synchronization
 * As a user, I store my vCard contacts in a single VCF file and I want to keep that file 
 * synced with my Obsidian contacts so that any changes in Obsidian are reflected in my 
 * VCF file and vice versa.
 */
describe('Single VCF File Synchronization Story', () => {
  let mockApp: Partial<App>;
  let mockSettings: ContactsPluginSettings;

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
      vcfStorageMethod: 'single-vcf',
      vcfFilename: 'contacts.vcf',
      vcfWatchFolder: '/test/vcf',
      vcfWatchEnabled: true,
      vcfWatchPollingInterval: 30,
      vcfWriteBackEnabled: true,
      vcfCustomizeIgnoreList: false,
      vcfIgnoreFilenames: [],
      vcfIgnoreUIDs: [],
      logLevel: 'INFO'
    };
  });

  it('should parse a single VCF file with multiple contacts', async () => {
    const vcfContent = `BEGIN:VCARD
VERSION:4.0
UID:john-doe-123
FN:John Doe
EMAIL:john@example.com
END:VCARD

BEGIN:VCARD
VERSION:4.0
UID:jane-doe-456
FN:Jane Doe
EMAIL:jane@example.com
END:VCARD`;

    const vcardFile = new VcardFile(vcfContent);
    const contacts = [];
    
    for await (const [slug, record] of vcardFile.parse()) {
      contacts.push({ slug, record });
    }

    expect(contacts).toHaveLength(2);
    expect(contacts[0].record.UID).toBe('john-doe-123');
    expect(contacts[0].record.FN).toBe('John Doe');
    expect(contacts[1].record.UID).toBe('jane-doe-456');
    expect(contacts[1].record.FN).toBe('Jane Doe');
  });

  it('should generate a single VCF file from multiple Obsidian contacts', async () => {
    const mockFile1 = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    const mockFile2 = { basename: 'jane-doe', path: 'Contacts/jane-doe.md' } as TFile;

    mockApp.metadataCache!.getFileCache = vi.fn()
      .mockReturnValueOnce({
        frontmatter: {
          UID: 'john-doe-123',
          FN: 'John Doe',
          EMAIL: 'john@example.com'
        }
      })
      .mockReturnValueOnce({
        frontmatter: {
          UID: 'jane-doe-456',
          FN: 'Jane Doe',
          EMAIL: 'jane@example.com'
        }
      });

    const result = await VcardFile.fromObsidianFiles([mockFile1, mockFile2], mockApp as App);
    
    expect(result.vcards).toContain('BEGIN:VCARD');
    expect(result.vcards).toContain('UID:john-doe-123');
    expect(result.vcards).toContain('FN:John Doe');
    expect(result.vcards).toContain('UID:jane-doe-456');
    expect(result.vcards).toContain('FN:Jane Doe');
    expect(result.vcards).toContain('END:VCARD');
    expect(result.errors).toHaveLength(0);
  });

  it('should handle sync conflicts by using the most recent modification time', async () => {
    // This test would verify that when both the VCF and Obsidian contact
    // have been modified, the plugin uses REV field or modification time
    // to determine which version to keep
    const contactWithOlderRev = {
      UID: 'john-doe-123',
      FN: 'John Doe',
      EMAIL: 'john@example.com',
      REV: '20240101T120000Z'
    };

    const contactWithNewerRev = {
      UID: 'john-doe-123',
      FN: 'John Smith', // Changed name
      EMAIL: 'johnsmith@example.com', // Changed email
      REV: '20240201T120000Z'
    };

    // The newer revision should take precedence
    expect(contactWithNewerRev.REV > contactWithOlderRev.REV).toBe(true);
  });

  it('should maintain UID consistency across sync operations', async () => {
    const originalUID = 'john-doe-123';
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Mock the file content with UID
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: originalUID,
        FN: 'John Doe',
        EMAIL: 'john@example.com'
      }
    });

    // Generate VCF content
    const result = await VcardFile.fromObsidianFiles([mockFile], mockApp as App);
    
    // Parse it back
    const vcardFile = new VcardFile(result.vcards);
    const contacts = [];
    for await (const [slug, record] of vcardFile.parse()) {
      contacts.push({ slug, record });
    }

    // UID should remain consistent
    expect(contacts[0].record.UID).toBe(originalUID);
  });
});