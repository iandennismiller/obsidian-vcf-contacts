import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { ContactSectionOperations } from '../../../../src/models/contactNote/contactSectionOperations';
import { ContactData } from '../../../../src/models/contactNote/contactData';
import { ContactsPluginSettings } from '../../../../src/plugin/settings';

/**
 * Test to validate the Contact section formatting fix
 * Issue: Fields should not show numeric index, should be title case, and only show first field
 */
describe('Contact Section Format Fix', () => {
  let mockApp: Partial<App>;
  let mockFile: TFile;
  let contactData: ContactData;
  let ops: ContactSectionOperations;
  let mockSettings: ContactsPluginSettings;

  beforeEach(() => {
    mockFile = { 
      basename: 'test-contact', 
      path: 'Contacts/test-contact.md',
      name: 'test-contact.md'
    } as TFile;

    mockApp = {
      vault: {
        read: vi.fn(),
        modify: vi.fn()
      } as any,
      metadataCache: {
        getFileCache: vi.fn()
      } as any
    };

    mockSettings = {
      contactsFolder: "",
      defaultHashtag: "",
      vcfStorageMethod: 'vcf-folder',
      vcfFilename: "contacts.vcf",
      vcfWatchFolder: "",
      vcfWatchEnabled: false,
      vcfWatchPollingInterval: 30,
      vcfWriteBackEnabled: false,
      vcfCustomizeIgnoreList: false,
      vcfIgnoreFilenames: [],
      vcfIgnoreUIDs: [],
      contactTemplateShowFirstOnly: true,
      contactTemplateFieldOrder: ['EMAIL', 'TEL', 'ADR', 'URL'],
      contactTemplateIcons: {
        EMAIL: '📧',
        TEL: '📞',
        ADR: '🏠',
        URL: '🌐'
      },
      contactTemplateDisplayNames: {
        EMAIL: 'Email',
        TEL: 'Phone',
        ADR: 'Address',
        URL: 'Website'
      },
      contactTemplateEnabledFields: {
        EMAIL: true,
        TEL: true,
        ADR: true,
        URL: true
      }
    };

    contactData = new ContactData(mockApp as App, mockFile);
    ops = new ContactSectionOperations(contactData, mockSettings);
  });

  it('should format labels in title case without numeric index', async () => {
    const content = `---
UID: test-123
FN: Test Contact
TEL[1:WORK]: 555-555-5555
TEL[2:WORK]: 555-555-5556
---

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'test-123',
        FN: 'Test Contact',
        'TEL[1:WORK]': '555-555-5555',
        'TEL[2:WORK]': '555-555-5556'
      }
    });

    const section = await ops.generateContactSection();

    // Should show title case, no index, no colon after label
    expect(section).toContain('Work 555-555-5555');
    expect(section).not.toContain('1:WORK');
    expect(section).not.toContain('WORK:');
    
    // Should only show first field
    expect(section).not.toContain('555-555-5556');
  });

  it('should format regular labels in title case', async () => {
    const content = `---
UID: test-123
FN: Test Contact
EMAIL[HOME]: john@home.com
EMAIL[WORK]: john@work.com
TEL[CELL]: +1-555-1234
---

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'test-123',
        FN: 'Test Contact',
        'EMAIL[HOME]': 'john@home.com',
        'EMAIL[WORK]': 'john@work.com',
        'TEL[CELL]': '+1-555-1234'
      }
    });

    const section = await ops.generateContactSection();

    // Should show title case labels
    expect(section).toContain('Home john@home.com');
    expect(section).toContain('Cell +1-555-1234');
    
    // Should not show uppercase
    expect(section).not.toContain('HOME');
    expect(section).not.toContain('CELL');
    
    // Should not show colon after label
    expect(section).not.toContain('Home:');
    expect(section).not.toContain('Cell:');
    
    // Should only show first email
    expect(section).not.toContain('john@work.com');
  });

  it('should respect contactTemplateShowFirstOnly setting', async () => {
    const content = `---
UID: test-123
FN: Test Contact
EMAIL[HOME]: john@home.com
EMAIL[WORK]: john@work.com
TEL[CELL]: +1-555-1234
TEL[HOME]: +1-555-5678
---

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'test-123',
        FN: 'Test Contact',
        'EMAIL[HOME]': 'john@home.com',
        'EMAIL[WORK]': 'john@work.com',
        'TEL[CELL]': '+1-555-1234',
        'TEL[HOME]': '+1-555-5678'
      }
    });

    // Test with showFirstOnly = false
    mockSettings.contactTemplateShowFirstOnly = false;
    const opsShowAll = new ContactSectionOperations(contactData, mockSettings);
    const sectionShowAll = await opsShowAll.generateContactSection();

    // Should show all fields
    expect(sectionShowAll).toContain('john@home.com');
    expect(sectionShowAll).toContain('john@work.com');
    expect(sectionShowAll).toContain('+1-555-1234');
    expect(sectionShowAll).toContain('+1-555-5678');

    // Test with showFirstOnly = true
    mockSettings.contactTemplateShowFirstOnly = true;
    const opsShowFirst = new ContactSectionOperations(contactData, mockSettings);
    const sectionShowFirst = await opsShowFirst.generateContactSection();

    // Should only show first of each type
    expect(sectionShowFirst).toContain('john@home.com');
    expect(sectionShowFirst).not.toContain('john@work.com');
    expect(sectionShowFirst).toContain('+1-555-1234');
    expect(sectionShowFirst).not.toContain('+1-555-5678');
  });

  it('should use custom icons and display names from settings', async () => {
    const content = `---
UID: test-123
FN: Test Contact
EMAIL[HOME]: john@home.com
TEL[CELL]: +1-555-1234
---

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'test-123',
        FN: 'Test Contact',
        'EMAIL[HOME]': 'john@home.com',
        'TEL[CELL]': '+1-555-1234'
      }
    });

    // Customize settings
    mockSettings.contactTemplateIcons = {
      EMAIL: '✉️',
      TEL: '☎️',
      ADR: '🏠',
      URL: '🌐'
    };
    mockSettings.contactTemplateDisplayNames = {
      EMAIL: 'E-mail',
      TEL: 'Telephone',
      ADR: 'Address',
      URL: 'Website'
    };

    const opsCustom = new ContactSectionOperations(contactData, mockSettings);
    const section = await opsCustom.generateContactSection();

    // Should use custom icons
    expect(section).toContain('✉️ E-mail');
    expect(section).toContain('☎️ Telephone');

    // Should not contain default icons/names
    expect(section).not.toContain('📧 Email');
    expect(section).not.toContain('📞 Phone');
  });

  it('should respect enabled/disabled field types', async () => {
    const content = `---
UID: test-123
FN: Test Contact
EMAIL[HOME]: john@home.com
TEL[CELL]: +1-555-1234
URL[HOME]: https://example.com
---

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'test-123',
        FN: 'Test Contact',
        'EMAIL[HOME]': 'john@home.com',
        'TEL[CELL]': '+1-555-1234',
        'URL[HOME]': 'https://example.com'
      }
    });

    // Disable TEL fields
    mockSettings.contactTemplateEnabledFields = {
      EMAIL: true,
      TEL: false,
      ADR: true,
      URL: true
    };

    const opsDisabled = new ContactSectionOperations(contactData, mockSettings);
    const section = await opsDisabled.generateContactSection();

    // Should show enabled fields
    expect(section).toContain('Email');
    expect(section).toContain('john@home.com');
    expect(section).toContain('Website');
    expect(section).toContain('https://example.com');

    // Should not show disabled TEL field
    expect(section).not.toContain('Phone');
    expect(section).not.toContain('+1-555-1234');
  });
});
