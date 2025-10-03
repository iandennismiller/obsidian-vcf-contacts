import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { ContactsPluginSettings } from 'src/plugin/settings';
import { RelatedListProcessor } from '../../src/curators/relatedList';
import { RelatedFrontMatterProcessor } from '../../src/curators/relatedFrontMatter';
import { Contact } from '../../src/models';
import { setApp, clearApp } from 'src/plugin/context/sharedAppContext';
import { setSettings } from 'src/plugin/context/sharedSettingsContext';

/**
 * User Story 11b: Relationship Sync Preservation
 * 
 * As a user, when I manually invoke contact processing and a relationship exists in 
 * the Related list but is missing from frontmatter, I expect the plugin to add the 
 * missing relationship to frontmatter, not delete it from the Related list.
 * 
 * Similarly, when a relationship exists in frontmatter but is missing from the Related 
 * list, the plugin should add it to the Related list, not delete it from frontmatter.
 * 
 * The sync operations should always be additive (merging), never destructive (replacing), 
 * ensuring that relationships are preserved across both representations.
 */
describe('Relationship Sync Preservation Story', () => {
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
      logLevel: 'INFO',
      relatedListProcessor: true,
      relatedFrontMatterProcessor: true
    } as any;

    setApp(mockApp as App);
    setSettings(mockSettings);
  });

  afterEach(() => {
    clearApp();
  });

  it('should add missing relationship from Related list to frontmatter without deleting from Related list', async () => {
    // BUG REPRODUCTION: This test reproduces the bug where RelatedFrontMatterProcessor 
    // deletes relationships from the Related list when they're missing from frontmatter
    
    const aliceFile = { basename: 'alice-smith', path: 'Contacts/alice-smith.md' } as TFile;
    const bobFile = { basename: 'bob-jones', path: 'Contacts/bob-jones.md' } as TFile;

    mockContactFiles.set(aliceFile.path, aliceFile);
    mockContactFiles.set(bobFile.path, bobFile);

    // Alice has relationship in Related list but NOT in frontmatter
    const aliceContent = `---
UID: alice-uid-123
FN: Alice Smith
REV: 20240101T120000Z
---

#### Related
- friend [[Bob Jones]]

#Contact`;

    const bobContent = `---
UID: bob-uid-456
FN: Bob Jones
---

#Contact`;

    const fileContents: Map<string, string> = new Map([
      [aliceFile.path, aliceContent],
      [bobFile.path, bobContent]
    ]);

    mockApp.vault!.read = vi.fn().mockImplementation((file: TFile) => {
      const content = fileContents.get(file.path);
      if (content !== undefined) return Promise.resolve(content);
      return Promise.reject(new Error('File not found'));
    });

    mockApp.metadataCache!.getFileCache = vi.fn().mockImplementation((file: TFile) => {
      const content = fileContents.get(file.path);
      if (!content) return null;
      
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (frontmatterMatch) {
        try {
          const yaml = frontmatterMatch[1];
          const frontmatter: any = {};
          const lines = yaml.split('\n');
          lines.forEach(line => {
            const match = line.match(/^([^:]+?):\s*(.+)$/);
            if (match) {
              frontmatter[match[1].trim()] = match[2].trim();
            }
          });
          return { frontmatter };
        } catch (error) {
          return null;
        }
      }
      return null;
    });

    let updatedFrontmatter: Record<string, any> = {};
    let updatedContent = '';
    mockApp.vault!.modify = vi.fn().mockImplementation(async (file: TFile, newContent: string) => {
      updatedContent = newContent;
      fileContents.set(file.path, newContent);
      const frontmatterMatch = newContent.match(/^---\n([\s\S]*?)\n---/);
      if (frontmatterMatch) {
        const frontmatterText = frontmatterMatch[1];
        const lines = frontmatterText.split('\n');
        updatedFrontmatter = {};
        lines.forEach(line => {
          const match = line.match(/^"?([^":]+(?:\[[^\]]*\])?)"?:\s*(.+)$/);
          if (match) {
            const key = match[1].trim();
            const value = match[2].trim();
            updatedFrontmatter[key] = value;
          }
        });
      }
      return Promise.resolve();
    });

    const aliceContact: Contact = {
      file: aliceFile,
      UID: 'alice-uid-123',
      FN: 'Alice Smith'
    };

    // Run RelatedFrontMatterProcessor (this is where the bug occurs)
    const fmResult = await RelatedFrontMatterProcessor.process(aliceContact);

    // The processor should return undefined because there are no frontmatter relationships to sync
    // It should NOT delete the Related list item
    expect(fmResult).toBeUndefined();
    
    // Verify that the Related list still contains the relationship
    expect(updatedContent).toBe('');  // No modifications should have been made
    
    // Now run RelatedListProcessor to properly sync the relationship
    const listResult = await RelatedListProcessor.process(aliceContact);
    
    // Should detect the missing relationship in frontmatter
    expect(listResult).toBeDefined();
    expect(listResult?.message).toContain('Added 1 missing relationship');
    
    // Verify the relationship was added to frontmatter
    expect(updatedFrontmatter['RELATED[friend]']).toBeDefined();
    expect(updatedFrontmatter['RELATED[friend]']).toContain('bob-uid-456');
    
    // Verify the Related list still contains the relationship
    expect(updatedContent).toContain('- friend [[Bob Jones]]');
  });

  it('should add missing relationship from frontmatter to Related list without deleting from frontmatter', async () => {
    // Inverse scenario: relationship in frontmatter but not in Related list
    
    const charlieFile = { basename: 'charlie-brown', path: 'Contacts/charlie-brown.md' } as TFile;
    const dianaFile = { basename: 'diana-white', path: 'Contacts/diana-white.md' } as TFile;

    mockContactFiles.set(charlieFile.path, charlieFile);
    mockContactFiles.set(dianaFile.path, dianaFile);

    // Charlie has relationship in frontmatter but NOT in Related list
    const charlieContent = `---
UID: charlie-uid-789
FN: Charlie Brown
RELATED[colleague]: urn:uuid:diana-uid-012
REV: 20240101T120000Z
---

#### Related

#Contact`;

    const dianaContent = `---
UID: diana-uid-012
FN: Diana White
---

#Contact`;

    const fileContents: Map<string, string> = new Map([
      [charlieFile.path, charlieContent],
      [dianaFile.path, dianaContent]
    ]);

    mockApp.vault!.read = vi.fn().mockImplementation((file: TFile) => {
      const content = fileContents.get(file.path);
      if (content !== undefined) return Promise.resolve(content);
      return Promise.reject(new Error('File not found'));
    });

    mockApp.metadataCache!.getFileCache = vi.fn().mockImplementation((file: TFile) => {
      const content = fileContents.get(file.path);
      if (!content) return null;
      
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (frontmatterMatch) {
        try {
          const yaml = frontmatterMatch[1];
          const frontmatter: any = {};
          const lines = yaml.split('\n');
          lines.forEach(line => {
            const match = line.match(/^([^:]+?):\s*(.+)$/);
            if (match) {
              frontmatter[match[1].trim()] = match[2].trim();
            }
          });
          return { frontmatter };
        } catch (error) {
          return null;
        }
      }
      return null;
    });

    let updatedFrontmatter: Record<string, any> = {};
    let updatedContent = '';
    mockApp.vault!.modify = vi.fn().mockImplementation(async (file: TFile, newContent: string) => {
      updatedContent = newContent;
      fileContents.set(file.path, newContent);
      const frontmatterMatch = newContent.match(/^---\n([\s\S]*?)\n---/);
      if (frontmatterMatch) {
        const frontmatterText = frontmatterMatch[1];
        const lines = frontmatterText.split('\n');
        updatedFrontmatter = {};
        lines.forEach(line => {
          const match = line.match(/^"?([^":]+(?:\[[^\]]*\])?)"?:\s*(.+)$/);
          if (match) {
            const key = match[1].trim();
            const value = match[2].trim();
            updatedFrontmatter[key] = value;
          }
        });
      }
      return Promise.resolve();
    });

    const charlieContact: Contact = {
      file: charlieFile,
      UID: 'charlie-uid-789',
      FN: 'Charlie Brown'
    };

    // Run RelatedListProcessor first (should return undefined - no Related list items)
    const listResult = await RelatedListProcessor.process(charlieContact);
    expect(listResult).toBeUndefined();

    // Run RelatedFrontMatterProcessor to sync frontmatter to Related list
    const fmResult = await RelatedFrontMatterProcessor.process(charlieContact);
    
    // Should detect the missing relationship in Related list
    expect(fmResult).toBeDefined();
    expect(fmResult?.message).toContain('Added 1 missing relationship');
    
    // Verify the relationship was added to the Related list
    expect(updatedContent).toContain('- colleague [[Diana White]]');
    
    // Verify the frontmatter still contains the relationship
    expect(updatedContent).toContain('RELATED[colleague]: urn:uuid:diana-uid-012');
  });

  it('should not delete Related list items when different frontmatter relationship exists', async () => {
    // BUG SCENARIO: Related list has "friend: Bob" but frontmatter has "colleague: Charlie"
    // RelatedFrontMatterProcessor should ADD Charlie to Related list, NOT delete Bob
    
    const gregFile = { basename: 'greg-taylor', path: 'Contacts/greg-taylor.md' } as TFile;
    const bobFile = { basename: 'bob-jones', path: 'Contacts/bob-jones.md' } as TFile;
    const charlieFile = { basename: 'charlie-wilson', path: 'Contacts/charlie-wilson.md' } as TFile;

    mockContactFiles.set(gregFile.path, gregFile);
    mockContactFiles.set(bobFile.path, bobFile);
    mockContactFiles.set(charlieFile.path, charlieFile);

    // Greg has "friend: Bob" in Related list but "colleague: Charlie" in frontmatter
    const gregContent = `---
UID: greg-uid-999
FN: Greg Taylor
RELATED[colleague]: urn:uuid:charlie-uid-888
REV: 20240101T120000Z
---

#### Related
- friend [[Bob Jones]]

#Contact`;

    const bobContent = `---
UID: bob-uid-777
FN: Bob Jones
---

#Contact`;

    const charlieContent = `---
UID: charlie-uid-888
FN: Charlie Wilson
---

#Contact`;

    const fileContents: Map<string, string> = new Map([
      [gregFile.path, gregContent],
      [bobFile.path, bobContent],
      [charlieFile.path, charlieContent]
    ]);

    mockApp.vault!.read = vi.fn().mockImplementation((file: TFile) => {
      const content = fileContents.get(file.path);
      if (content !== undefined) return Promise.resolve(content);
      return Promise.reject(new Error('File not found'));
    });

    mockApp.metadataCache!.getFileCache = vi.fn().mockImplementation((file: TFile) => {
      const content = fileContents.get(file.path);
      if (!content) return null;
      
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (frontmatterMatch) {
        try {
          const yaml = frontmatterMatch[1];
          const frontmatter: any = {};
          const lines = yaml.split('\n');
          lines.forEach(line => {
            const match = line.match(/^([^:]+?):\s*(.+)$/);
            if (match) {
              frontmatter[match[1].trim()] = match[2].trim();
            }
          });
          return { frontmatter };
        } catch (error) {
          return null;
        }
      }
      return null;
    });

    let updatedContent = '';
    mockApp.vault!.modify = vi.fn().mockImplementation(async (file: TFile, newContent: string) => {
      updatedContent = newContent;
      fileContents.set(file.path, newContent);
      return Promise.resolve();
    });

    const gregContact: Contact = {
      file: gregFile,
      UID: 'greg-uid-999',
      FN: 'Greg Taylor'
    };

    // Run RelatedFrontMatterProcessor - it should ADD Charlie to Related list
    const fmResult = await RelatedFrontMatterProcessor.process(gregContact);
    
    // Should detect that Charlie is missing from Related list
    expect(fmResult).toBeDefined();
    expect(fmResult?.message).toContain('Added 1 missing relationship');
    
    // Verify both relationships exist in the final content
    expect(updatedContent).toContain('- friend [[Bob Jones]]');  // Should NOT be deleted!
    expect(updatedContent).toContain('- colleague [[Charlie Wilson]]');  // Should be added
    expect(updatedContent).toContain('RELATED[colleague]: urn:uuid:charlie-uid-888');
  });

  it('should handle both processors running in sequence without data loss', async () => {
    // This tests the complete scenario where both processors run
    
    const eveFile = { basename: 'eve-davis', path: 'Contacts/eve-davis.md' } as TFile;
    const frankFile = { basename: 'frank-miller', path: 'Contacts/frank-miller.md' } as TFile;

    mockContactFiles.set(eveFile.path, eveFile);
    mockContactFiles.set(frankFile.path, frankFile);

    // Eve has relationship in Related list but not in frontmatter
    const eveContent = `---
UID: eve-uid-345
FN: Eve Davis
REV: 20240101T120000Z
---

#### Related
- spouse [[Frank Miller]]

#Contact`;

    const frankContent = `---
UID: frank-uid-678
FN: Frank Miller
---

#Contact`;

    const fileContents: Map<string, string> = new Map([
      [eveFile.path, eveContent],
      [frankFile.path, frankContent]
    ]);

    mockApp.vault!.read = vi.fn().mockImplementation((file: TFile) => {
      const content = fileContents.get(file.path);
      if (content !== undefined) return Promise.resolve(content);
      return Promise.reject(new Error('File not found'));
    });

    mockApp.metadataCache!.getFileCache = vi.fn().mockImplementation((file: TFile) => {
      const content = fileContents.get(file.path);
      if (!content) return null;
      
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (frontmatterMatch) {
        try {
          const yaml = frontmatterMatch[1];
          const frontmatter: any = {};
          const lines = yaml.split('\n');
          lines.forEach(line => {
            const match = line.match(/^([^:]+?):\s*(.+)$/);
            if (match) {
              frontmatter[match[1].trim()] = match[2].trim();
            }
          });
          return { frontmatter };
        } catch (error) {
          return null;
        }
      }
      return null;
    });

    let updatedContent = '';
    mockApp.vault!.modify = vi.fn().mockImplementation(async (file: TFile, newContent: string) => {
      updatedContent = newContent;
      fileContents.set(file.path, newContent);
      return Promise.resolve();
    });

    const eveContact: Contact = {
      file: eveFile,
      UID: 'eve-uid-345',
      FN: 'Eve Davis'
    };

    // Run both processors in sequence (simulating manual curator execution)
    await RelatedFrontMatterProcessor.process(eveContact);
    const finalResult = await RelatedListProcessor.process(eveContact);
    
    // At least one processor should have made changes
    expect(finalResult).toBeDefined();
    
    // Verify both representations exist in the final content
    expect(updatedContent).toContain('- spouse [[Frank Miller]]');
    expect(updatedContent).toContain('RELATED[spouse]');
    expect(updatedContent).toContain('frank-uid-678');
  });

  it('should preserve both relationships when syncing in both directions', async () => {
    // Complex scenario: multiple relationships in both locations, some overlapping, some unique
    
    const helenFile = { basename: 'helen-garcia', path: 'Contacts/helen-garcia.md' } as TFile;
    const ivanFile = { basename: 'ivan-petrov', path: 'Contacts/ivan-petrov.md' } as TFile;
    const juliaFile = { basename: 'julia-wong', path: 'Contacts/julia-wong.md' } as TFile;
    const kevinFile = { basename: 'kevin-singh', path: 'Contacts/kevin-singh.md' } as TFile;

    mockContactFiles.set(helenFile.path, helenFile);
    mockContactFiles.set(ivanFile.path, ivanFile);
    mockContactFiles.set(juliaFile.path, juliaFile);
    mockContactFiles.set(kevinFile.path, kevinFile);

    // Helen has:
    // - Related list: friend Ivan, colleague Julia
    // - Frontmatter: colleague Julia (overlaps), neighbor Kevin (unique to frontmatter)
    const helenContent = `---
UID: helen-uid-111
FN: Helen Garcia
RELATED[colleague]: urn:uuid:julia-uid-333
RELATED[neighbor]: urn:uuid:kevin-uid-444
REV: 20240101T120000Z
---

#### Related
- friend [[Ivan Petrov]]
- colleague [[Julia Wong]]

#Contact`;

    const ivanContent = `---
UID: ivan-uid-222
FN: Ivan Petrov
---

#Contact`;

    const juliaContent = `---
UID: julia-uid-333
FN: Julia Wong
---

#Contact`;

    const kevinContent = `---
UID: kevin-uid-444
FN: Kevin Singh
---

#Contact`;

    const fileContents: Map<string, string> = new Map([
      [helenFile.path, helenContent],
      [ivanFile.path, ivanContent],
      [juliaFile.path, juliaContent],
      [kevinFile.path, kevinContent]
    ]);

    mockApp.vault!.read = vi.fn().mockImplementation((file: TFile) => {
      const content = fileContents.get(file.path);
      if (content !== undefined) return Promise.resolve(content);
      return Promise.reject(new Error('File not found'));
    });

    mockApp.metadataCache!.getFileCache = vi.fn().mockImplementation((file: TFile) => {
      const content = fileContents.get(file.path);
      if (!content) return null;
      
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (frontmatterMatch) {
        try {
          const yaml = frontmatterMatch[1];
          const frontmatter: any = {};
          const lines = yaml.split('\n');
          lines.forEach(line => {
            const match = line.match(/^([^:]+?):\s*(.+)$/);
            if (match) {
              frontmatter[match[1].trim()] = match[2].trim();
            }
          });
          return { frontmatter };
        } catch (error) {
          return null;
        }
      }
      return null;
    });

    let updatedContent = '';
    mockApp.vault!.modify = vi.fn().mockImplementation(async (file: TFile, newContent: string) => {
      updatedContent = newContent;
      fileContents.set(file.path, newContent);
      return Promise.resolve();
    });

    const helenContact: Contact = {
      file: helenFile,
      UID: 'helen-uid-111',
      FN: 'Helen Garcia'
    };

    // Run frontmatter processor first - should add Kevin to Related list
    const fmResult = await RelatedFrontMatterProcessor.process(helenContact);
    expect(fmResult).toBeDefined();
    
    // Run list processor - should add Ivan to frontmatter
    const listResult = await RelatedListProcessor.process(helenContact);
    expect(listResult).toBeDefined();
    
    // Verify all three relationships exist in both locations
    // Related list should have: friend Ivan, colleague Julia, neighbor Kevin
    expect(updatedContent).toContain('- friend [[Ivan Petrov]]');
    expect(updatedContent).toContain('- colleague [[Julia Wong]]');
    expect(updatedContent).toContain('- neighbor [[Kevin Singh]]');
    
    // Frontmatter should have: friend Ivan, colleague Julia, neighbor Kevin
    expect(updatedContent).toContain('RELATED[friend]');
    expect(updatedContent).toContain('ivan-uid-222');
    expect(updatedContent).toContain('RELATED[colleague]');
    expect(updatedContent).toContain('julia-uid-333');
    expect(updatedContent).toContain('RELATED[neighbor]');
    expect(updatedContent).toContain('kevin-uid-444');
  });
});
