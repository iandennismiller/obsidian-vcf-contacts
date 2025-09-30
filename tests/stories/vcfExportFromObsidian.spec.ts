import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { VcardFile } from '../../src/models/vcardFile';
import { ContactsPluginSettings } from 'src/definitions/ContactsPluginSettings';

/**
 * User Story 5: VCF Export from Obsidian
 * As a user, I want to export my Obsidian contacts to VCF format so I can share 
 * them with other applications or backup my contact data.
 */
describe('VCF Export from Obsidian Story', () => {
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
      vcfStorageMethod: 'single-vcf',
      vcfFilename: 'exported-contacts.vcf',
      vcfWatchFolder: '/test/vcf',
      vcfWatchEnabled: false,
      vcfWatchPollingInterval: 30,
      vcfWriteBackEnabled: true,
      vcfCustomizeIgnoreList: false,
      vcfIgnoreFilenames: [],
      vcfIgnoreUIDs: [],
      logLevel: 'INFO'
    };
  });

  it('should export single contact to VCF format', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;

    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        N: 'Doe;John;;;',
        EMAIL: 'john@example.com',
        TEL: '+1-555-123-4567',
        ORG: 'Acme Corporation',
        BDAY: '1990-01-15',
        GENDER: 'M'
      }
    });

    const result = await VcardFile.fromObsidianFiles([mockFile], mockApp as App);
    
    expect(result.vcards).toContain('BEGIN:VCARD');
    expect(result.vcards).toContain('VERSION:4.0');
    expect(result.vcards).toContain('UID:john-doe-123');
    expect(result.vcards).toContain('FN:John Doe');
    expect(result.vcards).toContain('N:Doe;John;;;');
    expect(result.vcards).toContain('EMAIL:john@example.com');
    expect(result.vcards).toContain('TEL:+1-555-123-4567');
    expect(result.vcards).toContain('ORG:Acme Corporation');
    expect(result.vcards).toContain('BDAY:1990-01-15');
    expect(result.vcards).toContain('GENDER:M');
    expect(result.vcards).toContain('END:VCARD');
    expect(result.errors).toHaveLength(0);
  });

  it('should export multiple contacts to single VCF file', async () => {
    const mockFiles = [
      { basename: 'john-doe', path: 'Contacts/john-doe.md' },
      { basename: 'jane-smith', path: 'Contacts/jane-smith.md' },
      { basename: 'bob-wilson', path: 'Contacts/bob-wilson.md' }
    ] as TFile[];

    mockApp.metadataCache!.getFileCache = vi.fn()
      .mockReturnValueOnce({
        frontmatter: {
          UID: 'john-doe-123',
          FN: 'John Doe',
          EMAIL: 'john@example.com'
        }
      })
      .mockReturnValueOnce({
        frontmatter: {
          UID: 'jane-smith-456',
          FN: 'Jane Smith',
          EMAIL: 'jane@example.com'
        }
      })
      .mockReturnValueOnce({
        frontmatter: {
          UID: 'bob-wilson-789',
          FN: 'Bob Wilson',
          EMAIL: 'bob@example.com'
        }
      });

    const result = await VcardFile.fromObsidianFiles(mockFiles, mockApp as App);
    
    // Should contain all three contacts
    expect(result.vcards).toContain('UID:john-doe-123');
    expect(result.vcards).toContain('FN:John Doe');
    expect(result.vcards).toContain('UID:jane-smith-456');
    expect(result.vcards).toContain('FN:Jane Smith');
    expect(result.vcards).toContain('UID:bob-wilson-789');
    expect(result.vcards).toContain('FN:Bob Wilson');
    
    // Should have correct number of VCARD blocks
    const beginCount = (result.vcards.match(/BEGIN:VCARD/g) || []).length;
    const endCount = (result.vcards.match(/END:VCARD/g) || []).length;
    expect(beginCount).toBe(3);
    expect(endCount).toBe(3);
    
    expect(result.errors).toHaveLength(0);
  });

  it('should export contacts with relationships correctly', async () => {
    const mockFile = { basename: 'family-head', path: 'Contacts/family-head.md' } as TFile;

    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'family-head-123',
        FN: 'Sarah Johnson',
        EMAIL: 'sarah@example.com',
        'RELATED[spouse]': 'urn:uuid:michael-johnson-456',
        'RELATED[child]': 'name:Emma Johnson',
        'RELATED[1:child]': 'name:Alex Johnson'
      }
    });

    const result = await VcardFile.fromObsidianFiles([mockFile], mockApp as App);
    
    expect(result.vcards).toContain('UID:family-head-123');
    expect(result.vcards).toContain('FN:Sarah Johnson');
    expect(result.vcards).toContain('RELATED;TYPE=spouse:urn:uuid:michael-johnson-456');
    expect(result.vcards).toContain('RELATED;TYPE=child:name:Emma Johnson');
    expect(result.vcards).toContain('RELATED;TYPE=child:name:Alex Johnson');
    expect(result.errors).toHaveLength(0);
  });

  it('should handle structured fields properly during export', async () => {
    const mockFile = { basename: 'structured-contact', path: 'Contacts/structured-contact.md' } as TFile;

    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'structured-123',
        FN: 'Dr. Robert Wilson',
        N: 'Wilson;Robert;Dr.;;',
        'ADR[HOME]': ';;456 Oak Ave;Springfield;IL;62701;USA',
        'EMAIL[HOME]': 'dr.wilson@personal.com',
        'EMAIL[WORK]': 'dr.wilson@hospital.com',
        'TEL[CELL]': '+1-555-123-4567',
        'TEL[WORK]': '+1-555-987-6543',
        ORG: 'Springfield Medical Center;Cardiology Department'
      }
    });

    const result = await VcardFile.fromObsidianFiles([mockFile], mockApp as App);
    
    expect(result.vcards).toContain('FN:Dr. Robert Wilson');
    expect(result.vcards).toContain('N:Wilson;Robert;Dr.;;');
    expect(result.vcards).toContain('ADR;TYPE=HOME:;;456 Oak Ave;Springfield;IL;62701;USA');
    expect(result.vcards).toContain('EMAIL;TYPE=HOME:dr.wilson@personal.com');
    expect(result.vcards).toContain('EMAIL;TYPE=WORK:dr.wilson@hospital.com');
    expect(result.vcards).toContain('TEL;TYPE=CELL:+1-555-123-4567');
    expect(result.vcards).toContain('TEL;TYPE=WORK:+1-555-987-6543');
    expect(result.vcards).toContain('ORG:Springfield Medical Center;Cardiology Department');
    expect(result.errors).toHaveLength(0);
  });

  it('should export contacts with photos correctly', async () => {
    const mockFile = { basename: 'contact-with-photo', path: 'Contacts/contact-with-photo.md' } as TFile;

    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'photo-contact-123',
        FN: 'Alice Cooper',
        EMAIL: 'alice@example.com',
        PHOTO: 'https://example.com/photos/alice.jpg'
      }
    });

    const result = await VcardFile.fromObsidianFiles([mockFile], mockApp as App);
    
    expect(result.vcards).toContain('UID:photo-contact-123');
    expect(result.vcards).toContain('FN:Alice Cooper');
    expect(result.vcards).toContain('PHOTO:https://example.com/photos/alice.jpg');
    expect(result.errors).toHaveLength(0);
  });

  it('should handle export errors gracefully', async () => {
    const mockFile = { basename: 'error-contact', path: 'Contacts/error-contact.md' } as TFile;

    // Mock an error in getting file cache
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue(null);

    const result = await VcardFile.fromObsidianFiles([mockFile], mockApp as App);
    
    // Should still complete but with errors recorded
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].file).toContain('error-contact.md');
  });

  it('should skip contacts with missing required fields', async () => {
    const mockFiles = [
      { basename: 'valid-contact', path: 'Contacts/valid-contact.md' },
      { basename: 'invalid-contact', path: 'Contacts/invalid-contact.md' }
    ] as TFile[];

    mockApp.metadataCache!.getFileCache = vi.fn()
      .mockReturnValueOnce({
        frontmatter: {
          UID: 'valid-123',
          FN: 'Valid Contact',
          EMAIL: 'valid@example.com'
        }
      })
      .mockReturnValueOnce({
        frontmatter: {
          // Missing UID and FN
          EMAIL: 'invalid@example.com'
        }
      });

    const result = await VcardFile.fromObsidianFiles(mockFiles, mockApp as App);
    
    // Should contain only the valid contact
    expect(result.vcards).toContain('UID:valid-123');
    expect(result.vcards).toContain('FN:Valid Contact');
    expect(result.vcards).not.toContain('invalid@example.com');
    
    // Should have one error for the invalid contact
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].file).toContain('invalid-contact.md');
  });

  it('should preserve REV field during export', async () => {
    const mockFile = { basename: 'with-rev', path: 'Contacts/with-rev.md' } as TFile;

    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'rev-contact-123',
        FN: 'Rev Contact',
        EMAIL: 'rev@example.com',
        REV: '20240215T143022Z'
      }
    });

    const result = await VcardFile.fromObsidianFiles([mockFile], mockApp as App);
    
    expect(result.vcards).toContain('UID:rev-contact-123');
    expect(result.vcards).toContain('FN:Rev Contact');
    expect(result.vcards).toContain('REV:20240215T143022Z');
    expect(result.errors).toHaveLength(0);
  });

  it('should handle special characters in contact data during export', async () => {
    const mockFile = { basename: 'special-chars', path: 'Contacts/special-chars.md' } as TFile;

    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'special-123',
        FN: "José García-López",
        N: "García-López;José;;;",
        EMAIL: 'jose@example.com',
        NOTE: 'Special chars: äöü ñ çç @#$%'
      }
    });

    const result = await VcardFile.fromObsidianFiles([mockFile], mockApp as App);
    
    expect(result.vcards).toContain('UID:special-123');
    expect(result.vcards).toContain('FN:José García-López');
    expect(result.vcards).toContain('N:García-López;José;;;');
    expect(result.vcards).toContain('NOTE:Special chars: äöü ñ çç @#$%');
    expect(result.errors).toHaveLength(0);
  });

  it('should create proper VCF file structure for export', async () => {
    const mockFiles = [
      { basename: 'contact1', path: 'Contacts/contact1.md' },
      { basename: 'contact2', path: 'Contacts/contact2.md' }
    ] as TFile[];

    mockApp.metadataCache!.getFileCache = vi.fn()
      .mockReturnValueOnce({
        frontmatter: {
          UID: 'contact1-123',
          FN: 'Contact One',
          EMAIL: 'one@example.com'
        }
      })
      .mockReturnValueOnce({
        frontmatter: {
          UID: 'contact2-456',
          FN: 'Contact Two',
          EMAIL: 'two@example.com'
        }
      });

    const result = await VcardFile.fromObsidianFiles(mockFiles, mockApp as App);
    
    // Verify proper VCF structure
    const lines = result.vcards.split('\n').filter(line => line.trim());
    
    // Should start with first contact
    expect(lines[0]).toBe('BEGIN:VCARD');
    expect(lines[1]).toBe('VERSION:4.0');
    
    // Should have proper separation between contacts
    const beginIndices = lines
      .map((line, index) => line === 'BEGIN:VCARD' ? index : -1)
      .filter(index => index !== -1);
    
    expect(beginIndices).toHaveLength(2);
    
    // Each contact should be properly closed
    const endIndices = lines
      .map((line, index) => line === 'END:VCARD' ? index : -1)
      .filter(index => index !== -1);
    
    expect(endIndices).toHaveLength(2);
    
    expect(result.errors).toHaveLength(0);
  });
});