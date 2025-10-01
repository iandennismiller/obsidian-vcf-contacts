import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { ContactNote } from '../../src/models/contactNote';
import { ContactsPluginSettings } from 'src/plugin/settings';
import { RelatedListProcessor } from '../../src/curators/relatedList';
import { Contact } from '../../src/models';
import { setApp, clearApp } from 'src/plugin/context/sharedAppContext';
import { setSettings } from 'src/plugin/context/sharedSettingsContext';

/**
 * User Story: Manual Curator Processor Execution
 * As a user, when I manually invoke the command "Run curator processors on current contact"
 * and there are items in the Related list that are not in the front matter,
 * I expect that the missing relationships will be added to the frontmatter.
 */
describe('Manual Curator Processor Execution Story', () => {
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
      vcfStorageMethod: 'vcf-folder',
      vcfFilename: 'contacts.vcf',
      vcfWatchFolder: '/test/vcf',
      vcfWatchEnabled: false,
      vcfWatchPollingInterval: 30,
      vcfWriteBackEnabled: false,
      vcfCustomizeIgnoreList: false,
      vcfIgnoreFilenames: [],
      vcfIgnoreUIDs: [],
      logLevel: 'INFO',
      relatedListProcessor: true
    } as any;

    // Set up the plugin context
    setApp(mockApp as App);
    setSettings(mockSettings);
  });

  afterEach(() => {
    // Clean up the plugin context
    clearApp();
  });

  it('should add missing relationships from Related section to frontmatter when curator is run manually', async () => {
    // Setup: Create a contact with relationships in Related section but not in frontmatter
    const johnFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    const janeFile = { basename: 'jane-smith', path: 'Contacts/jane-smith.md' } as TFile;
    const bobFile = { basename: 'bob-jones', path: 'Contacts/bob-jones.md' } as TFile;

    mockContactFiles.set(johnFile.path, johnFile);
    mockContactFiles.set(janeFile.path, janeFile);
    mockContactFiles.set(bobFile.path, bobFile);

    // John has relationships in Related section but MISSING from frontmatter
    const johnContent = `---
UID: john-uid-123
FN: John Doe
REV: 20240101T120000Z
---

#### Related
- spouse: [[Jane Smith]]
- friend: [[Bob Jones]]

#Contact`;

    // Jane's contact exists with UID
    const janeContent = `---
UID: jane-uid-456
FN: Jane Smith
---

#### Related

#Contact`;

    // Bob's contact exists with UID
    const bobContent = `---
UID: bob-uid-789
FN: Bob Jones
---

#### Related

#Contact`;

    mockApp.vault!.read = vi.fn().mockImplementation((file: TFile) => {
      if (file.path === johnFile.path) {
        return Promise.resolve(johnContent);
      } else if (file.path === janeFile.path) {
        return Promise.resolve(janeContent);
      } else if (file.path === bobFile.path) {
        return Promise.resolve(bobContent);
      }
      return Promise.reject(new Error('File not found'));
    });

    mockApp.metadataCache!.getFileCache = vi.fn().mockImplementation((file: TFile) => {
      if (file.path === johnFile.path) {
        return {
          frontmatter: {
            UID: 'john-uid-123',
            FN: 'John Doe',
            REV: '20240101T120000Z'
            // NOTE: No RELATED fields - this is the key test scenario
          }
        };
      } else if (file.path === janeFile.path) {
        return {
          frontmatter: {
            UID: 'jane-uid-456',
            FN: 'Jane Smith'
          }
        };
      } else if (file.path === bobFile.path) {
        return {
          frontmatter: {
            UID: 'bob-uid-789',
            FN: 'Bob Jones'
          }
        };
      }
      return null;
    });

    // Track frontmatter updates
    let updatedFrontmatter: Record<string, any> = {};
    let updatedContent = '';
    mockApp.vault!.modify = vi.fn().mockImplementation(async (file: TFile, newContent: string) => {
      updatedContent = newContent;
      // Parse the frontmatter from the updated content
      const frontmatterMatch = newContent.match(/^---\n([\s\S]*?)\n---/);
      if (frontmatterMatch) {
        const frontmatterText = frontmatterMatch[1];
        const lines = frontmatterText.split('\n');
        lines.forEach(line => {
          // Match key: value, handling brackets properly
          const match = line.match(/^([^:]+?(?:\[[^\]]*\])?):\s*(.+)$/);
          if (match) {
            updatedFrontmatter[match[1]] = match[2];
          }
        });
      }
      return Promise.resolve();
    });

    // Create a contact object for the processor
    const johnContact: Contact = {
      file: johnFile,
      UID: 'john-uid-123',
      FN: 'John Doe'
    };

    // Manually invoke the RelatedListProcessor (simulating "Run curator processors on current contact")
    const result = await RelatedListProcessor.process(johnContact);

    // Assertions
    expect(result).toBeDefined();
    expect(result?.name).toBe('RelatedListProcessor');
    expect(result?.message).toContain('Added 2 missing relationship');
    expect(result?.message).toContain('to frontmatter');
    
    // Verify that vault.modify was called to update the frontmatter
    expect(mockApp.vault!.modify).toHaveBeenCalled();
    
    // Verify the updated frontmatter contains the relationships
    expect(updatedFrontmatter['RELATED[spouse]']).toBeDefined();
    expect(updatedFrontmatter['RELATED[spouse]']).toContain('jane-uid-456');
    expect(updatedFrontmatter['RELATED[1:friend]']).toBeDefined();
    expect(updatedFrontmatter['RELATED[1:friend]']).toContain('bob-uid-789');
  });

  it('should handle partial sync where some relationships exist and some are missing', async () => {
    // Setup: Contact has one relationship in frontmatter, but two in Related section
    const aliceFile = { basename: 'alice-brown', path: 'Contacts/alice-brown.md' } as TFile;
    const charlieFile = { basename: 'charlie-davis', path: 'Contacts/charlie-davis.md' } as TFile;
    const dianaFile = { basename: 'diana-evans', path: 'Contacts/diana-evans.md' } as TFile;

    mockContactFiles.set(aliceFile.path, aliceFile);
    mockContactFiles.set(charlieFile.path, charlieFile);
    mockContactFiles.set(dianaFile.path, dianaFile);

    const aliceContent = `---
UID: alice-uid-111
FN: Alice Brown
RELATED[colleague]: urn:uuid:charlie-uid-222
REV: 20240101T120000Z
---

#### Related
- colleague: [[Charlie Davis]]
- friend: [[Diana Evans]]

#Contact`;

    const charlieContent = `---
UID: charlie-uid-222
FN: Charlie Davis
---

#Contact`;

    const dianaContent = `---
UID: diana-uid-333
FN: Diana Evans
---

#Contact`;

    mockApp.vault!.read = vi.fn().mockImplementation((file: TFile) => {
      if (file.path === aliceFile.path) return Promise.resolve(aliceContent);
      if (file.path === charlieFile.path) return Promise.resolve(charlieContent);
      if (file.path === dianaFile.path) return Promise.resolve(dianaContent);
      return Promise.reject(new Error('File not found'));
    });

    mockApp.metadataCache!.getFileCache = vi.fn().mockImplementation((file: TFile) => {
      if (file.path === aliceFile.path) {
        return {
          frontmatter: {
            UID: 'alice-uid-111',
            FN: 'Alice Brown',
            'RELATED[colleague]': 'urn:uuid:charlie-uid-222',
            REV: '20240101T120000Z'
            // Missing: friend relationship to Diana
          }
        };
      }
      if (file.path === charlieFile.path) {
        return { frontmatter: { UID: 'charlie-uid-222', FN: 'Charlie Davis' } };
      }
      if (file.path === dianaFile.path) {
        return { frontmatter: { UID: 'diana-uid-333', FN: 'Diana Evans' } };
      }
      return null;
    });

    let updatedFrontmatter: Record<string, any> = {};
    mockApp.vault!.modify = vi.fn().mockImplementation(async (file: TFile, newContent: string) => {
      const frontmatterMatch = newContent.match(/^---\n([\s\S]*?)\n---/);
      if (frontmatterMatch) {
        const frontmatterText = frontmatterMatch[1];
        const lines = frontmatterText.split('\n');
        lines.forEach(line => {
          // Match key: value, handling brackets properly
          const match = line.match(/^([^:]+?(?:\[[^\]]*\])?):\s*(.+)$/);
          if (match) {
            updatedFrontmatter[match[1]] = match[2];
          }
        });
      }
      return Promise.resolve();
    });

    const aliceContact: Contact = {
      file: aliceFile,
      UID: 'alice-uid-111',
      FN: 'Alice Brown'
    };

    // Run the processor
    const result = await RelatedListProcessor.process(aliceContact);

    // Should detect 1 missing relationship (friend: Diana)
    expect(result).toBeDefined();
    expect(result?.message).toContain('Added 1 missing relationship');
    expect(mockApp.vault!.modify).toHaveBeenCalled();
    
    // Both relationships should be in the updated frontmatter
    expect(updatedFrontmatter['RELATED[colleague]']).toBeDefined();
    expect(updatedFrontmatter['RELATED[1:friend]']).toBeDefined();
  });

  it('should return undefined when all relationships are already synced', async () => {
    // Setup: Contact where Related section and frontmatter are already in sync
    const eveFile = { basename: 'eve-wilson', path: 'Contacts/eve-wilson.md' } as TFile;
    const frankFile = { basename: 'frank-miller', path: 'Contacts/frank-miller.md' } as TFile;

    mockContactFiles.set(eveFile.path, eveFile);
    mockContactFiles.set(frankFile.path, frankFile);

    const eveContent = `---
UID: eve-uid-444
FN: Eve Wilson
RELATED[spouse]: urn:uuid:frank-uid-555
REV: 20240101T120000Z
---

#### Related
- spouse: [[Frank Miller]]

#Contact`;

    const frankContent = `---
UID: frank-uid-555
FN: Frank Miller
---

#Contact`;

    mockApp.vault!.read = vi.fn().mockImplementation((file: TFile) => {
      if (file.path === eveFile.path) return Promise.resolve(eveContent);
      if (file.path === frankFile.path) return Promise.resolve(frankContent);
      return Promise.reject(new Error('File not found'));
    });

    mockApp.metadataCache!.getFileCache = vi.fn().mockImplementation((file: TFile) => {
      if (file.path === eveFile.path) {
        return {
          frontmatter: {
            UID: 'eve-uid-444',
            FN: 'Eve Wilson',
            'RELATED[spouse]': 'urn:uuid:frank-uid-555',
            REV: '20240101T120000Z'
          }
        };
      }
      if (file.path === frankFile.path) {
        return { frontmatter: { UID: 'frank-uid-555', FN: 'Frank Miller' } };
      }
      return null;
    });

    mockApp.vault!.modify = vi.fn();

    const eveContact: Contact = {
      file: eveFile,
      UID: 'eve-uid-444',
      FN: 'Eve Wilson'
    };

    // Run the processor
    const result = await RelatedListProcessor.process(eveContact);

    // Should return undefined when no changes are needed
    expect(result).toBeUndefined();
    expect(mockApp.vault!.modify).not.toHaveBeenCalled();
  });

  it('should update REV timestamp when adding missing relationships', async () => {
    const graceFile = { basename: 'grace-lee', path: 'Contacts/grace-lee.md' } as TFile;
    const henryFile = { basename: 'henry-kim', path: 'Contacts/henry-kim.md' } as TFile;

    mockContactFiles.set(graceFile.path, graceFile);
    mockContactFiles.set(henryFile.path, henryFile);

    const oldRev = '20240101T120000Z';
    const graceContent = `---
UID: grace-uid-666
FN: Grace Lee
REV: ${oldRev}
---

#### Related
- colleague: [[Henry Kim]]

#Contact`;

    const henryContent = `---
UID: henry-uid-777
FN: Henry Kim
---

#Contact`;

    mockApp.vault!.read = vi.fn().mockImplementation((file: TFile) => {
      if (file.path === graceFile.path) return Promise.resolve(graceContent);
      if (file.path === henryFile.path) return Promise.resolve(henryContent);
      return Promise.reject(new Error('File not found'));
    });

    mockApp.metadataCache!.getFileCache = vi.fn().mockImplementation((file: TFile) => {
      if (file.path === graceFile.path) {
        return {
          frontmatter: {
            UID: 'grace-uid-666',
            FN: 'Grace Lee',
            REV: oldRev
            // Missing: colleague relationship
          }
        };
      }
      if (file.path === henryFile.path) {
        return { frontmatter: { UID: 'henry-uid-777', FN: 'Henry Kim' } };
      }
      return null;
    });

    let updatedFrontmatter: Record<string, any> = {};
    mockApp.vault!.modify = vi.fn().mockImplementation(async (file: TFile, newContent: string) => {
      const frontmatterMatch = newContent.match(/^---\n([\s\S]*?)\n---/);
      if (frontmatterMatch) {
        const frontmatterText = frontmatterMatch[1];
        const lines = frontmatterText.split('\n');
        lines.forEach(line => {
          // Match key: value, handling brackets properly
          const match = line.match(/^([^:]+?(?:\[[^\]]*\])?):\s*(.+)$/);
          if (match) {
            updatedFrontmatter[match[1]] = match[2];
          }
        });
      }
      return Promise.resolve();
    });

    const graceContact: Contact = {
      file: graceFile,
      UID: 'grace-uid-666',
      FN: 'Grace Lee'
    };

    // Run the processor
    const result = await RelatedListProcessor.process(graceContact);

    expect(result).toBeDefined();
    expect(mockApp.vault!.modify).toHaveBeenCalled();
    
    // Verify REV was updated to a new timestamp
    expect(updatedFrontmatter['REV']).toBeDefined();
    expect(updatedFrontmatter['REV']).not.toBe(oldRev);
    // REV should be in the format: YYYYMMDDTHHMMSSZ
    expect(updatedFrontmatter['REV']).toMatch(/^\d{8}T\d{6}Z$/);
  });

  it('should handle contacts with no Related section gracefully', async () => {
    const isabelFile = { basename: 'isabel-nguyen', path: 'Contacts/isabel-nguyen.md' } as TFile;

    mockContactFiles.set(isabelFile.path, isabelFile);

    const isabelContent = `---
UID: isabel-uid-888
FN: Isabel Nguyen
---

#### Notes
Some notes about Isabel.

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(isabelContent);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'isabel-uid-888',
        FN: 'Isabel Nguyen'
      }
    });

    mockApp.vault!.modify = vi.fn();

    const isabelContact: Contact = {
      file: isabelFile,
      UID: 'isabel-uid-888',
      FN: 'Isabel Nguyen'
    };

    // Run the processor
    const result = await RelatedListProcessor.process(isabelContact);

    // Should return undefined when there's no Related section
    expect(result).toBeUndefined();
    expect(mockApp.vault!.modify).not.toHaveBeenCalled();
  });

  it('should fix malformed RELATED frontmatter keys (RELATED.type format)', async () => {
    // Setup: Contact with RELATED.friend format (malformed) in frontmatter
    // but correct format in Related section
    const jasonFile = { basename: 'jason-brown', path: 'Contacts/jason-brown.md' } as TFile;
    const kellyFile = { basename: 'kelly-white', path: 'Contacts/kelly-white.md' } as TFile;

    mockContactFiles.set(jasonFile.path, jasonFile);
    mockContactFiles.set(kellyFile.path, kellyFile);

    // Jason has malformed frontmatter with RELATED.friend (should be RELATED[friend])
    const jasonContent = `---
UID: jason-uid-999
FN: Jason Brown
RELATED.friend:
  - kelly-white
---

#### Related
- friend: [[Kelly White]]

#Contact`;

    const kellyContent = `---
UID: kelly-uid-000
FN: Kelly White
---

#Contact`;

    mockApp.vault!.read = vi.fn().mockImplementation((file: TFile) => {
      if (file.path === jasonFile.path) return Promise.resolve(jasonContent);
      if (file.path === kellyFile.path) return Promise.resolve(kellyContent);
      return Promise.reject(new Error('File not found'));
    });

    // The metadataCache will return the YAML as parsed by Obsidian
    // RELATED.friend becomes a nested structure
    mockApp.metadataCache!.getFileCache = vi.fn().mockImplementation((file: TFile) => {
      if (file.path === jasonFile.path) {
        return {
          frontmatter: {
            UID: 'jason-uid-999',
            FN: 'Jason Brown',
            RELATED: {
              friend: ['kelly-white']  // This is how YAML dot notation gets parsed
            }
          }
        };
      }
      if (file.path === kellyFile.path) {
        return { frontmatter: { UID: 'kelly-uid-000', FN: 'Kelly White' } };
      }
      return null;
    });

    let updatedFrontmatter: Record<string, any> = {};
    let updatedContent = '';
    mockApp.vault!.modify = vi.fn().mockImplementation(async (file: TFile, newContent: string) => {
      updatedContent = newContent;
      const frontmatterMatch = newContent.match(/^---\n([\s\S]*?)\n---/);
      if (frontmatterMatch) {
        const frontmatterText = frontmatterMatch[1];
        const lines = frontmatterText.split('\n');
        lines.forEach(line => {
          // Match key: value, handling brackets properly
          const match = line.match(/^([^:]+?(?:\[[^\]]*\])?):\s*(.+)$/);
          if (match) {
            updatedFrontmatter[match[1]] = match[2];
          }
        });
      }
      return Promise.resolve();
    });

    const jasonContact: Contact = {
      file: jasonFile,
      UID: 'jason-uid-999',
      FN: 'Jason Brown'
    };

    // Run the processor
    const result = await RelatedListProcessor.process(jasonContact);

    // Should detect that malformed keys need to be fixed
    expect(result).toBeDefined();
    expect(result?.message).toContain('missing relationship');
    expect(mockApp.vault!.modify).toHaveBeenCalled();
    
    // Verify the frontmatter was updated with correct format
    // Should have RELATED[friend] not RELATED.friend
    expect(updatedFrontmatter['RELATED[friend]']).toBeDefined();
    expect(updatedFrontmatter['RELATED[friend]']).toContain('kelly-uid-000');
    
    // Should NOT have the old malformed key
    expect(updatedContent).not.toContain('RELATED.friend');
    expect(updatedContent).toContain('RELATED[friend]');
  });
});
