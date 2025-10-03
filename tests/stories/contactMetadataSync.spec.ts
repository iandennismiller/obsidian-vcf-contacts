import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { ContactNote } from '../../src/models/contactNote';
import { VCardGenerator } from '../../src/models/vcardFile/generation';
import { ContactsPluginSettings } from 'src/plugin/settings';

/**
 * User Story 15: Contact Metadata Sync
 * As a user, I want changes to contact metadata (name, email, phone, address) 
 * in my Obsidian notes to be reflected in the corresponding VCF files automatically.
 */
describe('Contact Metadata Sync Story', () => {
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
      vcardWatchEnabled: false,
      vcardWatchPollingInterval: 30,
      vcardWriteBackEnabled: false,
      vcardCustomizeIgnoreList: false,
      vcardIgnoreFilenames: [],
      vcardIgnoreUIDs: [],
      logLevel: 'INFO'
    };
  });

  it('should sync name changes to VCF', () => {
    const originalData = {
      UID: 'contact-123',
      FN: 'John Doe',
      N: 'Doe;John;;;',
      EMAIL: 'john@example.com'
    };

    const updatedData = {
      UID: 'contact-123',
      FN: 'John Smith',  // Changed last name
      N: 'Smith;John;;;',
      EMAIL: 'john@example.com'
    };

    const vcfOriginal = VCardGenerator.objectToVcf(originalData);
    const vcfUpdated = VCardGenerator.objectToVcf(updatedData);

    expect(vcfOriginal).toContain('FN:John Doe');
    expect(vcfUpdated).toContain('FN:John Smith');
    expect(vcfOriginal).not.toBe(vcfUpdated);
  });

  it('should sync email changes to VCF', () => {
    const originalData = {
      UID: 'contact-456',
      FN: 'Jane Doe',
      EMAIL: 'jane.old@example.com'
    };

    const updatedData = {
      UID: 'contact-456',
      FN: 'Jane Doe',
      EMAIL: 'jane.new@example.com'  // Changed email
    };

    const vcfOriginal = VCardGenerator.objectToVcf(originalData);
    const vcfUpdated = VCardGenerator.objectToVcf(updatedData);

    expect(vcfOriginal).toContain('jane.old@example.com');
    expect(vcfUpdated).toContain('jane.new@example.com');
    expect(vcfOriginal).not.toBe(vcfUpdated);
  });

  it('should sync phone number changes to VCF', () => {
    const originalData = {
      UID: 'contact-789',
      FN: 'Bob Wilson',
      TEL: '+1-555-123-4567'
    };

    const updatedData = {
      UID: 'contact-789',
      FN: 'Bob Wilson',
      TEL: '+1-555-987-6543'  // Changed phone
    };

    const vcfOriginal = VCardGenerator.objectToVcf(originalData);
    const vcfUpdated = VCardGenerator.objectToVcf(updatedData);

    expect(vcfOriginal).toContain('+1-555-123-4567');
    expect(vcfUpdated).toContain('+1-555-987-6543');
    expect(vcfOriginal).not.toBe(vcfUpdated);
  });

  it('should sync address changes to VCF', () => {
    const originalData = {
      UID: 'contact-111',
      FN: 'Alice Johnson',
      'ADR.STREET': '123 Main St',
      'ADR.LOCALITY': 'Oldtown',
      'ADR.POSTAL': '12345',
      'ADR.COUNTRY': 'USA'
    };

    const updatedData = {
      UID: 'contact-111',
      FN: 'Alice Johnson',
      'ADR.STREET': '456 Oak Ave',  // Changed address
      'ADR.LOCALITY': 'Newtown',
      'ADR.POSTAL': '67890',
      'ADR.COUNTRY': 'USA'
    };

    const vcfOriginal = VCardGenerator.objectToVcf(originalData);
    const vcfUpdated = VCardGenerator.objectToVcf(updatedData);

    expect(vcfOriginal).not.toBe(vcfUpdated);
  });

  it('should handle multiple metadata changes simultaneously', () => {
    const originalData = {
      UID: 'contact-222',
      FN: 'Charlie Brown',
      EMAIL: 'charlie@old.com',
      TEL: '+1-555-111-1111',
      ORG: 'Old Company'
    };

    const updatedData = {
      UID: 'contact-222',
      FN: 'Charles Brown',  // Changed name
      EMAIL: 'charles@new.com',  // Changed email
      TEL: '+1-555-222-2222',  // Changed phone
      ORG: 'New Company'  // Changed organization
    };

    const vcfOriginal = VCardGenerator.objectToVcf(originalData);
    const vcfUpdated = VCardGenerator.objectToVcf(updatedData);

    expect(vcfOriginal).toContain('Charlie Brown');
    expect(vcfUpdated).toContain('Charles Brown');
    expect(vcfOriginal).toContain('charlie@old.com');
    expect(vcfUpdated).toContain('charles@new.com');
    expect(vcfOriginal).not.toBe(vcfUpdated);
  });

  it('should sync organization changes to VCF', () => {
    const originalData = {
      UID: 'contact-333',
      FN: 'David Lee',
      ORG: 'Tech Startup Inc'
    };

    const updatedData = {
      UID: 'contact-333',
      FN: 'David Lee',
      ORG: 'Big Corporation Ltd'  // Changed organization
    };

    const vcfOriginal = VCardGenerator.objectToVcf(originalData);
    const vcfUpdated = VCardGenerator.objectToVcf(updatedData);

    expect(vcfOriginal).toContain('Tech Startup Inc');
    expect(vcfUpdated).toContain('Big Corporation Ltd');
    expect(vcfOriginal).not.toBe(vcfUpdated);
  });

  it('should sync title/role changes to VCF', () => {
    const originalData = {
      UID: 'contact-444',
      FN: 'Emma White',
      TITLE: 'Junior Developer'
    };

    const updatedData = {
      UID: 'contact-444',
      FN: 'Emma White',
      TITLE: 'Senior Developer'  // Promoted
    };

    const vcfOriginal = VCardGenerator.objectToVcf(originalData);
    const vcfUpdated = VCardGenerator.objectToVcf(updatedData);

    expect(vcfOriginal).toContain('Junior Developer');
    expect(vcfUpdated).toContain('Senior Developer');
    expect(vcfOriginal).not.toBe(vcfUpdated);
  });

  it('should sync birthday changes to VCF', () => {
    const originalData = {
      UID: 'contact-555',
      FN: 'Frank Green',
      BDAY: '1990-01-15'
    };

    const updatedData = {
      UID: 'contact-555',
      FN: 'Frank Green',
      BDAY: '1990-01-16'  // Corrected birthday
    };

    const vcfOriginal = VCardGenerator.objectToVcf(originalData);
    const vcfUpdated = VCardGenerator.objectToVcf(updatedData);

    expect(vcfOriginal).toContain('1990-01-15');
    expect(vcfUpdated).toContain('1990-01-16');
    expect(vcfOriginal).not.toBe(vcfUpdated);
  });

  it('should sync URL changes to VCF', () => {
    const originalData = {
      UID: 'contact-666',
      FN: 'Grace Miller',
      URL: 'https://old-website.com'
    };

    const updatedData = {
      UID: 'contact-666',
      FN: 'Grace Miller',
      URL: 'https://new-website.com'  // Changed website
    };

    const vcfOriginal = VCardGenerator.objectToVcf(originalData);
    const vcfUpdated = VCardGenerator.objectToVcf(updatedData);

    expect(vcfOriginal).toContain('https://old-website.com');
    expect(vcfUpdated).toContain('https://new-website.com');
    expect(vcfOriginal).not.toBe(vcfUpdated);
  });

  it('should handle adding new metadata fields', () => {
    const originalData = {
      UID: 'contact-777',
      FN: 'Henry Taylor'
    };

    const updatedData = {
      UID: 'contact-777',
      FN: 'Henry Taylor',
      EMAIL: 'henry@example.com',  // Added email
      TEL: '+1-555-777-7777'  // Added phone
    };

    const vcfOriginal = VCardGenerator.objectToVcf(originalData);
    const vcfUpdated = VCardGenerator.objectToVcf(updatedData);

    expect(vcfOriginal).not.toContain('EMAIL');
    expect(vcfUpdated).toContain('EMAIL:henry@example.com');
    expect(vcfUpdated).toContain('TEL:+1-555-777-7777');
    expect(vcfOriginal).not.toBe(vcfUpdated);
  });

  it('should handle removing metadata fields', () => {
    const originalData = {
      UID: 'contact-888',
      FN: 'Iris Anderson',
      EMAIL: 'iris@example.com',
      TEL: '+1-555-888-8888',
      URL: 'https://iris.com'
    };

    const updatedData = {
      UID: 'contact-888',
      FN: 'Iris Anderson',
      EMAIL: 'iris@example.com'
      // Removed TEL and URL
    };

    const vcfOriginal = VCardGenerator.objectToVcf(originalData);
    const vcfUpdated = VCardGenerator.objectToVcf(updatedData);

    expect(vcfOriginal).toContain('TEL');
    expect(vcfOriginal).toContain('URL');
    expect(vcfUpdated).not.toContain('TEL');
    expect(vcfUpdated).not.toContain('URL:https://iris.com');
  });

  it('should preserve UID when syncing other metadata', () => {
    const originalData = {
      UID: 'permanent-uid-999',
      FN: 'John Doe',
      EMAIL: 'old@example.com'
    };

    const updatedData = {
      UID: 'permanent-uid-999',  // UID should remain the same
      FN: 'John Smith',
      EMAIL: 'new@example.com'
    };

    const vcfOriginal = VCardGenerator.objectToVcf(originalData);
    const vcfUpdated = VCardGenerator.objectToVcf(updatedData);

    expect(vcfOriginal).toContain('UID:permanent-uid-999');
    expect(vcfUpdated).toContain('UID:permanent-uid-999');
  });

  it('should sync gender metadata changes', () => {
    const originalData = {
      UID: 'contact-101',
      FN: 'Jamie Smith',
      GENDER: 'U'  // Unknown/Unspecified
    };

    const updatedData = {
      UID: 'contact-101',
      FN: 'Jamie Smith',
      GENDER: 'F'  // Updated to Female
    };

    const vcfOriginal = VCardGenerator.objectToVcf(originalData);
    const vcfUpdated = VCardGenerator.objectToVcf(updatedData);

    expect(vcfOriginal).toContain('GENDER:U');
    expect(vcfUpdated).toContain('GENDER:F');
    expect(vcfOriginal).not.toBe(vcfUpdated);
  });

  it('should handle frontmatter metadata updates', async () => {
    const mockFile = { basename: 'update-test', path: 'Contacts/update-test.md' } as TFile;
    
    const originalContent = `---
UID: update-test-202
FN: Original Name
EMAIL: original@example.com
---

#Contact`;

    const updatedContent = `---
UID: update-test-202
FN: Updated Name
EMAIL: updated@example.com
TEL: +1-555-202-2020
---

#Contact`;

    mockApp.vault!.read = vi.fn()
      .mockResolvedValueOnce(originalContent)
      .mockResolvedValueOnce(updatedContent);

    mockApp.metadataCache!.getFileCache = vi.fn()
      .mockReturnValueOnce({
        frontmatter: {
          UID: 'update-test-202',
          FN: 'Original Name',
          EMAIL: 'original@example.com'
        }
      })
      .mockReturnValueOnce({
        frontmatter: {
          UID: 'update-test-202',
          FN: 'Updated Name',
          EMAIL: 'updated@example.com',
          TEL: '+1-555-202-2020'
        }
      });

    const contactNote1 = new ContactNote(mockApp as App, mockSettings, mockFile);
    const fm1 = await contactNote1.getFrontmatter();

    const contactNote2 = new ContactNote(mockApp as App, mockSettings, mockFile);
    const fm2 = await contactNote2.getFrontmatter();

    expect(fm1?.FN).toBe('Original Name');
    expect(fm2?.FN).toBe('Updated Name');
    expect(fm2?.TEL).toBe('+1-555-202-2020');
  });

  it('should handle note field changes', () => {
    const originalData = {
      UID: 'contact-303',
      FN: 'Karen Davis',
      NOTE: 'Original note about contact'
    };

    const updatedData = {
      UID: 'contact-303',
      FN: 'Karen Davis',
      NOTE: 'Updated note with new information'
    };

    const vcfOriginal = VCardGenerator.objectToVcf(originalData);
    const vcfUpdated = VCardGenerator.objectToVcf(updatedData);

    expect(vcfOriginal).toContain('Original note');
    expect(vcfUpdated).toContain('Updated note');
    expect(vcfOriginal).not.toBe(vcfUpdated);
  });
});
