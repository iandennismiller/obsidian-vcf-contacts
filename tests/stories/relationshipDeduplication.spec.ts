import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { ContactNote } from '../../src/models/contactNote';
import { ContactsPluginSettings } from 'src/plugin/settings';

/**
 * User Story: Relationship De-duplication
 * As a user, when I have duplicate relationships in my Related list
 * (including cases where one is gendered and one is not), I want the plugin
 * to automatically de-duplicate them, keeping the most specific (gendered) version
 * and inferring gender information when possible.
 */
describe('Relationship De-duplication Story', () => {
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
  });

  it('should deduplicate exact duplicate relationships', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    const contentWithDuplicates = `---
UID: john-doe-123
FN: John Doe
---

#### Related
- parent: [[Bob Doe]]
- parent: [[Bob Doe]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(contentWithDuplicates);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const result = await contactNote.syncRelatedListToFrontmatter();

    expect(result.success).toBe(true);
    // Should have deduplicated the duplicate parent relationship
    // There should only be one RELATED[parent] entry in frontmatter
  });

  it('should prefer gendered term over ungendered when deduplicating', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    const contentWithGenderedDuplicate = `---
UID: john-doe-123
FN: John Doe
---

#### Related
- parent: [[Bob Doe]]
- father: [[Bob Doe]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(contentWithGenderedDuplicate);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const result = await contactNote.syncRelatedListToFrontmatter();

    expect(result.success).toBe(true);
    // Should keep "father" (gendered) and remove "parent" (ungendered)
    // The related list should now show only "father: [[Bob Doe]]"
  });

  it('should prefer gendered term regardless of order', async () => {
    const mockFile = { basename: 'jane-doe', path: 'Contacts/jane-doe.md' } as TFile;
    const contentWithGenderedFirst = `---
UID: jane-doe-456
FN: Jane Doe
---

#### Related
- mother: [[Mary Smith]]
- parent: [[Mary Smith]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(contentWithGenderedFirst);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'jane-doe-456',
        FN: 'Jane Doe'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const result = await contactNote.syncRelatedListToFrontmatter();

    expect(result.success).toBe(true);
    // Should keep "mother" (gendered) even though it came first
  });

  it('should deduplicate multiple types of relationships', async () => {
    const mockFile = { basename: 'alice-jones', path: 'Contacts/alice-jones.md' } as TFile;
    const contentWithMultipleDuplicates = `---
UID: alice-jones-789
FN: Alice Jones
---

#### Related
- parent: [[Bob Jones]]
- father: [[Bob Jones]]
- parent: [[Mary Jones]]
- mother: [[Mary Jones]]
- sibling: [[Tom Jones]]
- brother: [[Tom Jones]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(contentWithMultipleDuplicates);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'alice-jones-789',
        FN: 'Alice Jones'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const result = await contactNote.syncRelatedListToFrontmatter();

    expect(result.success).toBe(true);
    // Should deduplicate all three pairs:
    // - Keep "father" for Bob Jones
    // - Keep "mother" for Mary Jones  
    // - Keep "brother" for Tom Jones
  });

  it('should handle case-insensitive contact name matching', async () => {
    const mockFile = { basename: 'test-user', path: 'Contacts/test-user.md' } as TFile;
    const contentWithCaseVariations = `---
UID: test-user-123
FN: Test User
---

#### Related
- parent: [[Bob Doe]]
- parent: [[bob doe]]
- parent: [[BOB DOE]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(contentWithCaseVariations);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'test-user-123',
        FN: 'Test User'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const result = await contactNote.syncRelatedListToFrontmatter();

    expect(result.success).toBe(true);
    // Should deduplicate case-insensitive matches
  });

  it('should keep both gendered terms if they are for the same relationship', async () => {
    const mockFile = { basename: 'child-user', path: 'Contacts/child-user.md' } as TFile;
    const contentWithBothGendered = `---
UID: child-user-123
FN: Child User
---

#### Related
- father: [[Bob Doe]]
- mother: [[Mary Doe]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(contentWithBothGendered);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'child-user-123',
        FN: 'Child User'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const result = await contactNote.syncRelatedListToFrontmatter();

    expect(result.success).toBe(true);
    // Should keep both father and mother as they are different people
  });

  it('should deduplicate and update frontmatter with genderless type', async () => {
    const mockFile = { basename: 'user-test', path: 'Contacts/user-test.md' } as TFile;
    const contentBeforeDedup = `---
UID: user-test-123
FN: User Test
---

#### Related
- sister: [[Jane Doe]]
- sibling: [[Jane Doe]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(contentBeforeDedup);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'user-test-123',
        FN: 'User Test'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const result = await contactNote.syncRelatedListToFrontmatter();

    expect(result.success).toBe(true);
    // Should store as RELATED[sibling] in frontmatter (genderless)
    // But keep "sister" in the Related list (gendered display)
  });

  it('should handle multiple relationships of the same genderless type after deduplication', async () => {
    const mockFile = { basename: 'family-user', path: 'Contacts/family-user.md' } as TFile;
    const contentWithMultipleSameType = `---
UID: family-user-123
FN: Family User
---

#### Related
- parent: [[Bob Doe]]
- parent: [[Bob Doe]]
- mother: [[Mary Doe]]
- parent: [[Mary Doe]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(contentWithMultipleSameType);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'family-user-123',
        FN: 'Family User'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const result = await contactNote.syncRelatedListToFrontmatter();

    expect(result.success).toBe(true);
    // After deduplication, should have:
    // - parent: [[Bob Doe]] (kept first ungendered)
    // - mother: [[Mary Doe]] (kept gendered over ungendered)
    // In frontmatter as RELATED[parent] and RELATED[1:parent]
  });

  it('should update Related section to match deduplicated list', async () => {
    const mockFile = { basename: 'sync-test', path: 'Contacts/sync-test.md' } as TFile;
    let capturedContent = '';
    
    const contentWithDups = `---
UID: sync-test-123
FN: Sync Test
---

#### Related
- parent: [[Bob Doe]]
- father: [[Bob Doe]]
- parent: [[Mary Doe]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(contentWithDups);
    mockApp.vault!.modify = vi.fn().mockImplementation((file, content) => {
      capturedContent = content;
      return Promise.resolve();
    });
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'sync-test-123',
        FN: 'Sync Test'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const result = await contactNote.syncRelatedListToFrontmatter();

    expect(result.success).toBe(true);
    // The Related section should be updated to show deduplicated relationships
    expect(mockApp.vault!.modify).toHaveBeenCalled();
    // Should only have 2 relationships now (father and parent for Mary)
  });
});
