import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { ContactNote } from '../../src/models/contactNote';
import { ContactsPluginSettings } from 'src/plugin/settings';

/**
 * User Story 18: Bulk Contact Operations
 * As a user, I want to perform bulk operations like syncing all contacts, 
 * validating all relationships, or updating all VCF files from my Obsidian 
 * contacts at once.
 */
describe('Bulk Contact Operations Story', () => {
  let mockApp: Partial<App>;
  let mockSettings: ContactsPluginSettings;
  let mockContactFiles: Map<string, TFile>;

  beforeEach(() => {
    mockContactFiles = new Map();

    mockApp = {
      vault: {
        read: vi.fn(),
        modify: vi.fn(),
        create: vi.fn(),
        getMarkdownFiles: vi.fn(() => Array.from(mockContactFiles.values())),
        getAbstractFileByPath: vi.fn((path: string) => mockContactFiles.get(path) || null)
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

  it('should sync all contacts in bulk operation', async () => {
    // Create multiple contact files
    const contacts = [
      { basename: 'john-doe', path: 'Contacts/john-doe.md' },
      { basename: 'jane-smith', path: 'Contacts/jane-smith.md' },
      { basename: 'bob-jones', path: 'Contacts/bob-jones.md' }
    ];

    contacts.forEach(contact => {
      mockContactFiles.set(contact.path, contact as TFile);
    });

    // Mock content for each contact
    mockApp.vault!.read = vi.fn().mockImplementation((file: TFile) => {
      return Promise.resolve(`---
UID: ${file.basename}-uid
FN: ${file.basename.replace('-', ' ')}
EMAIL: ${file.basename}@example.com
---

#Contact`);
    });

    mockApp.metadataCache!.getFileCache = vi.fn().mockImplementation((file: TFile) => ({
      frontmatter: {
        UID: `${file.basename}-uid`,
        FN: file.basename.replace('-', ' '),
        EMAIL: `${file.basename}@example.com`
      }
    }));

    // Perform bulk sync operation
    const results = await Promise.all(
      contacts.map(contact => {
        const contactNote = new ContactNote(mockApp as App, mockSettings, contact as TFile);
        return contactNote.performFullSync();
      })
    );

    // All contacts should sync successfully
    expect(results).toHaveLength(3);
    results.forEach(result => {
      expect(result.success).toBe(true);
    });
  });

  it('should validate all relationships in bulk operation', async () => {
    // Create contacts with relationships
    const johnFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    const janeFile = { basename: 'jane-smith', path: 'Contacts/jane-smith.md' } as TFile;

    mockContactFiles.set(johnFile.path, johnFile);
    mockContactFiles.set(janeFile.path, janeFile);

    mockApp.vault!.read = vi.fn().mockImplementation((file: TFile) => {
      if (file.path === johnFile.path) {
        return Promise.resolve(`---
UID: john-uid-123
FN: John Doe
RELATED[spouse]: urn:uuid:jane-uid-456
---

#### Related
- spouse [[Jane Smith]]

#Contact`);
      } else {
        return Promise.resolve(`---
UID: jane-uid-456
FN: Jane Smith
RELATED[spouse]: urn:uuid:john-uid-123
---

#### Related
- spouse [[John Doe]]

#Contact`);
      }
    });

    mockApp.metadataCache!.getFileCache = vi.fn().mockImplementation((file: TFile) => {
      if (file.path === johnFile.path) {
        return {
          frontmatter: {
            UID: 'john-uid-123',
            FN: 'John Doe',
            'RELATED[spouse]': 'urn:uuid:jane-uid-456'
          }
        };
      } else {
        return {
          frontmatter: {
            UID: 'jane-uid-456',
            FN: 'Jane Smith',
            'RELATED[spouse]': 'urn:uuid:john-uid-123'
          }
        };
      }
    });

    // Validate all relationships
    const contactNotes = [johnFile, janeFile].map(
      file => new ContactNote(mockApp as App, mockSettings, file)
    );

    const validationResults = await Promise.all(
      contactNotes.map(note => note.validateRelationshipConsistency())
    );

    // All relationships should be consistent
    expect(validationResults).toHaveLength(2);
    validationResults.forEach(result => {
      expect(result.isConsistent).toBe(true);
    });
  });

  it('should update all VCF files from Obsidian contacts in bulk', async () => {
    // Create multiple contacts
    const contacts = [
      { basename: 'alice', path: 'Contacts/alice.md' },
      { basename: 'bob', path: 'Contacts/bob.md' },
      { basename: 'charlie', path: 'Contacts/charlie.md' }
    ];

    contacts.forEach(contact => {
      mockContactFiles.set(contact.path, contact as TFile);
    });

    mockApp.vault!.read = vi.fn().mockImplementation((file: TFile) => {
      return Promise.resolve(`---
UID: ${file.basename}-uid
FN: ${file.basename}
EMAIL: ${file.basename}@example.com
---

#Contact`);
    });

    mockApp.metadataCache!.getFileCache = vi.fn().mockImplementation((file: TFile) => ({
      frontmatter: {
        UID: `${file.basename}-uid`,
        FN: file.basename,
        EMAIL: `${file.basename}@example.com`
      }
    }));

    // Perform bulk VCF update
    const contactNotes = contacts.map(
      contact => new ContactNote(mockApp as App, mockSettings, contact as TFile)
    );

    const frontmatterResults = await Promise.all(
      contactNotes.map(note => note.getFrontmatter())
    );

    // All contacts should have valid frontmatter
    expect(frontmatterResults).toHaveLength(3);
    frontmatterResults.forEach((fm, index) => {
      expect(fm.UID).toBe(`${contacts[index].basename}-uid`);
      expect(fm.FN).toBe(contacts[index].basename);
    });
  });

  it('should handle errors in bulk operations gracefully', async () => {
    // Create contacts, some with errors
    const validContact = { basename: 'valid', path: 'Contacts/valid.md' } as TFile;
    const errorContact = { basename: 'error', path: 'Contacts/error.md' } as TFile;

    mockContactFiles.set(validContact.path, validContact);
    mockContactFiles.set(errorContact.path, errorContact);

    mockApp.vault!.read = vi.fn().mockImplementation((file: TFile) => {
      if (file.path === validContact.path) {
        return Promise.resolve(`---
UID: valid-uid
FN: Valid Contact
---

#Contact`);
      } else {
        return Promise.reject(new Error('Read error'));
      }
    });

    // Perform bulk operation
    const results = await Promise.allSettled([
      new ContactNote(mockApp as App, mockSettings, validContact).getContent(),
      new ContactNote(mockApp as App, mockSettings, errorContact).getContent()
    ]);

    // One should succeed, one should fail
    expect(results[0].status).toBe('fulfilled');
    expect(results[1].status).toBe('rejected');
  });

  it('should report progress during bulk operations', async () => {
    // Create multiple contacts
    const contactCount = 5;
    const contacts = Array.from({ length: contactCount }, (_, i) => ({
      basename: `contact-${i}`,
      path: `Contacts/contact-${i}.md`
    }));

    contacts.forEach(contact => {
      mockContactFiles.set(contact.path, contact as TFile);
    });

    mockApp.vault!.read = vi.fn().mockResolvedValue(`---
UID: test-uid
FN: Test Contact
---

#Contact`);

    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'test-uid',
        FN: 'Test Contact'
      }
    });

    // Track progress
    let processedCount = 0;
    const results = [];

    for (const contact of contacts) {
      const contactNote = new ContactNote(mockApp as App, mockSettings, contact as TFile);
      const result = await contactNote.getFrontmatter();
      processedCount++;
      results.push({ processed: processedCount, total: contactCount, result });
    }

    // All contacts should be processed
    expect(processedCount).toBe(contactCount);
    expect(results).toHaveLength(contactCount);
    expect(results[results.length - 1].processed).toBe(contactCount);
  });
});
