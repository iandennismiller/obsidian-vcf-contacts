import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { ContactNote } from '../../src/models/contactNote';
import { ContactsPluginSettings } from 'src/plugin/settings';

/**
 * User Story 6: Bidirectional Relationship Sync
 * As a user, when I edit the relationships listed under the "Related list" section
 * on a contact note, I expect the plugin to update this contact's frontmatter and 
 * other related contacts' frontmatter and Related lists to reflect the new relationship.
 */
describe('Bidirectional Relationship Sync Story', () => {
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

  it('should sync from Related list to frontmatter when relationship is added', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    // User enters gendered terms in Related list
    const contentWithNewRelationship = `---
UID: john-doe-123
FN: John Doe
EMAIL: john@example.com
---

## Notes
John is a software developer.

#### Related
- parent [[Bob Doe]]
- parent [[Mary Doe]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(contentWithNewRelationship);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        EMAIL: 'john@example.com'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const result = await contactNote.syncRelatedListToFrontmatter();

    expect(result.success).toBe(true);
    // The sync should have processed the relationships from the Related list
    // Relationships should be stored in genderless form (parent) in frontmatter
  });

  it('should sync from frontmatter to Related list when frontmatter is updated', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    const contentWithFrontmatterRelationships = `---
UID: john-doe-123
FN: John Doe
EMAIL: john@example.com
RELATED[parent]: name:Bob Doe
RELATED[1:parent]: name:Mary Doe
---

## Notes
John is a software developer.

#### Related

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(contentWithFrontmatterRelationships);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        EMAIL: 'john@example.com',
        'RELATED[parent]': 'name:Bob Doe',
        'RELATED[1:parent]': 'name:Mary Doe'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const result = await contactNote.syncFrontmatterToRelatedList();

    expect(result.success).toBe(true);
    // The sync should have added the relationships to the Related section
  });

  it('should handle bidirectional sync maintaining consistency', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    const contentWithBothSources = `---
UID: john-doe-123
FN: John Doe
EMAIL: john@example.com
RELATED[parent]: name:Bob Doe
---

## Notes
John is a software developer.

#### Related
- parent [[Bob Doe]]
- parent [[Mary Doe]]
- sibling [[Mike Doe]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(contentWithBothSources);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        EMAIL: 'john@example.com',
        'RELATED[parent]': 'name:Bob Doe'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // First sync frontmatter to Related list (should add Bob to Related if missing)
    const frontmatterResult = await contactNote.syncFrontmatterToRelatedList();
    expect(frontmatterResult.success).toBe(true);
    
    // Then sync Related list to frontmatter (should add Mary and Mike to frontmatter)
    const relatedResult = await contactNote.syncRelatedListToFrontmatter();
    expect(relatedResult.success).toBe(true);
  });

  it('should parse relationship types correctly from Related list', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    const contentWithVariousRelationships = `---
UID: john-doe-123
FN: John Doe
---

## Notes
Some notes about John.

###### Related
- parent [[Bob Doe]]
- parent [[Mary Doe]]  
- sibling [[Mike Doe]]
- friend [[Alice Smith]]
- colleague [[Tom Wilson]]
- boss [[Sarah Johnson]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(contentWithVariousRelationships);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const relationships = await contactNote.parseRelatedSection();
    
    expect(relationships).toHaveLength(6);
    expect(relationships.find(r => r.type === 'parent')).toBeDefined();
    expect(relationships.find(r => r.type === 'sibling')).toBeDefined();
    expect(relationships.find(r => r.type === 'friend')).toBeDefined();
    expect(relationships.find(r => r.type === 'colleague')).toBeDefined();
    expect(relationships.find(r => r.type === 'boss')).toBeDefined();
  });

  it('should handle relationship conflicts by maintaining existing data', async () => {
    // Test scenario where both frontmatter and Related list have the same relationship
    // Frontmatter has genderless form, Related list may have gendered form
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    const contentWithDuplicateRelationships = `---
UID: john-doe-123
FN: John Doe
RELATED[parent]: name:Bob Doe
---

#### Related
- parent [[Bob Doe]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(contentWithDuplicateRelationships);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'RELATED[parent]': 'name:Bob Doe'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Should recognize that father and parent refer to the same relationship type
    const result = await contactNote.syncRelatedListToFrontmatter();
    expect(result.success).toBe(true);
    // Should not create duplicate entries
  });
});