import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { ContactNote } from '../../src/models/contactNote';
import { ContactsPluginSettings } from 'src/plugin/settings';

/**
 * User Story 13: UID-Based Contact Linking
 * As a user, I want contacts to be linked by their unique UIDs rather than just names, 
 * so that contact name changes don't break relationships.
 */
describe('UID-Based Contact Linking Story', () => {
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

  it('should link contacts using UID in frontmatter relationships', async () => {
    const johnFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    const janeFile = { basename: 'jane-doe', path: 'Contacts/jane-doe.md' } as TFile;
    
    mockContactFiles.set('Contacts/john-doe.md', johnFile);
    mockContactFiles.set('Contacts/jane-doe.md', janeFile);

    // John has UID-based relationship to Jane
    const johnContent = `---
UID: john-doe-123
FN: John Doe
RELATED[spouse]: urn:uuid:jane-doe-456
---

#### Related
- wife [[Jane Doe]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(johnContent);
    mockApp.metadataCache!.getFileCache = vi.fn()
      .mockImplementation((file: TFile) => {
        if (file.path === 'Contacts/john-doe.md') {
          return {
            frontmatter: {
              UID: 'john-doe-123',
              FN: 'John Doe',
              'RELATED[spouse]': 'urn:uuid:jane-doe-456'
            }
          };
        }
        if (file.path === 'Contacts/jane-doe.md') {
          return {
            frontmatter: {
              UID: 'jane-doe-456',
              FN: 'Jane Doe'
            }
          };
        }
        return null;
      });

    const johnContact = new ContactNote(mockApp as App, mockSettings, johnFile);
    const relationships = await johnContact.getRelationships();

    expect(relationships).toHaveLength(1);
    expect(relationships[0].targetUID).toBe('jane-doe-456');
    expect(relationships[0].type).toBe('spouse');
    expect(relationships[0].linkType).toBe('uid');
  });

  it('should resolve contact by UID when name changes', async () => {
    const contactFile = { basename: 'person-contact', path: 'Contacts/person-contact.md' } as TFile;
    const relatedFile = { basename: 'related-contact', path: 'Contacts/related-contact.md' } as TFile;
    
    mockContactFiles.set('Contacts/person-contact.md', contactFile);
    mockContactFiles.set('Contacts/related-contact.md', relatedFile);

    // Contact has relationship using UID but name has changed
    const contactContent = `---
UID: person-123
FN: Person Contact
RELATED[friend]: urn:uuid:related-456
---

#### Related
- friend [[Old Related Name]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(contactContent);
    mockApp.metadataCache!.getFileCache = vi.fn()
      .mockImplementation((file: TFile) => {
        if (file.path === 'Contacts/person-contact.md') {
          return {
            frontmatter: {
              UID: 'person-123',
              FN: 'Person Contact',
              'RELATED[friend]': 'urn:uuid:related-456'
            }
          };
        }
        if (file.path === 'Contacts/related-contact.md') {
          return {
            frontmatter: {
              UID: 'related-456',
              FN: 'New Related Name' // Name has changed
            }
          };
        }
        return null;
      });

    const personContact = new ContactNote(mockApp as App, mockSettings, contactFile);
    const resolvedContact = await personContact.resolveContactByUID('related-456');

    expect(resolvedContact).toBeDefined();
    expect(resolvedContact?.frontmatter.UID).toBe('related-456');
    expect(resolvedContact?.frontmatter.FN).toBe('New Related Name');
  });

  it('should update Related list when contact name changes but UID remains', async () => {
    const sourceFile = { basename: 'source-contact', path: 'Contacts/source-contact.md' } as TFile;
    const targetFile = { basename: 'target-contact', path: 'Contacts/target-contact.md' } as TFile;
    
    mockContactFiles.set('Contacts/source-contact.md', sourceFile);
    mockContactFiles.set('Contacts/target-contact.md', targetFile);

    // Source contact has relationship by UID, but Related list has old name
    const sourceContent = `---
UID: source-123
FN: Source Contact
RELATED[friend]: urn:uuid:target-456
---

#### Related
- friend [[Old Target Name]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(sourceContent);
    mockApp.metadataCache!.getFileCache = vi.fn()
      .mockImplementation((file: TFile) => {
        if (file.path === 'Contacts/source-contact.md') {
          return {
            frontmatter: {
              UID: 'source-123',
              FN: 'Source Contact',
              'RELATED[friend]': 'urn:uuid:target-456'
            }
          };
        }
        if (file.path === 'Contacts/target-contact.md') {
          return {
            frontmatter: {
              UID: 'target-456',
              FN: 'New Target Name' // Name has changed
            }
          };
        }
        return null;
      });

    const sourceContact = new ContactNote(mockApp as App, mockSettings, sourceFile);
    const syncResult = await sourceContact.syncFrontmatterToRelatedList();

    expect(syncResult.success).toBe(true);
    expect(syncResult.updatedRelationships).toHaveLength(1);
    const firstRel = syncResult.updatedRelationships![0];
    expect(firstRel.newName).toBe('New Target Name');
    expect(firstRel.uid).toBe('target-456');
  });

  it('should prefer UID-based linking over name-based when both exist', async () => {
    const contactFile = { basename: 'dual-link', path: 'Contacts/dual-link.md' } as TFile;
    const correctFile = { basename: 'correct-target', path: 'Contacts/correct-target.md' } as TFile;
    const wrongFile = { basename: 'wrong-target', path: 'Contacts/wrong-target.md' } as TFile;
    
    mockContactFiles.set('Contacts/dual-link.md', contactFile);
    mockContactFiles.set('Contacts/correct-target.md', correctFile);
    mockContactFiles.set('Contacts/wrong-target.md', wrongFile);

    // Contact has both UID and name link, but they point to different contacts
    const contactContent = `---
UID: dual-link-123
FN: Dual Link Contact
RELATED[friend]: urn:uuid:correct-456
---

#### Related
- friend [[Wrong Target Name]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(contactContent);
    mockApp.metadataCache!.getFileCache = vi.fn()
      .mockImplementation((file: TFile) => {
        if (file.path === 'Contacts/dual-link.md') {
          return {
            frontmatter: {
              UID: 'dual-link-123',
              FN: 'Dual Link Contact',
              'RELATED[friend]': 'urn:uuid:correct-456'
            }
          };
        }
        if (file.path === 'Contacts/correct-target.md') {
          return {
            frontmatter: {
              UID: 'correct-456',
              FN: 'Correct Target Name'
            }
          };
        }
        if (file.path === 'Contacts/wrong-target.md') {
          return {
            frontmatter: {
              UID: 'wrong-789',
              FN: 'Wrong Target Name'
            }
          };
        }
        return null;
      });

    const dualContact = new ContactNote(mockApp as App, mockSettings, contactFile);
    const resolvedContact = await dualContact.resolveRelationshipTarget('friend');

    // Should resolve to the UID-based target, not the name-based one
    expect(resolvedContact?.frontmatter.UID).toBe('correct-456');
    expect(resolvedContact?.frontmatter.FN).toBe('Correct Target Name');
  });

  it('should handle name-based relationships when UID is not available', async () => {
    const sourceFile = { basename: 'name-only', path: 'Contacts/name-only.md' } as TFile;
    const targetFile = { basename: 'target-by-name', path: 'Contacts/target-by-name.md' } as TFile;
    
    mockContactFiles.set('Contacts/name-only.md', sourceFile);
    mockContactFiles.set('Contacts/target-by-name.md', targetFile);

    // Source contact has only name-based relationship (no UID)
    const sourceContent = `---
UID: name-only-123
FN: Name Only Contact
---

#### Related
- friend [[Target By Name]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(sourceContent);
    mockApp.metadataCache!.getFileCache = vi.fn()
      .mockImplementation((file: TFile) => {
        if (file.path === 'Contacts/name-only.md') {
          return {
            frontmatter: {
              UID: 'name-only-123',
              FN: 'Name Only Contact'
            }
          };
        }
        if (file.path === 'Contacts/target-by-name.md') {
          return {
            frontmatter: {
              UID: 'target-by-name-456',
              FN: 'Target By Name'
            }
          };
        }
        return null;
      });

    const nameOnlyContact = new ContactNote(mockApp as App, mockSettings, sourceFile);
    const relationships = await nameOnlyContact.parseRelatedSection();

    expect(relationships).toHaveLength(1);
    expect(relationships[0].contactName).toBe('Target By Name');
    expect(relationships[0].type).toBe('friend');
    expect(relationships[0].linkType).toBe('name'); // Should fall back to name-based
  });

  it('should upgrade name-based relationships to UID-based when possible', async () => {
    const sourceFile = { basename: 'upgrade-source', path: 'Contacts/upgrade-source.md' } as TFile;
    const targetFile = { basename: 'upgrade-target', path: 'Contacts/upgrade-target.md' } as TFile;
    
    mockContactFiles.set('Contacts/upgrade-source.md', sourceFile);
    mockContactFiles.set('Contacts/upgrade-target.md', targetFile);

    // Source has name-based relationship that can be upgraded to UID
    const sourceContent = `---
UID: upgrade-source-123
FN: Upgrade Source
---

#### Related
- colleague [[Upgrade Target]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(sourceContent);
    mockApp.metadataCache!.getFileCache = vi.fn()
      .mockImplementation((file: TFile) => {
        if (file.path === 'Contacts/upgrade-source.md') {
          return {
            frontmatter: {
              UID: 'upgrade-source-123',
              FN: 'Upgrade Source'
            }
          };
        }
        if (file.path === 'Contacts/upgrade-target.md') {
          return {
            frontmatter: {
              UID: 'upgrade-target-456',
              FN: 'Upgrade Target'
            }
          };
        }
        return null;
      });

    const sourceContact = new ContactNote(mockApp as App, mockSettings, sourceFile);
    const upgradeResult = await sourceContact.upgradeNameBasedRelationshipsToUID();

    expect(upgradeResult.success).toBe(true);
    expect(upgradeResult.upgradedRelationships).toHaveLength(1);
    expect(upgradeResult.upgradedRelationships[0].targetUID).toBe('upgrade-target-456');
    expect(upgradeResult.upgradedRelationships[0].type).toBe('colleague');
  });

  it('should detect and resolve UID conflicts', async () => {
    const file1 = { basename: 'contact1', path: 'Contacts/contact1.md' } as TFile;
    const file2 = { basename: 'contact2', path: 'Contacts/contact2.md' } as TFile;
    
    mockContactFiles.set('Contacts/contact1.md', file1);
    mockContactFiles.set('Contacts/contact2.md', file2);

    // Two contacts with the same UID (conflict scenario)
    mockApp.metadataCache!.getFileCache = vi.fn()
      .mockImplementation((file: TFile) => {
        if (file.path === 'Contacts/contact1.md') {
          return {
            frontmatter: {
              UID: 'duplicate-123',
              FN: 'Contact One'
            }
          };
        }
        if (file.path === 'Contacts/contact2.md') {
          return {
            frontmatter: {
              UID: 'duplicate-123', // Same UID!
              FN: 'Contact Two'
            }
          };
        }
        return null;
      });

    const contact1 = new ContactNote(mockApp as App, mockSettings, file1);
    const conflictResult = await contact1.detectUIDConflicts();

    expect(conflictResult.hasConflicts).toBe(true);
    expect(conflictResult.conflicts).toHaveLength(1);
    expect(conflictResult.conflicts[0].uid).toBe('duplicate-123');
    expect(conflictResult.conflicts[0].files).toHaveLength(2);
  });

  it('should maintain relationship integrity when UIDs are reassigned', async () => {
    const sourceFile = { basename: 'integrity-source', path: 'Contacts/integrity-source.md' } as TFile;
    const targetFile = { basename: 'integrity-target', path: 'Contacts/integrity-target.md' } as TFile;
    
    mockContactFiles.set('Contacts/integrity-source.md', sourceFile);
    mockContactFiles.set('Contacts/integrity-target.md', targetFile);

    // Source has relationship to target, but target UID will change
    const sourceContent = `---
UID: integrity-source-123
FN: Integrity Source
RELATED[mentor]: urn:uuid:old-target-456
---

#### Related
- mentor [[Integrity Target]]

#Contact`;

    const oldTargetUID = 'old-target-456';
    const newTargetUID = 'new-target-789';

    mockApp.vault!.read = vi.fn().mockResolvedValue(sourceContent);
    mockApp.metadataCache!.getFileCache = vi.fn()
      .mockImplementation((file: TFile) => {
        if (file.path === 'Contacts/integrity-source.md') {
          return {
            frontmatter: {
              UID: 'integrity-source-123',
              FN: 'Integrity Source',
              'RELATED[mentor]': `urn:uuid:${oldTargetUID}`
            }
          };
        }
        if (file.path === 'Contacts/integrity-target.md') {
          return {
            frontmatter: {
              UID: newTargetUID, // UID has changed
              FN: 'Integrity Target'
            }
          };
        }
        return null;
      });

    const sourceContact = new ContactNote(mockApp as App, mockSettings, sourceFile);
    const updateResult = await sourceContact.updateRelationshipUID(oldTargetUID, newTargetUID);

    expect(updateResult.success).toBe(true);
    expect(updateResult.updatedRelationships).toHaveLength(1);
    expect(updateResult.updatedRelationships[0].oldUID).toBe(oldTargetUID);
    expect(updateResult.updatedRelationships[0].newUID).toBe(newTargetUID);
  });

  it('should validate UID format and uniqueness', () => {
    const validUIDs = [
      'urn:uuid:550e8400-e29b-41d4-a716-446655440000',
      'contact-123',
      'john-doe-456',
      'custom-uid-format-789'
    ];

    const invalidUIDs = [
      '', // Empty
      '   ', // Whitespace only
      'urn:uuid:invalid-uuid-format',
      'urn:uuid:550e8400-e29b-41d4-a716', // Too short
      null,
      undefined
    ];

    validUIDs.forEach(uid => {
      expect(ContactNote.isValidUID(uid)).toBe(true);
    });

    invalidUIDs.forEach(uid => {
      expect(ContactNote.isValidUID(uid as any)).toBe(false);
    });
  });

  it('should handle bulk UID relationship updates efficiently', async () => {
    const sourceFile = { basename: 'bulk-source', path: 'Contacts/bulk-source.md' } as TFile;
    
    mockContactFiles.set('Contacts/bulk-source.md', sourceFile);

    // Source has multiple relationships that need UID updates
    const sourceContent = `---
UID: bulk-source-123
FN: Bulk Source
RELATED[friend]: name:Friend One
RELATED[1:friend]: name:Friend Two
RELATED[colleague]: name:Colleague One
RELATED[1:colleague]: name:Colleague Two
---

#### Related
- friend [[Friend One]]
- friend [[Friend Two]]
- colleague [[Colleague One]]
- colleague [[Colleague Two]]

#Contact`;

    const bulkUpdates = [
      { name: 'Friend One', uid: 'friend-one-111' },
      { name: 'Friend Two', uid: 'friend-two-222' },
      { name: 'Colleague One', uid: 'colleague-one-333' },
      { name: 'Colleague Two', uid: 'colleague-two-444' }
    ];

    mockApp.vault!.read = vi.fn().mockResolvedValue(sourceContent);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'bulk-source-123',
        FN: 'Bulk Source',
        'RELATED[friend]': 'name:Friend One',
        'RELATED[1:friend]': 'name:Friend Two',
        'RELATED[colleague]': 'name:Colleague One',
        'RELATED[1:colleague]': 'name:Colleague Two'
      }
    });

    const sourceContact = new ContactNote(mockApp as App, mockSettings, sourceFile);
    const bulkResult = await sourceContact.bulkUpdateRelationshipUIDs(bulkUpdates);

    expect(bulkResult.success).toBe(true);
    expect(bulkResult.updatedCount).toBe(4);
    expect(bulkResult.failedCount).toBe(0);
  });
});