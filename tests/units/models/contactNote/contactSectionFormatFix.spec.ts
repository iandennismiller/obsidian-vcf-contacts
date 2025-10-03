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
      contactSectionTemplate: `{{#EMAIL-}}
📧 Email
{{#FIRST}}{{LABEL}} {{VALUE}}{{/FIRST}}

{{/EMAIL-}}
{{#TEL-}}
📞 Phone
{{#FIRST}}{{LABEL}} {{VALUE}}{{/FIRST}}

{{/TEL-}}
{{#ADR-}}
🏠 Address
{{#FIRST}}({{LABEL}})
{{STREET}}
{{LOCALITY}}, {{REGION}} {{POSTAL}}
{{COUNTRY}}

{{/FIRST}}
{{/ADR-}}
{{#URL-}}
🌐 Website
{{#FIRST}}{{LABEL}} {{VALUE}}{{/FIRST}}

{{/URL-}}`
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

  it('should respect template with {{#FIRST}} directive', async () => {
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

    // Test with FIRST directive (default)
    const opsShowFirst = new ContactSectionOperations(contactData, mockSettings);
    const sectionShowFirst = await opsShowFirst.generateContactSection();

    // Should only show first of each type
    expect(sectionShowFirst).toContain('john@home.com');
    expect(sectionShowFirst).not.toContain('john@work.com');
    expect(sectionShowFirst).toContain('+1-555-1234');
    expect(sectionShowFirst).not.toContain('+1-555-5678');
  });

  it('should respect template with {{#ALL}} directive', async () => {
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

    // Test with ALL directive
    mockSettings.contactSectionTemplate = `{{#EMAIL}}
📧 Email
{{#ALL}}{{LABEL}} {{VALUE}}
{{/ALL}}
{{/EMAIL}}
{{#TEL}}
📞 Phone
{{#ALL}}{{LABEL}} {{VALUE}}
{{/ALL}}
{{/TEL}}`;

    const opsShowAll = new ContactSectionOperations(contactData, mockSettings);
    const sectionShowAll = await opsShowAll.generateContactSection();

    // Should show all fields
    expect(sectionShowAll).toContain('john@home.com');
    expect(sectionShowAll).toContain('john@work.com');
    expect(sectionShowAll).toContain('+1-555-1234');
    expect(sectionShowAll).toContain('+1-555-5678');
  });

  it('should use custom template format', async () => {
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

    // Customize template with different icons and format
    mockSettings.contactSectionTemplate = `{{#EMAIL}}
✉️ E-mail
{{#FIRST}}{{LABEL}}: {{VALUE}}{{/FIRST}}

{{/EMAIL}}
{{#TEL}}
☎️ Telephone
{{#FIRST}}{{LABEL}}: {{VALUE}}{{/FIRST}}

{{/TEL}}`;

    const opsCustom = new ContactSectionOperations(contactData, mockSettings);
    const section = await opsCustom.generateContactSection();

    // Should use custom icons and format
    expect(section).toContain('✉️ E-mail');
    expect(section).toContain('☎️ Telephone');
    expect(section).toContain('Home: john@home.com');
    expect(section).toContain('Cell: +1-555-1234');

    // Should not contain default format
    expect(section).not.toContain('📧 Email');
    expect(section).not.toContain('📞 Phone');
  });

  it('should hide field types not in template', async () => {
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

    // Template without TEL section
    mockSettings.contactSectionTemplate = `{{#EMAIL}}
📧 Email
{{#FIRST}}{{LABEL}} {{VALUE}}{{/FIRST}}

{{/EMAIL}}
{{#URL}}
🌐 Website
{{#FIRST}}{{LABEL}} {{VALUE}}{{/FIRST}}

{{/URL}}`;

    const opsCustom = new ContactSectionOperations(contactData, mockSettings);
    const section = await opsCustom.generateContactSection();

    // Should show EMAIL and URL
    expect(section).toContain('Email');
    expect(section).toContain('john@home.com');
    expect(section).toContain('Website');
    expect(section).toContain('https://example.com');

    // Should not show TEL
    expect(section).not.toContain('Phone');
    expect(section).not.toContain('+1-555-1234');
  });

  it('should suppress newlines with hyphen suffix unconditionally', async () => {
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

    // Template with hyphen for unconditional newline suppression
    mockSettings.contactSectionTemplate = `{{#EMAIL-}}
📧 Email
{{#FIRST}}{{LABEL}} {{VALUE}}{{/FIRST}}

{{/EMAIL-}}
{{#TEL-}}
📞 Phone
{{#FIRST}}{{LABEL}} {{VALUE}}{{/FIRST}}

{{/TEL-}}`;

    const opsWithHyphen = new ContactSectionOperations(contactData, mockSettings);
    const sectionWithHyphen = await opsWithHyphen.generateContactSection();

    // Should have both sections since both fields exist
    expect(sectionWithHyphen).toContain('📧 Email');
    expect(sectionWithHyphen).toContain('Home john@home.com');
    expect(sectionWithHyphen).toContain('📞 Phone');
    expect(sectionWithHyphen).toContain('Cell +1-555-1234');
    
    // The newlines after closing tags with hyphens should be suppressed
    // So there should not be extra blank lines between sections beyond what's in the template content
    const lines = sectionWithHyphen.split('\n');
    // Check that we don't have excessive blank lines
    expect(lines.filter(line => line.trim() === '').length).toBeLessThan(5);
  });

  it('should preserve newlines without hyphen suffix', async () => {
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

    // Template WITHOUT hyphen - should preserve newlines
    mockSettings.contactSectionTemplate = `{{#EMAIL}}
📧 Email
{{#FIRST}}{{LABEL}} {{VALUE}}{{/FIRST}}

{{/EMAIL}}
{{#TEL}}
📞 Phone
{{#FIRST}}{{LABEL}} {{VALUE}}{{/FIRST}}

{{/TEL}}`;

    const opsWithoutHyphen = new ContactSectionOperations(contactData, mockSettings);
    const sectionWithoutHyphen = await opsWithoutHyphen.generateContactSection();

    // Should still contain both sections
    expect(sectionWithoutHyphen).toContain('📧 Email');
    expect(sectionWithoutHyphen).toContain('Home john@home.com');
    expect(sectionWithoutHyphen).toContain('📞 Phone');
    expect(sectionWithoutHyphen).toContain('Cell +1-555-1234');
    
    // Without hyphen, newlines are preserved, so we expect them to be present
  });
});
