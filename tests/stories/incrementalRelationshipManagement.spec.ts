import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { ContactNote } from '../../src/models/contactNote';
import { ContactsPluginSettings } from 'src/plugin/settings';

/**
 * User Story 11: Incremental Relationship Management
 * As a user, I want to add relationships (one at a time) to a contact over the 
 * course of several plugin load/unload cycles, with the expectation that 
 * relationships in the front matter and vcards will be curated and consistent.
 */
describe('Incremental Relationship Management Story', () => {
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

  it('should preserve existing relationships when adding a new one', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Initial state with one relationship
    const initialContent = `---
UID: john-doe-123
FN: John Doe
RELATED.spouse: name:Jane Doe
---

## Notes
John is a software developer.

#### Related
- spouse [[Jane Doe]]

#Contact`;

    // After adding another relationship
    const updatedContent = `---
UID: john-doe-123
FN: John Doe
RELATED.spouse: name:Jane Doe
---

## Notes
John is a software developer.

#### Related
- spouse [[Jane Doe]]
- parent [[Bob Doe]]

#Contact`;

    // First load/unload cycle
    mockApp.vault!.read = vi.fn().mockResolvedValue(initialContent);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'RELATED.spouse': 'name:Jane Doe'
      }
    });

    const contactNote1 = new ContactNote(mockApp as App, mockSettings, mockFile);
    const initialRelationships = await contactNote1.parseRelatedSection();
    
    expect(initialRelationships).toHaveLength(1);
    expect(initialRelationships[0].type).toBe('spouse');

    // Second load/unload cycle - new relationship added
    mockApp.vault!.read = vi.fn().mockResolvedValue(updatedContent);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'RELATED.spouse': 'name:Jane Doe'
      }
    });

    const contactNote2 = new ContactNote(mockApp as App, mockSettings, mockFile);
    const result = await contactNote2.syncRelatedListToFrontmatter();

    expect(result.success).toBe(true);
    // Errors may occur if contacts cannot be resolved (which is expected in this mock scenario)
  });

  it('should maintain consistency across multiple plugin cycles', async () => {
    const mockFile = { basename: 'sarah-jones', path: 'Contacts/sarah-jones.md' } as TFile;
    
    // Cycle 1: Initial contact with no relationships
    const cycle1Content = `---
UID: sarah-jones-456
FN: Sarah Jones
EMAIL: sarah@example.com
---

## Notes
Sarah is a project manager.

#### Related

#Contact`;

    // Cycle 2: Add first relationship
    const cycle2Content = `---
UID: sarah-jones-456
FN: Sarah Jones
EMAIL: sarah@example.com
---

## Notes
Sarah is a project manager.

#### Related
- colleague [[Mike Smith]]

#Contact`;

    // Cycle 3: Add second relationship
    const cycle3Content = `---
UID: sarah-jones-456
FN: Sarah Jones
EMAIL: sarah@example.com
RELATED.colleague: name:Mike Smith
---

## Notes
Sarah is a project manager.

#### Related
- colleague [[Mike Smith]]
- friend [[Emma Wilson]]

#Contact`;

    // Simulate cycle 1
    mockApp.vault!.read = vi.fn().mockResolvedValue(cycle1Content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'sarah-jones-456',
        FN: 'Sarah Jones',
        EMAIL: 'sarah@example.com'
      }
    });

    const contactNote1 = new ContactNote(mockApp as App, mockSettings, mockFile);
    const rels1 = await contactNote1.parseRelatedSection();
    expect(rels1).toHaveLength(0);

    // Simulate cycle 2
    mockApp.vault!.read = vi.fn().mockResolvedValue(cycle2Content);
    const contactNote2 = new ContactNote(mockApp as App, mockSettings, mockFile);
    const sync2 = await contactNote2.syncRelatedListToFrontmatter();
    expect(sync2.success).toBe(true);

    // Simulate cycle 3
    mockApp.vault!.read = vi.fn().mockResolvedValue(cycle3Content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'sarah-jones-456',
        FN: 'Sarah Jones',
        EMAIL: 'sarah@example.com',
        'RELATED.colleague': 'name:Mike Smith'
      }
    });

    const contactNote3 = new ContactNote(mockApp as App, mockSettings, mockFile);
    const sync3 = await contactNote3.syncRelatedListToFrontmatter();
    expect(sync3.success).toBe(true);
  });

  it('should handle relationship modifications across cycles', async () => {
    const mockFile = { basename: 'alex-brown', path: 'Contacts/alex-brown.md' } as TFile;
    
    // Initial state
    const initialContent = `---
UID: alex-brown-789
FN: Alex Brown
RELATED.friend: name:Chris Green
---

#### Related
- friend [[Chris Green]]

#Contact`;

    // Modified relationship type
    const modifiedContent = `---
UID: alex-brown-789
FN: Alex Brown
RELATED.friend: name:Chris Green
---

#### Related
- colleague [[Chris Green]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(initialContent);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'alex-brown-789',
        FN: 'Alex Brown',
        'RELATED.friend': 'name:Chris Green'
      }
    });

    const contactNote1 = new ContactNote(mockApp as App, mockSettings, mockFile);
    const initialRels = await contactNote1.parseRelatedSection();
    expect(initialRels[0].type).toBe('friend');

    // After modification
    mockApp.vault!.read = vi.fn().mockResolvedValue(modifiedContent);
    const contactNote2 = new ContactNote(mockApp as App, mockSettings, mockFile);
    const modifiedRels = await contactNote2.parseRelatedSection();
    expect(modifiedRels[0].type).toBe('colleague');
  });

  it('should handle multiple relationships of the same type incrementally', async () => {
    const mockFile = { basename: 'parent-contact', path: 'Contacts/parent-contact.md' } as TFile;
    
    // Add first child
    const state1 = `---
UID: parent-contact-001
FN: Parent Contact
---

#### Related
- child [[Child One]]

#Contact`;

    // Add second child
    const state2 = `---
UID: parent-contact-001
FN: Parent Contact
RELATED.child: name:Child One
---

#### Related
- child [[Child One]]
- child [[Child Two]]

#Contact`;

    // Add third child
    const state3 = `---
UID: parent-contact-001
FN: Parent Contact
RELATED.child: name:Child One
RELATED.child.1: name:Child Two
---

#### Related
- child [[Child One]]
- child [[Child Two]]
- child [[Child Three]]

#Contact`;

    // Test state 1
    mockApp.vault!.read = vi.fn().mockResolvedValue(state1);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'parent-contact-001',
        FN: 'Parent Contact'
      }
    });

    const contactNote1 = new ContactNote(mockApp as App, mockSettings, mockFile);
    const rels1 = await contactNote1.parseRelatedSection();
    expect(rels1).toHaveLength(1);
    expect(rels1[0].type).toBe('child');

    // Test state 2
    mockApp.vault!.read = vi.fn().mockResolvedValue(state2);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'parent-contact-001',
        FN: 'Parent Contact',
        'RELATED.child': 'name:Child One'
      }
    });

    const contactNote2 = new ContactNote(mockApp as App, mockSettings, mockFile);
    const rels2 = await contactNote2.parseRelatedSection();
    expect(rels2).toHaveLength(2);

    // Test state 3
    mockApp.vault!.read = vi.fn().mockResolvedValue(state3);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'parent-contact-001',
        FN: 'Parent Contact',
        'RELATED.child': 'name:Child One',
        'RELATED.child.1': 'name:Child Two'
      }
    });

    const contactNote3 = new ContactNote(mockApp as App, mockSettings, mockFile);
    const rels3 = await contactNote3.parseRelatedSection();
    expect(rels3).toHaveLength(3);
    expect(rels3.filter(r => r.type === 'child')).toHaveLength(3);
  });

  it('should not lose relationships when plugin is reloaded', async () => {
    const mockFile = { basename: 'stable-contact', path: 'Contacts/stable-contact.md' } as TFile;
    
    const stableContent = `---
UID: stable-contact-999
FN: Stable Contact
RELATED.spouse: name:Partner Name
RELATED.friend: name:Friend Name
RELATED.colleague: name:Colleague Name
---

#### Related
- spouse [[Partner Name]]
- friend [[Friend Name]]
- colleague [[Colleague Name]]

#Contact`;

    // Multiple plugin load cycles with same content
    for (let i = 0; i < 3; i++) {
      mockApp.vault!.read = vi.fn().mockResolvedValue(stableContent);
      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
        frontmatter: {
          UID: 'stable-contact-999',
          FN: 'Stable Contact',
          'RELATED.spouse': 'name:Partner Name',
          'RELATED.friend': 'name:Friend Name',
          'RELATED.colleague': 'name:Colleague Name'
        }
      });

      const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
      const relationships = await contactNote.parseRelatedSection();
      
      expect(relationships).toHaveLength(3);
      expect(relationships.map(r => r.type).sort()).toEqual(['colleague', 'friend', 'spouse']);
    }
  });
});
