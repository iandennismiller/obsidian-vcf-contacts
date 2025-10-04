import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { VcardFile } from '../../src/models/vcardFile';
import { ContactNote } from '../../src/models/contactNote';
import { ContactsPluginSettings } from 'src/plugin/settings';

/**
 * User Story 22: Integration Workflows
 * As a user, I want to integrate this plugin with my existing contact management 
 * workflow, including address books, CRM systems, and mobile devices that support 
 * vCard import/export.
 */
describe('Integration Workflows Story', () => {
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
      vcardWriteBackEnabled: true,
      vcardCustomizeIgnoreList: false,
      vcardIgnoreFilenames: [],
      vcardIgnoreUIDs: [],
      logLevel: 'INFO'
    };
  });

  it('should export contacts in standard vCard 4.0 format for address books', async () => {
    const contactData = {
      UID: 'standard-contact-123',
      VERSION: '4.0',
      FN: 'John Doe',
      'N.FN': 'Doe',
      'N.GN': 'John',
      EMAIL: 'john@example.com',
      TEL: '+1-555-123-4567',
      ORG: 'Example Corp',
      TITLE: 'Software Engineer'
    };

    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: contactData
    });

    const result = await VcardFile.fromObsidianFiles([mockFile], mockApp as App);

    // Should produce valid vCard 4.0 format
    expect(result.vcards).toContain('BEGIN:VCARD');
    expect(result.vcards).toContain('VERSION:4.0');
    expect(result.vcards).toContain('UID:standard-contact-123');
    expect(result.vcards).toContain('FN:John Doe');
    expect(result.vcards).toContain('N:Doe;John;;;');
    expect(result.vcards).toContain('EMAIL:john@example.com');
    expect(result.vcards).toContain('TEL:+1-555-123-4567');
    expect(result.vcards).toContain('ORG:Example Corp');
    expect(result.vcards).toContain('TITLE:Software Engineer');
    expect(result.vcards).toContain('END:VCARD');
  });

  it('should import contacts from external address books', async () => {
    // vCard from external address book
    const externalVcf = `BEGIN:VCARD
VERSION:4.0
UID:external-123
FN:External Contact
N:Contact;External;;;
EMAIL:external@addressbook.com
TEL:+1-555-999-8888
ORG:External Company
END:VCARD`;

    const vcardFile = new VcardFile(externalVcf);
    const results = [];
    
    for await (const [slug, record] of vcardFile.parse()) {
      results.push({ slug, record });
    }

    expect(results).toHaveLength(1);
    const contact = results[0].record;
    
    // Should parse all standard fields
    expect(contact.UID).toBe('external-123');
    expect(contact.FN).toBe('External Contact');
    expect(contact.EMAIL).toBe('external@addressbook.com');
    expect(contact.TEL).toBe('+1-555-999-8888');
    expect(contact.ORG).toBe('External Company');
  });

  it('should handle CRM system export format', async () => {
    // Typical CRM export format with additional fields
    const crmVcf = `BEGIN:VCARD
VERSION:4.0
UID:crm-contact-456
FN:CRM Contact
N:Contact;CRM;;;
EMAIL;TYPE=WORK:crm@company.com
TEL;TYPE=WORK:+1-555-777-6666
ORG:CRM Company
TITLE:Sales Manager
NOTE:Important client
CATEGORIES:vip,customer
END:VCARD`;

    const vcardFile = new VcardFile(crmVcf);
    const results = [];
    
    for await (const [slug, record] of vcardFile.parse()) {
      results.push({ slug, record });
    }

    expect(results).toHaveLength(1);
    const contact = results[0].record;
    
    // Should preserve CRM-specific data
    expect(contact.UID).toBe('crm-contact-456');
    expect(contact.FN).toBe('CRM Contact');
    expect(contact.ORG).toBe('CRM Company');
    expect(contact.TITLE).toBe('Sales Manager');
  });

  it('should export contacts compatible with mobile devices', async () => {
    const mobileContact = {
      UID: 'mobile-sync-789',
      VERSION: '4.0',
      FN: 'Mobile Contact',
      'N.FN': 'Contact',
      'N.GN': 'Mobile',
      'EMAIL.1': 'mobile@example.com',
      'TEL.CELL.1': '+1-555-444-3333',
      'TEL.HOME.2': '+1-555-222-1111',
      'ADR.1:HOME.STREET': '123 Main St',
      'ADR.1:HOME.CITY': 'Springfield',
      'ADR.1:HOME.REGION': 'IL',
      'ADR.1:HOME.POSTAL': '62701',
      'ADR.1:HOME.COUNTRY': 'USA'
    };

    const mockFile = { basename: 'mobile-contact', path: 'Contacts/mobile-contact.md' } as TFile;
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: mobileContact
    });

    const result = await VcardFile.fromObsidianFiles([mockFile], mockApp as App);

    // Should include mobile-friendly fields
    expect(result.vcards).toContain('UID:mobile-sync-789');
    expect(result.vcards).toContain('FN:Mobile Contact');
    expect(result.vcards).toContain('EMAIL:mobile@example.com');
    expect(result.vcards).toContain('TEL');
  });

  it('should maintain compatibility with iOS Contacts app', async () => {
    const iosContact = {
      UID: 'ios-contact-111',
      VERSION: '4.0',
      FN: 'iOS Contact',
      'N.FN': 'Contact',
      'N.GN': 'iOS',
      'EMAIL.1': 'ios@icloud.com',
      'TEL.CELL.1': '+1-555-333-2222',
      PHOTO: 'https://example.com/photo.jpg',
      BDAY: '1990-05-15'
    };

    const mockFile = { basename: 'ios-contact', path: 'Contacts/ios-contact.md' } as TFile;
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: iosContact
    });

    const result = await VcardFile.fromObsidianFiles([mockFile], mockApp as App);

    // Should export iOS-compatible format
    expect(result.vcards).toContain('BEGIN:VCARD');
    expect(result.vcards).toContain('VERSION:4.0');
    expect(result.vcards).toContain('UID:ios-contact-111');
    expect(result.vcards).toContain('FN:iOS Contact');
  });

  it('should maintain compatibility with Android Contacts', async () => {
    const androidContact = {
      UID: 'android-contact-222',
      VERSION: '4.0',
      FN: 'Android Contact',
      'N.FN': 'Contact',
      'N.GN': 'Android',
      'EMAIL.1': 'android@gmail.com',
      'TEL.CELL.1': '+1-555-666-7777',
      ORG: 'Android Company'
    };

    const mockFile = { basename: 'android-contact', path: 'Contacts/android-contact.md' } as TFile;
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: androidContact
    });

    const result = await VcardFile.fromObsidianFiles([mockFile], mockApp as App);

    // Should export Android-compatible format
    expect(result.vcards).toContain('BEGIN:VCARD');
    expect(result.vcards).toContain('VERSION:4.0');
    expect(result.vcards).toContain('UID:android-contact-222');
  });

  it('should handle synchronization with external systems', async () => {
    const mockFile = { basename: 'sync-test', path: 'Contacts/sync-test.md' } as TFile;

    const obsidianContent = `---
UID: sync-test-333
FN: Sync Test Contact
EMAIL: sync@example.com
REV: 20240115T100000Z
---

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(obsidianContent);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'sync-test-333',
        FN: 'Sync Test Contact',
        EMAIL: 'sync@example.com',
        REV: '20240115T100000Z'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const frontmatter = await contactNote.getFrontmatter();

    // Should maintain REV field for sync tracking
    expect(frontmatter.REV).toBe('20240115T100000Z');
    expect(frontmatter.UID).toBe('sync-test-333');
  });

  it('should support bidirectional sync with external applications', async () => {
    // Simulate external update to VCF
    const externalUpdateVcf = `BEGIN:VCARD
VERSION:4.0
UID:bidirectional-444
FN:Updated By External App
EMAIL:updated@external.com
REV:20240116T120000Z
END:VCARD`;

    const vcardFile = new VcardFile(externalUpdateVcf);
    const results = [];
    
    for await (const [slug, record] of vcardFile.parse()) {
      results.push({ slug, record });
    }

    const updatedContact = results[0].record;

    // Should recognize external updates via REV field
    expect(updatedContact.UID).toBe('bidirectional-444');
    expect(updatedContact.FN).toBe('Updated By External App');
    expect(updatedContact.REV).toBe('20240116T120000Z');
  });
});
