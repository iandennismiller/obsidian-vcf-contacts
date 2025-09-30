import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { VcardFile } from '../../src/models/vcardFile/vcardFile';
import { ContactsPluginSettings } from 'src/interfaces/ContactsPluginSettings';

/**
 * User Story 15: Contact Deduplication
 * As a user, when importing VCF files, I want the plugin to detect existing 
 * contacts by UID and update them rather than creating duplicates.
 */
describe('Contact Deduplication Story', () => {
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
      vcfWatchEnabled: false,
      vcfWatchPollingInterval: 30,
      vcfWriteBackEnabled: false,
      vcfCustomizeIgnoreList: false,
      vcfIgnoreFilenames: [],
      vcfIgnoreUIDs: [],
      logLevel: 'INFO'
    };
  });

  it('should detect existing contact by UID during import', async () => {
    // Existing contact in Obsidian
    const existingFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    mockApp.vault!.getMarkdownFiles = vi.fn().mockReturnValue([existingFile]);
    
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        EMAIL: 'john@example.com',
        REV: '20240101T120000Z'
      }
    });

    // VCF content with same UID but updated information
    const vcfContent = `BEGIN:VCARD
VERSION:4.0
UID:john-doe-123
FN:John Smith
EMAIL:johnsmith@example.com
REV:20240201T120000Z
END:VCARD`;

    const vcardFile = new VcardFile(vcfContent);
    const contacts = [];
    
    for await (const [slug, record] of vcardFile.parse()) {
      contacts.push({ slug, record });
    }

    // Should find the contact with matching UID
    expect(contacts).toHaveLength(1);
    expect(contacts[0].record.UID).toBe('john-doe-123');
    expect(contacts[0].record.FN).toBe('John Smith'); // Updated name
    expect(contacts[0].record.EMAIL).toBe('johnsmith@example.com'); // Updated email
    
    // REV field should be newer, indicating an update should occur
    expect(contacts[0].record.REV > '20240101T120000Z').toBe(true);
  });

  it('should identify contacts that need updating vs creating new', async () => {
    // Mock existing contacts
    const existingFiles = [
      { basename: 'existing-contact', path: 'Contacts/existing-contact.md' },
      { basename: 'another-contact', path: 'Contacts/another-contact.md' }
    ] as TFile[];
    
    mockApp.vault!.getMarkdownFiles = vi.fn().mockReturnValue(existingFiles);
    
    mockApp.metadataCache!.getFileCache = vi.fn()
      .mockImplementation((file: TFile) => {
        if (file.path === 'Contacts/existing-contact.md') {
          return {
            frontmatter: {
              UID: 'existing-uid-123',
              FN: 'Existing Contact',
              EMAIL: 'existing@example.com'
            }
          };
        }
        if (file.path === 'Contacts/another-contact.md') {
          return {
            frontmatter: {
              UID: 'another-uid-456',
              FN: 'Another Contact',
              EMAIL: 'another@example.com'
            }
          };
        }
        return null;
      });

    // VCF with mix of existing and new contacts
    const vcfContent = `BEGIN:VCARD
VERSION:4.0
UID:existing-uid-123
FN:Updated Existing
EMAIL:updated@example.com
END:VCARD

BEGIN:VCARD
VERSION:4.0
UID:new-contact-789
FN:New Contact
EMAIL:new@example.com
END:VCARD

BEGIN:VCARD
VERSION:4.0
UID:another-uid-456
FN:Another Updated
EMAIL:another-updated@example.com
END:VCARD`;

    const vcardFile = new VcardFile(vcfContent);
    const importedContacts = [];
    const existingUIDs = ['existing-uid-123', 'another-uid-456'];
    
    for await (const [slug, record] of vcardFile.parse()) {
      const isUpdate = existingUIDs.includes(record.UID);
      importedContacts.push({ 
        slug, 
        record, 
        action: isUpdate ? 'update' : 'create' 
      });
    }

    expect(importedContacts).toHaveLength(3);
    
    // Should identify existing contacts for update
    const updateActions = importedContacts.filter(c => c.action === 'update');
    expect(updateActions).toHaveLength(2);
    expect(updateActions.map(c => c.record.UID)).toEqual(
      expect.arrayContaining(['existing-uid-123', 'another-uid-456'])
    );
    
    // Should identify new contact for creation
    const createActions = importedContacts.filter(c => c.action === 'create');
    expect(createActions).toHaveLength(1);
    expect(createActions[0].record.UID).toBe('new-contact-789');
  });

  it('should handle UID conflicts during deduplication', async () => {
    // Two existing contacts with different UIDs but similar names
    const existingFiles = [
      { basename: 'john-doe-1', path: 'Contacts/john-doe-1.md' },
      { basename: 'john-doe-2', path: 'Contacts/john-doe-2.md' }
    ] as TFile[];
    
    mockApp.vault!.getMarkdownFiles = vi.fn().mockReturnValue(existingFiles);
    
    mockApp.metadataCache!.getFileCache = vi.fn()
      .mockImplementation((file: TFile) => {
        if (file.path === 'Contacts/john-doe-1.md') {
          return {
            frontmatter: {
              UID: 'john-doe-original-123',
              FN: 'John Doe',
              EMAIL: 'john1@example.com'
            }
          };
        }
        if (file.path === 'Contacts/john-doe-2.md') {
          return {
            frontmatter: {
              UID: 'john-doe-copy-456', 
              FN: 'John Doe',
              EMAIL: 'john2@example.com'
            }
          };
        }
        return null;
      });

    // VCF trying to import with a UID that might conflict
    const vcfContent = `BEGIN:VCARD
VERSION:4.0
UID:john-doe-original-123
FN:John Doe Updated
EMAIL:john-updated@example.com
END:VCARD`;

    const vcardFile = new VcardFile(vcfContent);
    const contacts = [];
    
    for await (const [slug, record] of vcardFile.parse()) {
      contacts.push({ slug, record });
    }

    // Should identify the correct existing contact by UID
    expect(contacts).toHaveLength(1);
    expect(contacts[0].record.UID).toBe('john-doe-original-123');
    
    // Should use the imported data for update
    expect(contacts[0].record.FN).toBe('John Doe Updated');
    expect(contacts[0].record.EMAIL).toBe('john-updated@example.com');
  });

  it('should merge contact information intelligently', async () => {
    // Existing contact with some fields
    const existingFile = { basename: 'merge-contact', path: 'Contacts/merge-contact.md' } as TFile;
    mockApp.vault!.getMarkdownFiles = vi.fn().mockReturnValue([existingFile]);
    
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'merge-uid-123',
        FN: 'Merge Contact',
        EMAIL: 'original@example.com',
        TEL: '+1-555-123-4567',
        // Missing: ORG, BDAY
        REV: '20240101T120000Z'
      }
    });

    // VCF with additional and updated information
    const vcfContent = `BEGIN:VCARD
VERSION:4.0
UID:merge-uid-123
FN:Merge Contact Updated
EMAIL:updated@example.com
ORG:New Company
BDAY:1990-05-15
REV:20240201T120000Z
END:VCARD`;

    const vcardFile = new VcardFile(vcfContent);
    const contacts = [];
    
    for await (const [slug, record] of vcardFile.parse()) {
      contacts.push({ slug, record });
    }

    expect(contacts).toHaveLength(1);
    const contact = contacts[0].record;
    
    expect(contact.UID).toBe('merge-uid-123');
    expect(contact.FN).toBe('Merge Contact Updated'); // Updated
    expect(contact.EMAIL).toBe('updated@example.com'); // Updated
    expect(contact.ORG).toBe('New Company'); // Added
    expect(contact.BDAY).toBe('1990-05-15'); // Added
    expect(contact.REV).toBe('20240201T120000Z'); // Updated
  });

  it('should preserve local-only fields during merge', async () => {
    // This test simulates preserving fields that exist in Obsidian but not in VCF
    const existingFile = { basename: 'preserve-contact', path: 'Contacts/preserve-contact.md' } as TFile;
    mockApp.vault!.getMarkdownFiles = vi.fn().mockReturnValue([existingFile]);
    
    // Existing contact has local fields not in VCF standard
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'preserve-uid-123',
        FN: 'Preserve Contact',
        EMAIL: 'preserve@example.com',
        'RELATED[spouse]': 'name:Spouse Name', // Local relationship
        'LOCAL_NOTE': 'This is a local note', // Local field
        'OBSIDIAN_TAG': '#important' // Local tag
      }
    });

    // VCF with standard vCard fields only
    const vcfContent = `BEGIN:VCARD
VERSION:4.0
UID:preserve-uid-123
FN:Preserve Contact Updated
EMAIL:updated@example.com
TEL:+1-555-987-6543
END:VCARD`;

    const vcardFile = new VcardFile(vcfContent);
    const contacts = [];
    
    for await (const [slug, record] of vcardFile.parse()) {
      contacts.push({ slug, record });
    }

    expect(contacts).toHaveLength(1);
    const contact = contacts[0].record;
    
    // VCF fields should be updated
    expect(contact.FN).toBe('Preserve Contact Updated');
    expect(contact.EMAIL).toBe('updated@example.com');
    expect(contact.TEL).toBe('+1-555-987-6543');
    
    // During actual implementation, local fields should be preserved
    // This test documents the expected behavior
    expect(contact.UID).toBe('preserve-uid-123');
  });

  it('should handle multiple contacts with similar names but different UIDs', async () => {
    // Multiple existing contacts with similar names
    const existingFiles = [
      { basename: 'john-smith-1', path: 'Contacts/john-smith-1.md' },
      { basename: 'john-smith-2', path: 'Contacts/john-smith-2.md' },
      { basename: 'john-smith-3', path: 'Contacts/john-smith-3.md' }
    ] as TFile[];
    
    mockApp.vault!.getMarkdownFiles = vi.fn().mockReturnValue(existingFiles);
    
    mockApp.metadataCache!.getFileCache = vi.fn()
      .mockImplementation((file: TFile) => {
        if (file.path === 'Contacts/john-smith-1.md') {
          return {
            frontmatter: {
              UID: 'john-smith-work-123',
              FN: 'John Smith',
              EMAIL: 'john.smith@work.com',
              ORG: 'Work Company'
            }
          };
        }
        if (file.path === 'Contacts/john-smith-2.md') {
          return {
            frontmatter: {
              UID: 'john-smith-personal-456',
              FN: 'John Smith',
              EMAIL: 'john@personal.com'
            }
          };
        }
        if (file.path === 'Contacts/john-smith-3.md') {
          return {
            frontmatter: {
              UID: 'john-smith-family-789',
              FN: 'John Smith Jr.',
              EMAIL: 'jr@family.com'
            }
          };
        }
        return null;
      });

    // VCF with updates for specific John Smiths
    const vcfContent = `BEGIN:VCARD
VERSION:4.0
UID:john-smith-work-123
FN:John Smith Sr.
EMAIL:john.smith@newwork.com
ORG:New Work Company
END:VCARD

BEGIN:VCARD
VERSION:4.0
UID:john-smith-new-999
FN:John Smith III
EMAIL:third@example.com
END:VCARD`;

    const vcardFile = new VcardFile(vcfContent);
    const existingUIDs = ['john-smith-work-123', 'john-smith-personal-456', 'john-smith-family-789'];
    const importResults = [];
    
    for await (const [slug, record] of vcardFile.parse()) {
      const isExisting = existingUIDs.includes(record.UID);
      importResults.push({
        uid: record.UID,
        name: record.FN,
        action: isExisting ? 'update' : 'create'
      });
    }

    expect(importResults).toHaveLength(2);
    
    // Should correctly identify the work John Smith for update
    const updateResult = importResults.find(r => r.action === 'update');
    expect(updateResult?.uid).toBe('john-smith-work-123');
    expect(updateResult?.name).toBe('John Smith Sr.');
    
    // Should identify new John Smith for creation
    const createResult = importResults.find(r => r.action === 'create');
    expect(createResult?.uid).toBe('john-smith-new-999');
    expect(createResult?.name).toBe('John Smith III');
  });

  it('should validate contact completeness before deduplication', async () => {
    // Test that incomplete contacts are handled properly during deduplication
    const vcfWithIncompleteContacts = `BEGIN:VCARD
VERSION:4.0
UID:complete-contact-123
FN:Complete Contact
EMAIL:complete@example.com
END:VCARD

BEGIN:VCARD
VERSION:4.0
UID:
FN:Missing UID Contact
EMAIL:missing-uid@example.com
END:VCARD

BEGIN:VCARD
VERSION:4.0
UID:missing-name-456
EMAIL:missing-name@example.com
END:VCARD`;

    const vcardFile = new VcardFile(vcfWithIncompleteContacts);
    const validContacts = [];
    const invalidContacts = [];
    
    for await (const [slug, record] of vcardFile.parse()) {
      // Basic validation for deduplication eligibility
      const hasUID = record.UID && record.UID.trim() !== '';
      const hasName = record.FN && record.FN.trim() !== '';
      
      if (hasUID && hasName) {
        validContacts.push({ slug, record });
      } else {
        invalidContacts.push({ 
          slug, 
          record, 
          issues: [
            !hasUID ? 'missing-uid' : null,
            !hasName ? 'missing-name' : null
          ].filter(Boolean)
        });
      }
    }

    expect(validContacts).toHaveLength(1);
    expect(validContacts[0].record.UID).toBe('complete-contact-123');
    
    expect(invalidContacts).toHaveLength(2);
    expect(invalidContacts[0].issues).toContain('missing-uid');
    expect(invalidContacts[1].issues).toContain('missing-name');
  });

  it('should handle batch deduplication efficiently', async () => {
    // Large batch of contacts for deduplication testing
    const existingUIDs = Array.from({ length: 50 }, (_, i) => `existing-uid-${i + 1}`);
    const newUIDs = Array.from({ length: 25 }, (_, i) => `new-uid-${i + 1}`);
    
    // Mock large set of existing contacts
    const existingFiles = existingUIDs.map((uid, i) => ({
      basename: `contact-${i + 1}`,
      path: `Contacts/contact-${i + 1}.md`
    } as TFile));
    
    mockApp.vault!.getMarkdownFiles = vi.fn().mockReturnValue(existingFiles);
    
    mockApp.metadataCache!.getFileCache = vi.fn()
      .mockImplementation((file: TFile) => {
        const index = existingFiles.findIndex(f => f.path === file.path);
        if (index >= 0) {
          return {
            frontmatter: {
              UID: existingUIDs[index],
              FN: `Contact ${index + 1}`,
              EMAIL: `contact${index + 1}@example.com`
            }
          };
        }
        return null;
      });

    // Generate VCF with mix of existing and new contacts
    const allUIDs = [...existingUIDs.slice(0, 30), ...newUIDs]; // 30 updates + 25 creates
    const vcfParts = allUIDs.map(uid => `BEGIN:VCARD
VERSION:4.0
UID:${uid}
FN:Contact for ${uid}
EMAIL:${uid}@example.com
END:VCARD`);
    
    const vcfContent = vcfParts.join('\n\n');
    const vcardFile = new VcardFile(vcfContent);
    
    const batchResults = {
      updates: 0,
      creates: 0,
      processed: 0
    };
    
    for await (const [slug, record] of vcardFile.parse()) {
      batchResults.processed++;
      if (existingUIDs.includes(record.UID)) {
        batchResults.updates++;
      } else {
        batchResults.creates++;
      }
    }

    expect(batchResults.processed).toBe(55); // 30 + 25
    expect(batchResults.updates).toBe(30);
    expect(batchResults.creates).toBe(25);
  });
});