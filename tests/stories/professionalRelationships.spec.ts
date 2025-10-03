import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { ContactNote } from '../../src/models/contactNote';
import { ContactsPluginSettings } from 'src/plugin/settings';

/**
 * User Story 9: Professional Relationships
 * As a user, I want to track professional relationships like "colleague", "boss", 
 * "employee", "client", "vendor" and have them properly categorized and synced.
 */
describe('Professional Relationships Story', () => {
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
      vcardWriteBackEnabled: false,
      vcardCustomizeIgnoreList: false,
      vcardIgnoreFilenames: [],
      vcardIgnoreUIDs: [],
      logLevel: 'INFO'
    };
  });

  it('should handle colleague relationships', async () => {
    const mockFile = { basename: 'worker-one', path: 'Contacts/worker-one.md' } as TFile;
    const content = `---
UID: worker-one-123
FN: Worker One
RELATED[colleague]: name:Colleague Name
RELATED[1:colleague]: name:Another Colleague
---

#### Related
- colleague [[Colleague Name]]
- colleague [[Another Colleague]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'worker-one-123',
        FN: 'Worker One',
        'RELATED[colleague]': 'name:Colleague Name',
        'RELATED[1:colleague]': 'name:Another Colleague'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const relationships = await contactNote.parseRelatedSection();

    expect(relationships).toHaveLength(2);
    expect(relationships.filter(r => r.type === 'colleague')).toHaveLength(2);
  });

  it('should handle boss relationships', async () => {
    const mockFile = { basename: 'employee-contact', path: 'Contacts/employee-contact.md' } as TFile;
    const content = `---
UID: employee-contact-456
FN: Employee Contact
RELATED[boss]: name:Manager Name
---

#### Related
- boss [[Manager Name]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'employee-contact-456',
        FN: 'Employee Contact',
        'RELATED[boss]': 'name:Manager Name'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const relationships = await contactNote.parseRelatedSection();

    expect(relationships).toHaveLength(1);
    expect(relationships[0].type).toBe('boss');
    expect(relationships[0].contactName).toBe('Manager Name');
  });

  it('should handle employee relationships', async () => {
    const mockFile = { basename: 'manager-contact', path: 'Contacts/manager-contact.md' } as TFile;
    const content = `---
UID: manager-contact-789
FN: Manager Contact
RELATED[employee]: name:Employee One
RELATED[1:employee]: name:Employee Two
RELATED[2:employee]: name:Employee Three
---

#### Related
- employee [[Employee One]]
- employee [[Employee Two]]
- employee [[Employee Three]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'manager-contact-789',
        FN: 'Manager Contact',
        'RELATED[employee]': 'name:Employee One',
        'RELATED[1:employee]': 'name:Employee Two',
        'RELATED[2:employee]': 'name:Employee Three'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const relationships = await contactNote.parseRelatedSection();

    expect(relationships).toHaveLength(3);
    expect(relationships.filter(r => r.type === 'employee')).toHaveLength(3);
  });

  it('should handle client relationships', async () => {
    const mockFile = { basename: 'business-contact', path: 'Contacts/business-contact.md' } as TFile;
    const content = `---
UID: business-contact-111
FN: Business Contact
RELATED[client]: name:Client Company
RELATED[1:client]: name:Another Client
---

#### Related
- client [[Client Company]]
- client [[Another Client]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'business-contact-111',
        FN: 'Business Contact',
        'RELATED[client]': 'name:Client Company',
        'RELATED[1:client]': 'name:Another Client'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const relationships = await contactNote.parseRelatedSection();

    expect(relationships).toHaveLength(2);
    expect(relationships.filter(r => r.type === 'client')).toHaveLength(2);
  });

  it('should handle vendor relationships', async () => {
    const mockFile = { basename: 'buyer-contact', path: 'Contacts/buyer-contact.md' } as TFile;
    const content = `---
UID: buyer-contact-222
FN: Buyer Contact
RELATED[vendor]: name:Supplier One
RELATED[1:vendor]: name:Supplier Two
---

#### Related
- vendor [[Supplier One]]
- vendor [[Supplier Two]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'buyer-contact-222',
        FN: 'Buyer Contact',
        'RELATED[vendor]': 'name:Supplier One',
        'RELATED[1:vendor]': 'name:Supplier Two'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const relationships = await contactNote.parseRelatedSection();

    expect(relationships).toHaveLength(2);
    expect(relationships.filter(r => r.type === 'vendor')).toHaveLength(2);
  });

  it('should handle multiple professional relationship types', async () => {
    const mockFile = { basename: 'business-person', path: 'Contacts/business-person.md' } as TFile;
    const content = `---
UID: business-person-333
FN: Business Person
RELATED[colleague]: name:Coworker Name
RELATED[boss]: name:Manager Name
RELATED[client]: name:Client Name
RELATED[vendor]: name:Supplier Name
---

#### Related
- colleague [[Coworker Name]]
- boss [[Manager Name]]
- client [[Client Name]]
- vendor [[Supplier Name]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'business-person-333',
        FN: 'Business Person',
        'RELATED[colleague]': 'name:Coworker Name',
        'RELATED[boss]': 'name:Manager Name',
        'RELATED[client]': 'name:Client Name',
        'RELATED[vendor]': 'name:Supplier Name'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const relationships = await contactNote.parseRelatedSection();

    expect(relationships).toHaveLength(4);
    expect(relationships.map(r => r.type)).toContain('colleague');
    expect(relationships.map(r => r.type)).toContain('boss');
    expect(relationships.map(r => r.type)).toContain('client');
    expect(relationships.map(r => r.type)).toContain('vendor');
  });

  it('should handle mentor and mentee relationships', async () => {
    const mockFile = { basename: 'mentorship-contact', path: 'Contacts/mentorship-contact.md' } as TFile;
    const content = `---
UID: mentorship-contact-444
FN: Mentorship Contact
RELATED[mentor]: name:Experienced Person
RELATED[mentee]: name:Junior Person
---

#### Related
- mentor [[Experienced Person]]
- mentee [[Junior Person]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'mentorship-contact-444',
        FN: 'Mentorship Contact',
        'RELATED[mentor]': 'name:Experienced Person',
        'RELATED[mentee]': 'name:Junior Person'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const relationships = await contactNote.parseRelatedSection();

    expect(relationships).toHaveLength(2);
    expect(relationships.some(r => r.type === 'mentor')).toBe(true);
    expect(relationships.some(r => r.type === 'mentee')).toBe(true);
  });

  it('should sync professional relationships from Related list to frontmatter', async () => {
    const mockFile = { basename: 'sync-professional', path: 'Contacts/sync-professional.md' } as TFile;
    const content = `---
UID: sync-professional-555
FN: Sync Professional Contact
---

#### Related
- colleague [[New Colleague]]
- client [[New Client]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'sync-professional-555',
        FN: 'Sync Professional Contact'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const result = await contactNote.syncRelatedListToFrontmatter();

    expect(result.success).toBe(true);
  });

  it('should handle business partner relationships', async () => {
    const mockFile = { basename: 'partner-contact', path: 'Contacts/partner-contact.md' } as TFile;
    const content = `---
UID: partner-contact-666
FN: Partner Contact
RELATED[business-partner]: name:Partner Name
---

#### Related
- business-partner: [[Partner Name]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'partner-contact-666',
        FN: 'Partner Contact',
        'RELATED[business-partner]': 'name:Partner Name'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const relationships = await contactNote.parseRelatedSection();

    expect(relationships).toHaveLength(1);
    expect(relationships[0].type).toBe('business-partner');
  });

  it('should preserve all professional relationship types', async () => {
    const mockFile = { basename: 'type-test', path: 'Contacts/type-test.md' } as TFile;
    
    const professionalTypes = [
      'colleague',
      'boss',
      'employee',
      'client',
      'vendor',
      'mentor',
      'mentee',
      'business-partner',
      'contractor',
      'consultant'
    ];

    for (const type of professionalTypes) {
      const content = `---
UID: test-uid
FN: Test Contact
---

#### Related
- ${type}: [[Test Person]]

#Contact`;

      mockApp.vault!.read = vi.fn().mockResolvedValue(content);
      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
        frontmatter: {
          UID: 'test-uid',
          FN: 'Test Contact'
        }
      });

      const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
      const relationships = await contactNote.parseRelatedSection();

      expect(relationships).toHaveLength(1);
      expect(relationships[0].type).toBe(type);
    }
  });
});
