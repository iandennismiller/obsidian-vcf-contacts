import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { ContactNote } from '../../src/models/contactNote';
import { ContactsPluginSettings } from 'src/plugin/settings';

/**
 * User Story 8: Complex Family Relationships
 * As a user, I want to manage complex family relationships like "mother-in-law", 
 * "step-father", "adopted-daughter" and have the plugin understand and maintain 
 * these relationships bidirectionally.
 */
describe('Complex Family Relationships Story', () => {
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
      vcardWatchEnabled: true,
      vcardWatchPollingInterval: 30,
      vcardWriteBackEnabled: false,
      vcardCustomizeIgnoreList: false,
      vcardIgnoreFilenames: [],
      vcardIgnoreUIDs: [],
      logLevel: 'INFO'
    };
  });

  it('should handle mother-in-law relationships', async () => {
    const mockFile = { basename: 'john-smith', path: 'Contacts/john-smith.md' } as TFile;
    const content = `---
UID: john-smith-123
FN: John Smith
RELATED.mother-in-law: name:Mary Johnson
---

#### Related
- mother-in-law: [[Mary Johnson]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-smith-123',
        FN: 'John Smith',
        'RELATED.mother-in-law': 'name:Mary Johnson'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const relationships = await contactNote.parseRelatedSection();

    expect(relationships).toHaveLength(1);
    expect(relationships[0].type).toBe('mother-in-law');
    expect(relationships[0].contactName).toBe('Mary Johnson');
  });

  it('should handle step-parent relationships', async () => {
    const mockFile = { basename: 'jane-doe', path: 'Contacts/jane-doe.md' } as TFile;
    const content = `---
UID: jane-doe-456
FN: Jane Doe
RELATED.step-father: name:Bob Wilson
RELATED.step-mother: name:Alice Wilson
---

#### Related
- step-father: [[Bob Wilson]]
- step-mother: [[Alice Wilson]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'jane-doe-456',
        FN: 'Jane Doe',
        'RELATED.step-father': 'name:Bob Wilson',
        'RELATED.step-mother': 'name:Alice Wilson'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const relationships = await contactNote.parseRelatedSection();

    expect(relationships).toHaveLength(2);
    expect(relationships.some(r => r.type === 'step-father')).toBe(true);
    expect(relationships.some(r => r.type === 'step-mother')).toBe(true);
  });

  it('should handle adopted-child relationships', async () => {
    const mockFile = { basename: 'parent-contact', path: 'Contacts/parent-contact.md' } as TFile;
    const content = `---
UID: parent-contact-789
FN: Parent Contact
RELATED.adopted-daughter: name:Emma Smith
RELATED.adopted-son: name:Michael Smith
---

#### Related
- adopted-daughter: [[Emma Smith]]
- adopted-son: [[Michael Smith]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'parent-contact-789',
        FN: 'Parent Contact',
        'RELATED.adopted-daughter': 'name:Emma Smith',
        'RELATED.adopted-son': 'name:Michael Smith'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const relationships = await contactNote.parseRelatedSection();

    expect(relationships).toHaveLength(2);
    expect(relationships.some(r => r.type === 'adopted-daughter')).toBe(true);
    expect(relationships.some(r => r.type === 'adopted-son')).toBe(true);
  });

  it('should handle half-sibling relationships', async () => {
    const mockFile = { basename: 'sibling-contact', path: 'Contacts/sibling-contact.md' } as TFile;
    const content = `---
UID: sibling-contact-111
FN: Sibling Contact
RELATED.half-brother: name:Tom Jones
RELATED.half-sister: name:Sarah Jones
---

#### Related
- half-brother: [[Tom Jones]]
- half-sister: [[Sarah Jones]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'sibling-contact-111',
        FN: 'Sibling Contact',
        'RELATED.half-brother': 'name:Tom Jones',
        'RELATED.half-sister': 'name:Sarah Jones'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const relationships = await contactNote.parseRelatedSection();

    expect(relationships).toHaveLength(2);
    expect(relationships.some(r => r.type === 'half-brother')).toBe(true);
    expect(relationships.some(r => r.type === 'half-sister')).toBe(true);
  });

  it('should handle father-in-law and son-in-law relationships', async () => {
    const mockFile = { basename: 'in-law-contact', path: 'Contacts/in-law-contact.md' } as TFile;
    const content = `---
UID: in-law-contact-222
FN: In-Law Contact
RELATED.father-in-law: name:Richard Brown
RELATED.son-in-law: name:David Green
---

#### Related
- father-in-law: [[Richard Brown]]
- son-in-law: [[David Green]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'in-law-contact-222',
        FN: 'In-Law Contact',
        'RELATED.father-in-law': 'name:Richard Brown',
        'RELATED.son-in-law': 'name:David Green'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const relationships = await contactNote.parseRelatedSection();

    expect(relationships).toHaveLength(2);
    expect(relationships.some(r => r.type === 'father-in-law')).toBe(true);
    expect(relationships.some(r => r.type === 'son-in-law')).toBe(true);
  });

  it('should handle multiple complex family relationships', async () => {
    const mockFile = { basename: 'complex-family', path: 'Contacts/complex-family.md' } as TFile;
    const content = `---
UID: complex-family-333
FN: Complex Family Contact
RELATED.step-father: name:John Doe
RELATED.mother-in-law: name:Jane Smith
RELATED.adopted-son: name:Alex Johnson
RELATED.half-sister: name:Emily Wilson
---

#### Related
- step-father: [[John Doe]]
- mother-in-law: [[Jane Smith]]
- adopted-son: [[Alex Johnson]]
- half-sister: [[Emily Wilson]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'complex-family-333',
        FN: 'Complex Family Contact',
        'RELATED.step-father': 'name:John Doe',
        'RELATED.mother-in-law': 'name:Jane Smith',
        'RELATED.adopted-son': 'name:Alex Johnson',
        'RELATED.half-sister': 'name:Emily Wilson'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const relationships = await contactNote.parseRelatedSection();

    expect(relationships).toHaveLength(4);
    expect(relationships.map(r => r.type)).toContain('step-father');
    expect(relationships.map(r => r.type)).toContain('mother-in-law');
    expect(relationships.map(r => r.type)).toContain('adopted-son');
    expect(relationships.map(r => r.type)).toContain('half-sister');
  });

  it('should sync complex family relationships from Related list to frontmatter', async () => {
    const mockFile = { basename: 'sync-test', path: 'Contacts/sync-test.md' } as TFile;
    const content = `---
UID: sync-test-444
FN: Sync Test Contact
---

#### Related
- step-mother: [[Linda Davis]]
- adopted-daughter: [[Sophie Martinez]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'sync-test-444',
        FN: 'Sync Test Contact'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const result = await contactNote.syncRelatedListToFrontmatter();

    expect(result.success).toBe(true);
  });

  it('should preserve hyphenated relationship types', async () => {
    const mockFile = { basename: 'hyphen-test', path: 'Contacts/hyphen-test.md' } as TFile;
    
    const relationshipTypes = [
      'mother-in-law',
      'father-in-law',
      'step-father',
      'step-mother',
      'half-brother',
      'half-sister',
      'adopted-son',
      'adopted-daughter',
      'son-in-law',
      'daughter-in-law'
    ];

    for (const type of relationshipTypes) {
      const content = `---
UID: test-uid
FN: Test Contact
---

#### Related
- ${type}: [[Test Person]]

#Contact`;

      mockApp.vault!.read = vi.fn().mockResolvedValue(content);
      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
        frontmatter: {
          UID: 'test-uid',
          FN: 'Test Contact'
        }
      });

      const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
      const relationships = await contactNote.parseRelatedSection();

      expect(relationships).toHaveLength(1);
      expect(relationships[0].type).toBe(type);
    }
  });
});
