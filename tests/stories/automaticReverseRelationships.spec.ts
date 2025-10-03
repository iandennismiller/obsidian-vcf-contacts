import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { ContactNote } from '../../src/models/contactNote';
import { ContactsPluginSettings } from 'src/plugin/settings';

/**
 * User Story 7: Automatic Reverse Relationships
 * As a user, when I add a parent relationship to Jane's contact, I want the 
 * reciprocal child relationship to automatically appear on the parent's contact.
 * The system stores relationships in genderless form (parent/child) in frontmatter,
 * but can render them with gendered terms (father/daughter) based on GENDER field.
 */
describe('Automatic Reverse Relationships Story', () => {
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

  it('should add reverse parent-child relationship automatically', async () => {
    // Setup Jane adding a parent relationship (may use gendered term "father")
    const janeFile = { basename: 'jane-doe', path: 'Contacts/jane-doe.md' } as TFile;
    const johnFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    mockContactFiles.set('Contacts/jane-doe.md', janeFile);
    mockContactFiles.set('Contacts/john-doe.md', johnFile);

    // Jane's content - stored in genderless form in frontmatter
    const janeContent = `---
UID: jane-doe-456
FN: Jane Doe
GENDER: F
RELATED[parent]: urn:uuid:john-doe-123
---

#### Related
- parent [[John Doe]]

#Contact`;

    // John's initial content (no relationships yet)
    const johnContent = `---
UID: john-doe-123
FN: John Doe
GENDER: M
---

#### Related

#Contact`;

    mockApp.vault!.read = vi.fn()
      .mockImplementation((file: TFile) => {
        if (file.path === 'Contacts/jane-doe.md') return Promise.resolve(janeContent);
        if (file.path === 'Contacts/john-doe.md') return Promise.resolve(johnContent);
        return Promise.reject(new Error('File not found'));
      });

    mockApp.metadataCache!.getFileCache = vi.fn()
      .mockImplementation((file: TFile) => {
        if (file.path === 'Contacts/jane-doe.md') {
          return {
            frontmatter: {
              UID: 'jane-doe-456',
              FN: 'Jane Doe',
              GENDER: 'F'
            }
          };
        }
        if (file.path === 'Contacts/john-doe.md') {
          return {
            frontmatter: {
              UID: 'john-doe-123',
              FN: 'John Doe',
              GENDER: 'M'
            }
          };
        }
        return null;
      });

    const janeContact = new ContactNote(mockApp as App, mockSettings, janeFile);
    
    // Process Jane's relationships - should add reverse relationship to John
    const result = await janeContact.processReverseRelationships();

    expect(result.success).toBe(true);
    expect(result.processedRelationships).toHaveLength(1);
    expect(result.processedRelationships[0].targetContact).toBe('John Doe');
    expect(result.processedRelationships[0].reverseType).toBe('daughter');
    expect(result.processedRelationships[0].added).toBe(true);
  });

  it('should add reverse sibling relationships correctly', async () => {
    const aliceFile = { basename: 'alice-smith', path: 'Contacts/alice-smith.md' } as TFile;
    const bobFile = { basename: 'bob-smith', path: 'Contacts/bob-smith.md' } as TFile;
    
    mockContactFiles.set('Contacts/alice-smith.md', aliceFile);
    mockContactFiles.set('Contacts/bob-smith.md', bobFile);

    // Alice adds "brother: [[Bob Smith]]"
    const aliceContent = `---
UID: alice-smith-123
FN: Alice Smith
GENDER: F
---

#### Related
- brother [[Bob Smith]]

#Contact`;

    const bobContent = `---
UID: bob-smith-456
FN: Bob Smith
GENDER: M
---

#### Related

#Contact`;

    mockApp.vault!.read = vi.fn()
      .mockImplementation((file: TFile) => {
        if (file.path === 'Contacts/alice-smith.md') return Promise.resolve(aliceContent);
        if (file.path === 'Contacts/bob-smith.md') return Promise.resolve(bobContent);
        return Promise.reject(new Error('File not found'));
      });

    mockApp.metadataCache!.getFileCache = vi.fn()
      .mockImplementation((file: TFile) => {
        if (file.path === 'Contacts/alice-smith.md') {
          return {
            frontmatter: {
              UID: 'alice-smith-123',
              FN: 'Alice Smith',
              GENDER: 'F'
            }
          };
        }
        if (file.path === 'Contacts/bob-smith.md') {
          return {
            frontmatter: {
              UID: 'bob-smith-456',
              FN: 'Bob Smith',
              GENDER: 'M'
            }
          };
        }
        return null;
      });

    const aliceContact = new ContactNote(mockApp as App, mockSettings, aliceFile);
    
    const result = await aliceContact.processReverseRelationships();

    expect(result.success).toBe(true);
    expect(result.processedRelationships[0].reverseType).toBe('sister');
  });

  it('should add reverse spouse relationships correctly', async () => {
    const johnFile = { basename: 'john-married', path: 'Contacts/john-married.md' } as TFile;
    const maryFile = { basename: 'mary-married', path: 'Contacts/mary-married.md' } as TFile;
    
    mockContactFiles.set('Contacts/john-married.md', johnFile);
    mockContactFiles.set('Contacts/mary-married.md', maryFile);

    // John adds "wife: [[Mary Married]]"
    const johnContent = `---
UID: john-married-123
FN: John Married
GENDER: M
---

#### Related
- wife [[Mary Married]]

#Contact`;

    const maryContent = `---
UID: mary-married-456
FN: Mary Married
GENDER: F
---

#### Related

#Contact`;

    mockApp.vault!.read = vi.fn()
      .mockImplementation((file: TFile) => {
        if (file.path === 'Contacts/john-married.md') return Promise.resolve(johnContent);
        if (file.path === 'Contacts/mary-married.md') return Promise.resolve(maryContent);
        return Promise.reject(new Error('File not found'));
      });

    mockApp.metadataCache!.getFileCache = vi.fn()
      .mockImplementation((file: TFile) => {
        if (file.path === 'Contacts/john-married.md') {
          return {
            frontmatter: {
              UID: 'john-married-123',
              FN: 'John Married',
              GENDER: 'M'
            }
          };
        }
        if (file.path === 'Contacts/mary-married.md') {
          return {
            frontmatter: {
              UID: 'mary-married-456',
              FN: 'Mary Married',
              GENDER: 'F'
            }
          };
        }
        return null;
      });

    const johnContact = new ContactNote(mockApp as App, mockSettings, johnFile);
    
    const result = await johnContact.processReverseRelationships();

    expect(result.success).toBe(true);
    expect(result.processedRelationships[0].reverseType).toBe('husband');
  });

  it('should handle professional relationships without gender bias', async () => {
    const bossFile = { basename: 'boss-wilson', path: 'Contacts/boss-wilson.md' } as TFile;
    const employeeFile = { basename: 'employee-jones', path: 'Contacts/employee-jones.md' } as TFile;
    
    mockContactFiles.set('Contacts/boss-wilson.md', bossFile);
    mockContactFiles.set('Contacts/employee-jones.md', employeeFile);

    // Employee adds "boss: [[Boss Wilson]]"
    const employeeContent = `---
UID: employee-jones-123
FN: Employee Jones
---

#### Related
- boss [[Boss Wilson]]

#Contact`;

    const bossContent = `---
UID: boss-wilson-456
FN: Boss Wilson
---

#### Related

#Contact`;

    mockApp.vault!.read = vi.fn()
      .mockImplementation((file: TFile) => {
        if (file.path === 'Contacts/employee-jones.md') return Promise.resolve(employeeContent);
        if (file.path === 'Contacts/boss-wilson.md') return Promise.resolve(bossContent);
        return Promise.reject(new Error('File not found'));
      });

    mockApp.metadataCache!.getFileCache = vi.fn()
      .mockImplementation((file: TFile) => {
        if (file.path === 'Contacts/employee-jones.md') {
          return {
            frontmatter: {
              UID: 'employee-jones-123',
              FN: 'Employee Jones'
            }
          };
        }
        if (file.path === 'Contacts/boss-wilson.md') {
          return {
            frontmatter: {
              UID: 'boss-wilson-456',
              FN: 'Boss Wilson'
            }
          };
        }
        return null;
      });

    const employeeContact = new ContactNote(mockApp as App, mockSettings, employeeFile);
    
    const result = await employeeContact.processReverseRelationships();

    expect(result.success).toBe(true);
    expect(result.processedRelationships[0].reverseType).toBe('employee');
  });

  it('should not create duplicate reverse relationships', async () => {
    const johnFile = { basename: 'john-existing', path: 'Contacts/john-existing.md' } as TFile;
    const janeFile = { basename: 'jane-existing', path: 'Contacts/jane-existing.md' } as TFile;
    
    mockContactFiles.set('Contacts/john-existing.md', johnFile);
    mockContactFiles.set('Contacts/jane-existing.md', janeFile);

    // John adds "daughter: [[Jane Existing]]" but Jane already has "father: [[John Existing]]"
    const johnContent = `---
UID: john-existing-123
FN: John Existing
GENDER: M
---

#### Related
- daughter [[Jane Existing]]

#Contact`;

    const janeContentWithExisting = `---
UID: jane-existing-456
FN: Jane Existing
GENDER: F
---

#### Related
- father [[John Existing]]

#Contact`;

    mockApp.vault!.read = vi.fn()
      .mockImplementation((file: TFile) => {
        if (file.path === 'Contacts/john-existing.md') return Promise.resolve(johnContent);
        if (file.path === 'Contacts/jane-existing.md') return Promise.resolve(janeContentWithExisting);
        return Promise.reject(new Error('File not found'));
      });

    mockApp.metadataCache!.getFileCache = vi.fn()
      .mockImplementation((file: TFile) => {
        if (file.path === 'Contacts/john-existing.md') {
          return {
            frontmatter: {
              UID: 'john-existing-123',
              FN: 'John Existing',
              GENDER: 'M'
            }
          };
        }
        if (file.path === 'Contacts/jane-existing.md') {
          return {
            frontmatter: {
              UID: 'jane-existing-456',
              FN: 'Jane Existing',
              GENDER: 'F'
            }
          };
        }
        return null;
      });

    const johnContact = new ContactNote(mockApp as App, mockSettings, johnFile);
    
    const result = await johnContact.processReverseRelationships();

    expect(result.success).toBe(true);
    expect(result.processedRelationships[0].added).toBe(false); // Should not add duplicate
    expect(result.processedRelationships[0].reason).toContain('already exists');
  });

  it('should handle complex family relationships with extended family', async () => {
    const uncleFile = { basename: 'uncle-bob', path: 'Contacts/uncle-bob.md' } as TFile;
    const nephewFile = { basename: 'nephew-tim', path: 'Contacts/nephew-tim.md' } as TFile;
    
    mockContactFiles.set('Contacts/uncle-bob.md', uncleFile);
    mockContactFiles.set('Contacts/nephew-tim.md', nephewFile);

    // Nephew adds "uncle: [[Uncle Bob]]"
    const nephewContent = `---
UID: nephew-tim-123
FN: Nephew Tim
GENDER: M
---

#### Related
- uncle [[Uncle Bob]]

#Contact`;

    const uncleContent = `---
UID: uncle-bob-456
FN: Uncle Bob
GENDER: M
---

#### Related

#Contact`;

    mockApp.vault!.read = vi.fn()
      .mockImplementation((file: TFile) => {
        if (file.path === 'Contacts/nephew-tim.md') return Promise.resolve(nephewContent);
        if (file.path === 'Contacts/uncle-bob.md') return Promise.resolve(uncleContent);
        return Promise.reject(new Error('File not found'));
      });

    mockApp.metadataCache!.getFileCache = vi.fn()
      .mockImplementation((file: TFile) => {
        if (file.path === 'Contacts/nephew-tim.md') {
          return {
            frontmatter: {
              UID: 'nephew-tim-123',
              FN: 'Nephew Tim',
              GENDER: 'M'
            }
          };
        }
        if (file.path === 'Contacts/uncle-bob.md') {
          return {
            frontmatter: {
              UID: 'uncle-bob-456',
              FN: 'Uncle Bob',
              GENDER: 'M'
            }
          };
        }
        return null;
      });

    const nephewContact = new ContactNote(mockApp as App, mockSettings, nephewFile);
    
    const result = await nephewContact.processReverseRelationships();

    expect(result.success).toBe(true);
    expect(result.processedRelationships[0].reverseType).toBe('nephew');
  });

  it('should handle relationships with non-binary contacts appropriately', async () => {
    const parentFile = { basename: 'parent-alex', path: 'Contacts/parent-alex.md' } as TFile;
    const childFile = { basename: 'child-sam', path: 'Contacts/child-sam.md' } as TFile;
    
    mockContactFiles.set('Contacts/parent-alex.md', parentFile);
    mockContactFiles.set('Contacts/child-sam.md', childFile);

    // Child adds "parent: [[Parent Alex]]" (Alex is non-binary)
    const childContent = `---
UID: child-sam-123
FN: Child Sam
GENDER: NB
---

#### Related
- parent [[Parent Alex]]

#Contact`;

    const parentContent = `---
UID: parent-alex-456
FN: Parent Alex
GENDER: NB
---

#### Related

#Contact`;

    mockApp.vault!.read = vi.fn()
      .mockImplementation((file: TFile) => {
        if (file.path === 'Contacts/child-sam.md') return Promise.resolve(childContent);
        if (file.path === 'Contacts/parent-alex.md') return Promise.resolve(parentContent);
        return Promise.reject(new Error('File not found'));
      });

    mockApp.metadataCache!.getFileCache = vi.fn()
      .mockImplementation((file: TFile) => {
        if (file.path === 'Contacts/child-sam.md') {
          return {
            frontmatter: {
              UID: 'child-sam-123',
              FN: 'Child Sam',
              GENDER: 'NB'
            }
          };
        }
        if (file.path === 'Contacts/parent-alex.md') {
          return {
            frontmatter: {
              UID: 'parent-alex-456',
              FN: 'Parent Alex',
              GENDER: 'NB'
            }
          };
        }
        return null;
      });

    const childContact = new ContactNote(mockApp as App, mockSettings, childFile);
    
    const result = await childContact.processReverseRelationships();

    expect(result.success).toBe(true);
    expect(result.processedRelationships[0].reverseType).toBe('child'); // Gender-neutral
  });

  it('should handle missing target contacts gracefully', async () => {
    const sourceFile = { basename: 'source-contact', path: 'Contacts/source-contact.md' } as TFile;
    
    mockContactFiles.set('Contacts/source-contact.md', sourceFile);
    // Note: NOT adding the target contact file

    const sourceContent = `---
UID: source-contact-123
FN: Source Contact
---

#### Related
- friend [[Missing Friend]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(sourceContent);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'source-contact-123',
        FN: 'Source Contact'
      }
    });

    const sourceContact = new ContactNote(mockApp as App, mockSettings, sourceFile);
    
    const result = await sourceContact.processReverseRelationships();

    expect(result.success).toBe(true);
    expect(result.processedRelationships[0].added).toBe(false);
    expect(result.processedRelationships[0].reason).toContain('target contact not found');
  });

  it('should handle multiple relationships to the same contact', async () => {
    const multiFile = { basename: 'multi-rel', path: 'Contacts/multi-rel.md' } as TFile;
    const targetFile = { basename: 'target-contact', path: 'Contacts/target-contact.md' } as TFile;
    
    mockContactFiles.set('Contacts/multi-rel.md', multiFile);
    mockContactFiles.set('Contacts/target-contact.md', targetFile);

    // Multiple relationships to the same person (e.g., friend and colleague)
    const multiContent = `---
UID: multi-rel-123
FN: Multi Rel
---

#### Related
- friend [[Target Contact]]
- colleague [[Target Contact]]

#Contact`;

    const targetContent = `---
UID: target-contact-456
FN: Target Contact
---

#### Related

#Contact`;

    mockApp.vault!.read = vi.fn()
      .mockImplementation((file: TFile) => {
        if (file.path === 'Contacts/multi-rel.md') return Promise.resolve(multiContent);
        if (file.path === 'Contacts/target-contact.md') return Promise.resolve(targetContent);
        return Promise.reject(new Error('File not found'));
      });

    mockApp.metadataCache!.getFileCache = vi.fn()
      .mockImplementation((file: TFile) => {
        if (file.path === 'Contacts/multi-rel.md') {
          return {
            frontmatter: {
              UID: 'multi-rel-123',
              FN: 'Multi Rel'
            }
          };
        }
        if (file.path === 'Contacts/target-contact.md') {
          return {
            frontmatter: {
              UID: 'target-contact-456',
              FN: 'Target Contact'
            }
          };
        }
        return null;
      });

    const multiContact = new ContactNote(mockApp as App, mockSettings, multiFile);
    
    const result = await multiContact.processReverseRelationships();

    expect(result.success).toBe(true);
    expect(result.processedRelationships).toHaveLength(2);
    expect(result.processedRelationships[0].reverseType).toBe('friend');
    expect(result.processedRelationships[1].reverseType).toBe('colleague');
  });
});