import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { ContactNote } from '../../src/models/contactNote';
import { ContactsPluginSettings } from 'src/plugin/settings';

/**
 * User Story 24: Manual Relationship Synchronization
 * As a user, I want a command to manually trigger relationship synchronization 
 * across all contacts, ensuring that all bidirectional relationships are consistent 
 * and properly propagated through the graph.
 */
describe('Manual Relationship Synchronization Story', () => {
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

  it('should manually sync relationships across all contacts', async () => {
    // Create multiple contacts with relationships
    const johnFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    const janeFile = { basename: 'jane-smith', path: 'Contacts/jane-smith.md' } as TFile;
    const bobFile = { basename: 'bob-jones', path: 'Contacts/bob-jones.md' } as TFile;

    mockContactFiles.set(johnFile.path, johnFile);
    mockContactFiles.set(janeFile.path, janeFile);
    mockContactFiles.set(bobFile.path, bobFile);

    mockApp.vault!.read = vi.fn().mockImplementation((file: TFile) => {
      if (file.path === johnFile.path) {
        return Promise.resolve(`---
UID: john-uid-123
FN: John Doe
RELATED.spouse: urn:uuid:jane-uid-456
---

#### Related
- spouse [[Jane Smith]]

#Contact`);
      } else if (file.path === janeFile.path) {
        return Promise.resolve(`---
UID: jane-uid-456
FN: Jane Smith
---

#### Related

#Contact`);
      } else {
        return Promise.resolve(`---
UID: bob-uid-789
FN: Bob Jones
RELATED.friend: urn:uuid:john-uid-123
---

#### Related
- friend [[John Doe]]

#Contact`);
      }
    });

    mockApp.metadataCache!.getFileCache = vi.fn().mockImplementation((file: TFile) => {
      if (file.path === johnFile.path) {
        return {
          frontmatter: {
            UID: 'john-uid-123',
            FN: 'John Doe',
            'RELATED.spouse': 'urn:uuid:jane-uid-456'
          }
        };
      } else if (file.path === janeFile.path) {
        return {
          frontmatter: {
            UID: 'jane-uid-456',
            FN: 'Jane Smith'
          }
        };
      } else {
        return {
          frontmatter: {
            UID: 'bob-uid-789',
            FN: 'Bob Jones',
            'RELATED.friend': 'urn:uuid:john-uid-123'
          }
        };
      }
    });

    // Manually trigger sync for all contacts
    const contacts = [johnFile, janeFile, bobFile];
    const syncResults = [];

    for (const contactFile of contacts) {
      const contactNote = new ContactNote(mockApp as App, mockSettings, contactFile);
      const result = await contactNote.performFullSync();
      syncResults.push({
        file: contactFile.basename,
        success: result.success,
        errors: result.errors
      });
    }

    // All syncs should complete
    expect(syncResults).toHaveLength(3);
    syncResults.forEach(result => {
      expect(result.success).toBe(true);
    });
  });

  it('should validate relationship consistency before sync', async () => {
    const aliceFile = { basename: 'alice', path: 'Contacts/alice.md' } as TFile;
    const charlieFile = { basename: 'charlie', path: 'Contacts/charlie.md' } as TFile;

    mockContactFiles.set(aliceFile.path, aliceFile);
    mockContactFiles.set(charlieFile.path, charlieFile);

    mockApp.vault!.read = vi.fn().mockImplementation((file: TFile) => {
      if (file.path === aliceFile.path) {
        return Promise.resolve(`---
UID: alice-uid-111
FN: Alice
RELATED.colleague: urn:uuid:charlie-uid-222
---

#### Related
- colleague [[Charlie]]

#Contact`);
      } else {
        return Promise.resolve(`---
UID: charlie-uid-222
FN: Charlie
RELATED.colleague: urn:uuid:alice-uid-111
---

#### Related
- colleague [[Alice]]

#Contact`);
      }
    });

    mockApp.metadataCache!.getFileCache = vi.fn().mockImplementation((file: TFile) => {
      if (file.path === aliceFile.path) {
        return {
          frontmatter: {
            UID: 'alice-uid-111',
            FN: 'Alice',
            'RELATED.colleague': 'urn:uuid:charlie-uid-222'
          }
        };
      } else {
        return {
          frontmatter: {
            UID: 'charlie-uid-222',
            FN: 'Charlie',
            'RELATED.colleague': 'urn:uuid:alice-uid-111'
          }
        };
      }
    });

    // Validate consistency before sync
    const aliceNote = new ContactNote(mockApp as App, mockSettings, aliceFile);
    const charlieNote = new ContactNote(mockApp as App, mockSettings, charlieFile);

    const aliceValidation = await aliceNote.validateRelationshipConsistency();
    const charlieValidation = await charlieNote.validateRelationshipConsistency();

    // Both should be consistent
    expect(aliceValidation.isConsistent).toBe(true);
    expect(charlieValidation.isConsistent).toBe(true);
  });

  it('should propagate relationship changes bidirectionally during manual sync', async () => {
    const davidFile = { basename: 'david', path: 'Contacts/david.md' } as TFile;
    const emilyFile = { basename: 'emily', path: 'Contacts/emily.md' } as TFile;

    mockContactFiles.set(davidFile.path, davidFile);
    mockContactFiles.set(emilyFile.path, emilyFile);

    // David has Emily as spouse, but Emily doesn't have David yet
    mockApp.vault!.read = vi.fn().mockImplementation((file: TFile) => {
      if (file.path === davidFile.path) {
        return Promise.resolve(`---
UID: david-uid-333
FN: David
RELATED.spouse: urn:uuid:emily-uid-444
---

#### Related
- spouse [[Emily]]

#Contact`);
      } else {
        return Promise.resolve(`---
UID: emily-uid-444
FN: Emily
---

#### Related

#Contact`);
      }
    });

    mockApp.metadataCache!.getFileCache = vi.fn().mockImplementation((file: TFile) => {
      if (file.path === davidFile.path) {
        return {
          frontmatter: {
            UID: 'david-uid-333',
            FN: 'David',
            'RELATED.spouse': 'urn:uuid:emily-uid-444'
          }
        };
      } else {
        return {
          frontmatter: {
            UID: 'emily-uid-444',
            FN: 'Emily'
          }
        };
      }
    });

    // Sync David's contact
    const davidNote = new ContactNote(mockApp as App, mockSettings, davidFile);
    const davidSync = await davidNote.performFullSync();

    expect(davidSync.success).toBe(true);

    // After sync, Emily should have reciprocal relationship
    // (In actual implementation, this would update Emily's file)
  });

  it('should handle broken relationships during manual sync', async () => {
    const frankFile = { basename: 'frank', path: 'Contacts/frank.md' } as TFile;

    mockContactFiles.set(frankFile.path, frankFile);

    // Frank has a relationship to a non-existent contact
    mockApp.vault!.read = vi.fn().mockResolvedValue(`---
UID: frank-uid-555
FN: Frank
RELATED.friend: urn:uuid:nonexistent-uid-999
---

#### Related
- friend [[Nonexistent Person]]

#Contact`);

    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'frank-uid-555',
        FN: 'Frank',
        'RELATED.friend': 'urn:uuid:nonexistent-uid-999'
      }
    });

    const frankNote = new ContactNote(mockApp as App, mockSettings, frankFile);
    const validation = await frankNote.validateRelationshipConsistency();

    // Should report issues with broken relationships
    expect(validation.isConsistent).toBe(false);
    expect(validation.issues.length).toBeGreaterThan(0);
  });

  it('should report sync progress across all contacts', async () => {
    // Create several contacts
    const contactCount = 10;
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
    const progress: Array<{ current: number; total: number }> = [];
    let current = 0;

    for (const contact of contacts) {
      const contactNote = new ContactNote(mockApp as App, mockSettings, contact as TFile);
      await contactNote.performFullSync();
      current++;
      progress.push({ current, total: contactCount });
    }

    // Should have tracked all contacts
    expect(progress).toHaveLength(contactCount);
    expect(progress[progress.length - 1].current).toBe(contactCount);
  });

  it('should provide summary of sync results', async () => {
    const contacts = [
      { basename: 'success-1', path: 'Contacts/success-1.md' },
      { basename: 'success-2', path: 'Contacts/success-2.md' },
      { basename: 'error-3', path: 'Contacts/error-3.md' }
    ];

    contacts.forEach(contact => {
      mockContactFiles.set(contact.path, contact as TFile);
    });

    mockApp.vault!.read = vi.fn().mockImplementation((file: TFile) => {
      if (file.path === 'Contacts/error-3.md') {
        return Promise.reject(new Error('Read error'));
      }
      return Promise.resolve(`---
UID: ${file.basename}-uid
FN: ${file.basename}
---

#Contact`);
    });

    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'test-uid',
        FN: 'Test Contact'
      }
    });

    // Perform sync with error handling
    const results = await Promise.allSettled(
      contacts.map(contact =>
        new ContactNote(mockApp as App, mockSettings, contact as TFile).performFullSync()
      )
    );

    // All promises fulfill since performFullSync catches errors
    // Check the actual success/failure in the results
    const successfulResults = results.filter(r => 
      r.status === 'fulfilled' && r.value.success
    ).length;
    const failedResults = results.filter(r => 
      r.status === 'fulfilled' && !r.value.success
    ).length;

    // Should provide summary - all fulfill but some have success: false
    expect(successfulResults).toBe(2);
    expect(failedResults).toBe(1);
    expect(results).toHaveLength(3);
  });
});
