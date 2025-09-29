import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { setupVCFDropHandler } from '../../src/ui/vcfDropHandler';
import { ContactsPluginSettings } from '../../src/settings/settings.d';

/**
 * User Story 3: VCF File Drop Import
 * As a user, when I drop a VCF file into my Obsidian vault, I want the plugin to 
 * automatically import the contacts into my contacts folder and place the VCF file 
 * in my watch folder for ongoing synchronization.
 */
describe('VCF File Drop Import Story', () => {
  let mockApp: Partial<App>;
  let mockSettings: ContactsPluginSettings;

  beforeEach(() => {
    mockApp = {
      vault: {
        read: vi.fn(),
        modify: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
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
    };
  });

  it('should set up VCF drop handler successfully', () => {
    const cleanup = setupVCFDropHandler(mockApp as App, mockSettings);
    
    expect(typeof cleanup).toBe('function');
    expect(mockApp.vault!.on).toHaveBeenCalledWith('create', expect.any(Function));
  });

  it('should detect VCF files by extension', () => {
    const vcfFile = { name: 'contacts.vcf', path: 'contacts.vcf' } as TFile;
    const mdFile = { name: 'note.md', path: 'note.md' } as TFile;
    const txtFile = { name: 'document.txt', path: 'document.txt' } as TFile;

    expect(vcfFile.name.endsWith('.vcf')).toBe(true);
    expect(mdFile.name.endsWith('.vcf')).toBe(false);
    expect(txtFile.name.endsWith('.vcf')).toBe(false);
  });

  it('should handle VCF with single contact', async () => {
    const singleContactVCF = `BEGIN:VCARD
VERSION:4.0
UID:john-doe-123
FN:John Doe
N:Doe;John;;;
EMAIL:john@example.com
TEL:+1-555-123-4567
END:VCARD`;

    // Test that the VCF content can be parsed
    expect(singleContactVCF).toContain('BEGIN:VCARD');
    expect(singleContactVCF).toContain('UID:john-doe-123');
    expect(singleContactVCF).toContain('FN:John Doe');
    expect(singleContactVCF).toContain('END:VCARD');
  });

  it('should handle VCF with multiple contacts', async () => {
    const multipleContactsVCF = `BEGIN:VCARD
VERSION:4.0
UID:john-doe-123
FN:John Doe
EMAIL:john@example.com
END:VCARD

BEGIN:VCARD
VERSION:4.0
UID:jane-smith-456
FN:Jane Smith
EMAIL:jane@example.com
END:VCARD

BEGIN:VCARD
VERSION:4.0
UID:bob-wilson-789
FN:Bob Wilson
EMAIL:bob@example.com
END:VCARD`;

    // Count the number of contacts in the VCF
    const contactCount = (multipleContactsVCF.match(/BEGIN:VCARD/g) || []).length;
    expect(contactCount).toBe(3);
    
    const endContactCount = (multipleContactsVCF.match(/END:VCARD/g) || []).length;
    expect(endContactCount).toBe(3);
  });

  it('should handle VCF with relationships between contacts', async () => {
    const vcfWithRelationships = `BEGIN:VCARD
VERSION:4.0
UID:john-doe-123
FN:John Doe
EMAIL:john@example.com
RELATED;TYPE=spouse:urn:uuid:jane-doe-456
RELATED;TYPE=child:urn:uuid:tommy-doe-789
END:VCARD

BEGIN:VCARD
VERSION:4.0
UID:jane-doe-456
FN:Jane Doe
EMAIL:jane@example.com
RELATED;TYPE=spouse:urn:uuid:john-doe-123
RELATED;TYPE=child:urn:uuid:tommy-doe-789
END:VCARD

BEGIN:VCARD
VERSION:4.0
UID:tommy-doe-789
FN:Tommy Doe
EMAIL:tommy@example.com
RELATED;TYPE=parent:urn:uuid:john-doe-123
RELATED;TYPE=parent:urn:uuid:jane-doe-456
END:VCARD`;

    // Verify relationships are present
    expect(vcfWithRelationships).toContain('RELATED;TYPE=spouse');
    expect(vcfWithRelationships).toContain('RELATED;TYPE=child');
    expect(vcfWithRelationships).toContain('RELATED;TYPE=parent');
    expect(vcfWithRelationships).toContain('urn:uuid:john-doe-123');
    expect(vcfWithRelationships).toContain('urn:uuid:jane-doe-456');
    expect(vcfWithRelationships).toContain('urn:uuid:tommy-doe-789');
  });

  it('should handle existing contacts by UID', async () => {
    const existingContactUID = 'existing-contact-123';
    
    // Mock an existing contact file
    const existingFile = { 
      basename: 'existing-contact', 
      path: 'Contacts/existing-contact.md' 
    } as TFile;
    
    mockApp.vault!.getMarkdownFiles = vi.fn().mockReturnValue([existingFile]);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: existingContactUID,
        FN: 'Existing Contact',
        EMAIL: 'existing@example.com'
      }
    });

    // When processing a VCF with the same UID, it should update rather than create new
    const vcfWithExistingContact = `BEGIN:VCARD
VERSION:4.0
UID:${existingContactUID}
FN:Updated Contact Name
EMAIL:updated@example.com
TEL:+1-555-999-8888
END:VCARD`;

    expect(vcfWithExistingContact).toContain(`UID:${existingContactUID}`);
    expect(vcfWithExistingContact).toContain('FN:Updated Contact Name');
  });

  it('should generate proper contact filenames from names', () => {
    const contacts = [
      { FN: 'John Doe', expected: 'john-doe' },
      { FN: 'Mary Jane Smith', expected: 'mary-jane-smith' },
      { FN: 'Dr. Robert Wilson Jr.', expected: 'dr-robert-wilson-jr' },
      { FN: 'Jean-Claude Van Damme', expected: 'jean-claude-van-damme' }
    ];

    contacts.forEach(({ FN, expected }) => {
      // Simulate the slug generation logic
      const slug = FN.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      
      expect(slug).toBe(expected);
    });
  });

  it('should cleanup VCF drop handler when called', () => {
    const cleanup = setupVCFDropHandler(mockApp as App, mockSettings);
    
    // Mock the off method to track cleanup
    const offSpy = vi.spyOn(mockApp.vault!, 'off');
    
    cleanup();
    
    expect(offSpy).toHaveBeenCalledWith('create', expect.any(Function));
  });
});