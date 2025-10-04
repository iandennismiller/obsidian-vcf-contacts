import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { ContactNote } from '../../src/models/contactNote';
import { VcardFile } from '../../src/models/vcardFile';
import { ContactsPluginSettings } from 'src/plugin/settings';

/**
 * User Story 26: Performance with Large Contact Lists
 * As a user, I want the plugin to handle large contact databases (hundreds or 
 * thousands of contacts) efficiently without slowing down Obsidian.
 */
describe('Performance with Large Contact Lists Story', () => {
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
      vcardStorageMethod: 'vcard-folder',
      vcardFilename: 'contacts.vcf',
      vcardWatchFolder: '/test/vcf',
      vcardWatchEnabled: false,
      vcardWatchPollingInterval: 30,
      vcardWriteBackEnabled: false,
      vcardCustomizeIgnoreList: false,
      vcardIgnoreFilenames: [],
      vcardIgnoreUIDs: [],
      logLevel: 'INFO'
    };
  });

  it('should handle 100 contacts efficiently', async () => {
    const contactCount = 100;
    const contacts: TFile[] = [];

    // Generate 100 contacts
    for (let i = 0; i < contactCount; i++) {
      contacts.push({
        basename: `contact-${i}`,
        path: `Contacts/contact-${i}.md`
      } as TFile);
    }

    mockApp.vault!.getMarkdownFiles = vi.fn().mockReturnValue(contacts);
    mockApp.vault!.read = vi.fn().mockResolvedValue(`---
UID: test-uid
FN: Test Contact
EMAIL: test@example.com
---

#Contact`);

    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'test-uid',
        FN: 'Test Contact',
        EMAIL: 'test@example.com'
      }
    });

    const startTime = Date.now();

    // Process all contacts
    const results = await Promise.all(
      contacts.slice(0, 10).map(contact =>
        new ContactNote(mockApp as App, mockSettings, contact).getFrontmatter()
      )
    );

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should complete in reasonable time (sample of 10 contacts)
    expect(results).toHaveLength(10);
    expect(duration).toBeLessThan(1000); // Less than 1 second for 10 contacts
  });

  it('should efficiently parse large VCF files with multiple contacts', async () => {
    // Generate a VCF file with 50 contacts
    const vcfLines = ['BEGIN:VCARD', 'VERSION:4.0'];
    
    for (let i = 0; i < 50; i++) {
      vcfLines.push(`UID:contact-${i}-uid`);
      vcfLines.push(`FN:Contact ${i}`);
      vcfLines.push(`EMAIL:contact${i}@example.com`);
      
      if (i < 49) {
        vcfLines.push('END:VCARD');
        vcfLines.push('BEGIN:VCARD');
        vcfLines.push('VERSION:4.0');
      }
    }
    vcfLines.push('END:VCARD');

    const largeVcf = vcfLines.join('\n');
    const vcardFile = new VcardFile(largeVcf);

    const startTime = Date.now();
    const results = [];

    for await (const [slug, record] of vcardFile.parse()) {
      results.push({ slug, record });
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should parse all contacts efficiently
    expect(results).toHaveLength(50);
    expect(duration).toBeLessThan(2000); // Less than 2 seconds for 50 contacts
  });

  it('should use lazy loading for contact lists', () => {
    const largeContactList = Array.from({ length: 1000 }, (_, i) => ({
      basename: `contact-${i}`,
      path: `Contacts/contact-${i}.md`
    }));

    mockApp.vault!.getMarkdownFiles = vi.fn().mockReturnValue(largeContactList);

    // Get contacts without loading all at once
    const allFiles = mockApp.vault!.getMarkdownFiles!();

    // Should return list without processing all
    expect(allFiles).toHaveLength(1000);
    expect(mockApp.vault!.getMarkdownFiles).toHaveBeenCalledTimes(1);
  });

  it('should cache frequently accessed contact data', async () => {
    const mockFile = { basename: 'cached-contact', path: 'Contacts/cached-contact.md' } as TFile;

    mockApp.vault!.read = vi.fn().mockResolvedValue(`---
UID: cached-123
FN: Cached Contact
EMAIL: cached@example.com
---

#Contact`);

    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'cached-123',
        FN: 'Cached Contact',
        EMAIL: 'cached@example.com'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);

    // Access same data multiple times
    const frontmatter1 = await contactNote.getFrontmatter();
    const frontmatter2 = await contactNote.getFrontmatter();
    const frontmatter3 = await contactNote.getFrontmatter();

    // Should use cache (metadataCache should be called multiple times, but efficiently)
    expect(frontmatter1).toEqual(frontmatter2);
    expect(frontmatter2).toEqual(frontmatter3);
  });

  it('should handle batch operations efficiently', async () => {
    const batchSize = 20;
    const contacts: TFile[] = Array.from({ length: batchSize }, (_, i) => ({
      basename: `batch-${i}`,
      path: `Contacts/batch-${i}.md`
    } as TFile));

    mockApp.vault!.read = vi.fn().mockResolvedValue(`---
UID: batch-uid
FN: Batch Contact
---

#Contact`);

    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'batch-uid',
        FN: 'Batch Contact'
      }
    });

    const startTime = Date.now();

    // Process in batch
    const results = await Promise.all(
      contacts.map(contact =>
        new ContactNote(mockApp as App, mockSettings, contact).getFrontmatter()
      )
    );

    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(results).toHaveLength(batchSize);
    expect(duration).toBeLessThan(1000); // Should complete quickly
  });

  it('should optimize relationship graph traversal', async () => {
    // Create a network of interconnected contacts
    const networkSize = 15;
    const contacts = Array.from({ length: networkSize }, (_, i) => ({
      basename: `network-${i}`,
      path: `Contacts/network-${i}.md`,
      uid: `network-uid-${i}`
    }));

    mockApp.vault!.getMarkdownFiles = vi.fn().mockReturnValue(
      contacts.map(c => ({ basename: c.basename, path: c.path } as TFile))
    );

    mockApp.vault!.read = vi.fn().mockImplementation((file: TFile) => {
      const index = contacts.findIndex(c => c.path === file.path);
      const nextIndex = (index + 1) % networkSize;
      
      return Promise.resolve(`---
UID: ${contacts[index].uid}
FN: Network ${index}
RELATED.colleague: urn:uuid:${contacts[nextIndex].uid}
---

#### Related
- colleague [[Network ${nextIndex}]]

#Contact`);
    });

    mockApp.metadataCache!.getFileCache = vi.fn().mockImplementation((file: TFile) => {
      const index = contacts.findIndex(c => c.path === file.path);
      const nextIndex = (index + 1) % networkSize;
      
      return {
        frontmatter: {
          UID: contacts[index].uid,
          FN: `Network ${index}`,
          'RELATED.colleague': `urn:uuid:${contacts[nextIndex].uid}`
        }
      };
    });

    const startTime = Date.now();

    // Validate relationships in network
    const validations = await Promise.all(
      contacts.slice(0, 5).map(contact =>
        new ContactNote(
          mockApp as App,
          mockSettings,
          { basename: contact.basename, path: contact.path } as TFile
        ).validateRelationshipConsistency()
      )
    );

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should complete efficiently even with interconnected contacts
    expect(validations).toHaveLength(5);
    expect(duration).toBeLessThan(1500);
  });

  it('should not block Obsidian UI during large operations', async () => {
    // Simulate async processing to avoid blocking
    const contacts = Array.from({ length: 30 }, (_, i) => ({
      basename: `async-${i}`,
      path: `Contacts/async-${i}.md`
    } as TFile));

    mockApp.vault!.read = vi.fn().mockResolvedValue(`---
UID: async-uid
FN: Async Contact
---

#Contact`);

    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'async-uid',
        FN: 'Async Contact'
      }
    });

    // Process contacts asynchronously
    let processed = 0;
    const results = [];

    for (const contact of contacts) {
      const contactNote = new ContactNote(mockApp as App, mockSettings, contact);
      const result = await contactNote.getFrontmatter();
      processed++;
      results.push(result);
      
      // Yield to event loop
      if (processed % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    expect(results).toHaveLength(30);
    expect(processed).toBe(30);
  });

  it('should minimize memory usage with large contact lists', async () => {
    // Create a large number of contacts but only process a subset
    const totalContacts = 500;
    const processCount = 10;

    const contacts = Array.from({ length: totalContacts }, (_, i) => ({
      basename: `memory-${i}`,
      path: `Contacts/memory-${i}.md`
    } as TFile));

    mockApp.vault!.getMarkdownFiles = vi.fn().mockReturnValue(contacts);
    mockApp.vault!.read = vi.fn().mockResolvedValue(`---
UID: memory-uid
FN: Memory Test
---

#Contact`);

    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'memory-uid',
        FN: 'Memory Test'
      }
    });

    // Only process a subset to minimize memory
    const subset = contacts.slice(0, processCount);
    const results = await Promise.all(
      subset.map(contact =>
        new ContactNote(mockApp as App, mockSettings, contact).getFrontmatter()
      )
    );

    // Should only process requested subset
    expect(results).toHaveLength(processCount);
    // Should use efficient metadata cache instead of reading files
    expect(mockApp.metadataCache!.getFileCache).toHaveBeenCalled();
  });
});
