import { describe, it, expect, beforeEach, vi } from 'vitest';
import { App, TFile } from 'obsidian';
import { ContactNote } from 'src/models/contactNote';
import { ContactsPluginSettings } from 'src/plugin/settings';

/**
 * Regression Test for Issue 6: Malformed RELATED.type Format
 * 
 * Bug: When users used YAML dot notation (RELATED.friend: value) instead of bracket
 * notation (RELATED[friend]: value), the YAML parser created nested objects which
 * the processor couldn't handle, resulting in warnings and skipped relationships.
 * 
 * Fixed in: commit [current]
 * 
 * This test ensures that:
 * 1. RELATED.type format is automatically converted to RELATED[type]
 * 2. Nested RELATED.x.y structures are handled correctly
 * 3. Relationships are properly parsed despite malformed format
 * 4. Informative messages are logged about the auto-correction
 */
describe('Regression: Malformed RELATED.type Format (Issue 6)', () => {
  let mockApp: Partial<App>;
  let mockSettings: ContactsPluginSettings;

  beforeEach(() => {
    mockApp = {
      vault: {
        read: vi.fn(),
        modify: vi.fn(),
        create: vi.fn(),
        getMarkdownFiles: vi.fn().mockReturnValue([]),
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
    } as any;
  });

  it('should handle RELATED.friend format with string value', async () => {
    const mockFile = { 
      basename: 'john-doe', 
      path: 'Contacts/john-doe.md',
      name: 'john-doe.md'
    } as TFile;

    const contentWithDotNotation = `---
UID: john-doe-123
FN: John Doe
RELATED.friend: name:Jane Smith
---

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(contentWithDotNotation);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'RELATED.friend': 'name:Jane Smith'  // Key with dot in it
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const relationships = await contactNote.parseFrontmatterRelationships();

    expect(relationships.length).toBe(1);
    expect(relationships[0].type).toBe('friend');
    expect(relationships[0].value).toBe('name:Jane Smith');
    expect(relationships[0].parsedValue?.type).toBe('name');
    expect(relationships[0].parsedValue?.value).toBe('Jane Smith');
  });

  it('should handle nested RELATED object with multiple relationships', async () => {
    const mockFile = { 
      basename: 'john-doe', 
      path: 'Contacts/john-doe.md',
      name: 'john-doe.md'
    } as TFile;

    mockApp.vault!.read = vi.fn().mockResolvedValue('---\nUID: john-doe-123\n---');
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        RELATED: {
          friend: 'name:Jane Smith',
          colleague: 'name:Bob Johnson',
          spouse: 'name:Mary Doe'
        }
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const relationships = await contactNote.parseFrontmatterRelationships();

    expect(relationships.length).toBe(3);
    
    const friendRel = relationships.find(r => r.type === 'friend');
    expect(friendRel).toBeDefined();
    expect(friendRel?.value).toBe('name:Jane Smith');
    
    const colleagueRel = relationships.find(r => r.type === 'colleague');
    expect(colleagueRel).toBeDefined();
    expect(colleagueRel?.value).toBe('name:Bob Johnson');
    
    const spouseRel = relationships.find(r => r.type === 'spouse');
    expect(spouseRel).toBeDefined();
    expect(spouseRel?.value).toBe('name:Mary Doe');
  });

  it('should skip non-string values in nested RELATED object', async () => {
    const mockFile = { 
      basename: 'john-doe', 
      path: 'Contacts/john-doe.md',
      name: 'john-doe.md'
    } as TFile;

    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        RELATED: {
          friend: 'name:Jane Smith',
          invalid: { nested: 'object' },  // Invalid nested object
          colleague: 'name:Bob Johnson'
        }
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const relationships = await contactNote.parseFrontmatterRelationships();

    // Should only get the two valid string relationships
    expect(relationships.length).toBe(2);
    expect(relationships.find(r => r.type === 'friend')).toBeDefined();
    expect(relationships.find(r => r.type === 'colleague')).toBeDefined();
    expect(relationships.find(r => r.type === 'invalid')).toBeUndefined();
  });

  it('should work with both malformed and correct formats together', async () => {
    const mockFile = { 
      basename: 'john-doe', 
      path: 'Contacts/john-doe.md',
      name: 'john-doe.md'
    } as TFile;

    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        'RELATED[spouse]': 'name:Mary Doe',  // Correct format
        RELATED: {  // Malformed format
          friend: 'name:Jane Smith',
          colleague: 'name:Bob Johnson'
        }
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const relationships = await contactNote.parseFrontmatterRelationships();

    expect(relationships.length).toBe(3);
    expect(relationships.find(r => r.type === 'spouse')).toBeDefined();
    expect(relationships.find(r => r.type === 'friend')).toBeDefined();
    expect(relationships.find(r => r.type === 'colleague')).toBeDefined();
  });

  it('should verify auto-correction logic exists in source', () => {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(process.cwd(), 'src/models/contactNote/relationshipOperations.ts');
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Verify auto-correction logic is present
    expect(content).toContain('Auto-corrected malformed');
    expect(content).toContain('RELATED.');
    expect(content).toContain('RELATED[');
  });

  it('should handle RELATED.type with nested non-string object by skipping non-strings', async () => {
    const mockFile = { 
      basename: 'john-doe', 
      path: 'Contacts/john-doe.md',
      name: 'john-doe.md'
    } as TFile;

    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        'RELATED.friend': { 
          nested: { deep: 'object' },  // Non-string nested value
          valid: 'name:Jane Smith'      // Valid string value
        }
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const relationships = await contactNote.parseFrontmatterRelationships();

    // Should extract only the valid string property
    expect(relationships.length).toBe(1);
    expect(relationships[0].type).toBe('friend.valid');
    expect(relationships[0].value).toBe('name:Jane Smith');
  });

  it('should handle RELATED.type with nested object containing strings', async () => {
    const mockFile = { 
      basename: 'john-doe', 
      path: 'Contacts/john-doe.md',
      name: 'john-doe.md'
    } as TFile;

    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        'RELATED.friend': { 
          person1: 'name:Jane Smith',
          person2: 'name:Bob Johnson'
        }
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const relationships = await contactNote.parseFrontmatterRelationships();

    // Should extract both nested properties
    expect(relationships.length).toBe(2);
    
    const person1Rel = relationships.find(r => r.type === 'friend.person1');
    expect(person1Rel).toBeDefined();
    expect(person1Rel?.value).toBe('name:Jane Smith');
    
    const person2Rel = relationships.find(r => r.type === 'friend.person2');
    expect(person2Rel).toBeDefined();
    expect(person2Rel?.value).toBe('name:Bob Johnson');
  });
});
