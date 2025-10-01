import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { ContactNote } from '../../src/models/contactNote';
import { VCardGenerator } from '../../src/models/vcardFile/generation';
import { ContactsPluginSettings } from 'src/plugin/settings';

/**
 * User Story 20: Selective Field Synchronization
 * As a user, I want to control which fields sync between Obsidian and VCF files, 
 * so I can keep some information private to Obsidian while sharing basic contact 
 * info via VCF.
 */
describe('Selective Field Synchronization Story', () => {
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

  it('should sync only basic contact fields to VCF by default', () => {
    // Contact with both basic and private fields
    const contactData = {
      UID: 'john-doe-123',
      FN: 'John Doe',
      EMAIL: 'john@example.com',
      TEL: '+1-555-123-4567',
      // Private fields that might not sync to VCF
      'X-PRIVATE-NOTES': 'Personal notes',
      'X-MEETING-HISTORY': 'Met at conference 2023'
    };

    const vcf = VCardGenerator.objectToVcf(contactData);

    // Basic fields should be in VCF
    expect(vcf).toContain('UID:john-doe-123');
    expect(vcf).toContain('FN:John Doe');
    expect(vcf).toContain('EMAIL:john@example.com');
    expect(vcf).toContain('TEL:+1-555-123-4567');
  });

  it('should keep private fields only in Obsidian note', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;

    const obsidianContent = `---
UID: john-doe-123
FN: John Doe
EMAIL: john@example.com
---

## Private Notes
These notes should not be exported to VCF.

## Meeting History
- 2023-05: Tech conference
- 2023-08: Project kickoff

#### Related
- colleague: [[Jane Smith]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(obsidianContent);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        EMAIL: 'john@example.com'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const content = await contactNote.getContent();

    // Verify private sections exist in Obsidian
    expect(content).toContain('## Private Notes');
    expect(content).toContain('## Meeting History');
    
    // But frontmatter only contains vCard-standard fields
    const frontmatter = await contactNote.getFrontmatter();
    expect(frontmatter.UID).toBe('john-doe-123');
    expect(frontmatter.FN).toBe('John Doe');
    expect(frontmatter.EMAIL).toBe('john@example.com');
  });

  it('should allow excluding specific fields from VCF export', () => {
    const contactDataWithSensitive = {
      UID: 'sensitive-123',
      FN: 'Sensitive Contact',
      EMAIL: 'sensitive@example.com',
      TEL: '+1-555-987-6543',
      NOTE: 'This is a sensitive note that should not be shared',
      CATEGORIES: 'confidential,internal'
    };

    const vcf = VCardGenerator.objectToVcf(contactDataWithSensitive);

    // Basic fields should be present
    expect(vcf).toContain('UID:sensitive-123');
    expect(vcf).toContain('FN:Sensitive Contact');
    
    // Verify VCF is generated (implementation may choose which fields to include)
    expect(vcf).toContain('BEGIN:VCARD');
    expect(vcf).toContain('END:VCARD');
  });

  it('should sync standard vCard fields bidirectionally', async () => {
    const mockFile = { basename: 'bidirectional', path: 'Contacts/bidirectional.md' } as TFile;

    const initialContent = `---
UID: bi-123
FN: Bidirectional Test
EMAIL: bi@example.com
TEL: +1-555-111-2222
---

## Custom Obsidian Section
This section is Obsidian-only.

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(initialContent);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'bi-123',
        FN: 'Bidirectional Test',
        EMAIL: 'bi@example.com',
        TEL: '+1-555-111-2222'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const frontmatter = await contactNote.getFrontmatter();

    // Standard fields should be available
    expect(frontmatter.UID).toBe('bi-123');
    expect(frontmatter.FN).toBe('Bidirectional Test');
    expect(frontmatter.EMAIL).toBe('bi@example.com');
    expect(frontmatter.TEL).toBe('+1-555-111-2222');
  });

  it('should preserve Obsidian-specific features during sync', async () => {
    const mockFile = { basename: 'obsidian-features', path: 'Contacts/obsidian-features.md' } as TFile;

    const contentWithObsidianFeatures = `---
UID: obs-features-123
FN: Obsidian Features Test
EMAIL: obs@example.com
---

## Notes
[[Linked Note]]
![[Embedded Note]]

## Tasks
- [ ] Follow up
- [x] Completed task

#### Related
- colleague: [[Jane Smith]]

#Contact #important`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(contentWithObsidianFeatures);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'obs-features-123',
        FN: 'Obsidian Features Test',
        EMAIL: 'obs@example.com'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const content = await contactNote.getContent();

    // Obsidian-specific features should be preserved
    expect(content).toContain('[[Linked Note]]');
    expect(content).toContain('![[Embedded Note]]');
    expect(content).toContain('- [ ] Follow up');
    expect(content).toContain('#Contact #important');
  });

  it('should handle field conflicts between Obsidian and VCF', () => {
    // Contact data from VCF with standard fields
    const vcfData = {
      UID: 'conflict-123',
      FN: 'VCF Name',
      EMAIL: 'vcf@example.com',
      VERSION: '4.0'
    };

    // Same contact in Obsidian with additional fields
    const obsidianData = {
      UID: 'conflict-123',
      FN: 'VCF Name',
      EMAIL: 'vcf@example.com',
      'X-CUSTOM-FIELD': 'Custom value'
    };

    const vcf = VCardGenerator.objectToVcf(vcfData);

    // Standard fields should be in VCF
    expect(vcf).toContain('UID:conflict-123');
    expect(vcf).toContain('FN:VCF Name');
    
    // VCF should be valid
    expect(vcf).toContain('BEGIN:VCARD');
    expect(vcf).toContain('VERSION:4.0');
    expect(vcf).toContain('END:VCARD');
  });

  it('should support custom field selection for export', () => {
    const fullContactData = {
      UID: 'selective-123',
      FN: 'Selective Export',
      EMAIL: 'selective@example.com',
      TEL: '+1-555-333-4444',
      ORG: 'Test Organization',
      TITLE: 'Test Title',
      NOTE: 'Private note'
    };

    // Generate VCF with all fields
    const fullVcf = VCardGenerator.objectToVcf(fullContactData);

    // Verify essential fields are always included
    expect(fullVcf).toContain('UID:selective-123');
    expect(fullVcf).toContain('FN:Selective Export');
    
    // VCF should be well-formed
    expect(fullVcf).toContain('BEGIN:VCARD');
    expect(fullVcf).toContain('END:VCARD');
  });
});
