import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { ContactSectionOperations } from '../../../../src/models/contactNote/contactSectionOperations';
import { ContactData } from '../../../../src/models/contactNote/contactData';
import { ContactsPluginSettings } from '../../../../src/plugin/settings';

describe('ContactSectionOperations', () => {
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
      vcardStorageMethod: 'vcard-folder',
      vcardFilename: "contacts.vcf",
      vcardWatchFolder: "",
      vcardWatchEnabled: false,
      vcardWatchPollingInterval: 30,
      vcardWriteBackEnabled: false,
      vcardCustomizeIgnoreList: false,
      vcardIgnoreFilenames: [],
      vcardIgnoreUIDs: [],
      contactSectionTemplate: `## Contact

{{#EMAIL-}}
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

  describe('parseContactSection', () => {
    it('should parse simple email fields from Contact section', async () => {
      const content = `---
UID: test-123
FN: Test Contact
---

## Contact

📧 Email
- Home: test@home.com
- Work: test@work.com

#Contact`;

      mockApp.vault!.read = vi.fn().mockResolvedValue(content);

      const fields = await ops.parseContactSection();

      expect(fields).toHaveLength(2);
      expect(fields[0]).toEqual({
        fieldType: 'EMAIL',
        fieldLabel: 'Home',
        value: 'test@home.com'
      });
      expect(fields[1]).toEqual({
        fieldType: 'EMAIL',
        fieldLabel: 'Work',
        value: 'test@work.com'
      });
    });

    it('should parse phone fields from Contact section', async () => {
      const content = `---
UID: test-123
FN: Test Contact
---

## Contact

📞 Phone
- Cell: +1-555-1234
- Home: +1-555-5678

#Contact`;

      mockApp.vault!.read = vi.fn().mockResolvedValue(content);

      const fields = await ops.parseContactSection();

      expect(fields).toHaveLength(2);
      expect(fields[0]).toEqual({
        fieldType: 'TEL',
        fieldLabel: 'Cell',
        value: '+1-555-1234'
      });
      expect(fields[1]).toEqual({
        fieldType: 'TEL',
        fieldLabel: 'Home',
        value: '+1-555-5678'
      });
    });

    it('should parse URL fields from Contact section', async () => {
      const content = `---
UID: test-123
FN: Test Contact
---

## Contact

🌐 Website
- Personal: https://example.com
- Work: https://work.example.com

#Contact`;

      mockApp.vault!.read = vi.fn().mockResolvedValue(content);

      const fields = await ops.parseContactSection();

      expect(fields).toHaveLength(2);
      expect(fields[0]).toEqual({
        fieldType: 'URL',
        fieldLabel: 'Personal',
        value: 'https://example.com'
      });
    });

    it('should parse address fields from Contact section', async () => {
      const content = `---
UID: test-123
FN: Test Contact
---

## Contact

🏠 Address
(Home)
123 Main St
Springfield, IL 62701
USA

#Contact`;

      mockApp.vault!.read = vi.fn().mockResolvedValue(content);

      const fields = await ops.parseContactSection();

      expect(fields.length).toBeGreaterThan(0);
      
      const streetField = fields.find(f => f.component === 'STREET' && f.fieldLabel === 'Home');
      expect(streetField).toBeDefined();
      expect(streetField?.value).toBe('123 Main St');
      
      const localityField = fields.find(f => f.component === 'LOCALITY' && f.fieldLabel === 'Home');
      expect(localityField).toBeDefined();
      expect(localityField?.value).toBe('Springfield');
      
      const regionField = fields.find(f => f.component === 'REGION' && f.fieldLabel === 'Home');
      expect(regionField).toBeDefined();
      expect(regionField?.value).toBe('IL');
      
      const postalField = fields.find(f => f.component === 'POSTAL' && f.fieldLabel === 'Home');
      expect(postalField).toBeDefined();
      expect(postalField?.value).toBe('62701');
      
      const countryField = fields.find(f => f.component === 'COUNTRY' && f.fieldLabel === 'Home');
      expect(countryField).toBeDefined();
      expect(countryField?.value).toBe('USA');
    });

    it('should handle fields without type labels (numeric indexing)', async () => {
      const content = `---
UID: test-123
FN: Test Contact
---

## Contact

📧 Email
- test1@example.com
- test2@example.com

#Contact`;

      mockApp.vault!.read = vi.fn().mockResolvedValue(content);

      const fields = await ops.parseContactSection();

      expect(fields).toHaveLength(2);
      expect(fields[0].fieldLabel).toBe('');  // First field has no index (bare)
      expect(fields[1].fieldLabel).toBe('1'); // Second field is indexed as [1]
    });

    it('should return empty array when no Contact section exists', async () => {
      const content = `---
UID: test-123
FN: Test Contact
---

#### Notes
Some notes here.

#Contact`;

      mockApp.vault!.read = vi.fn().mockResolvedValue(content);

      const fields = await ops.parseContactSection();

      expect(fields).toEqual([]);
    });

    it('should handle multiple field types in one Contact section', async () => {
      const content = `---
UID: test-123
FN: Test Contact
---

## Contact

📧 Email
- Home: test@home.com

📞 Phone
- Cell: +1-555-1234

🌐 Website
- Personal: https://example.com

#Contact`;

      mockApp.vault!.read = vi.fn().mockResolvedValue(content);

      const fields = await ops.parseContactSection();

      expect(fields.length).toBeGreaterThanOrEqual(3);
      
      const emailFields = fields.filter(f => f.fieldType === 'EMAIL');
      const telFields = fields.filter(f => f.fieldType === 'TEL');
      const urlFields = fields.filter(f => f.fieldType === 'URL');
      
      expect(emailFields).toHaveLength(1);
      expect(telFields).toHaveLength(1);
      expect(urlFields).toHaveLength(1);
    });
  });

  describe('generateContactSection', () => {
    it('should generate Contact section from email frontmatter', async () => {
      const content = `---
UID: test-123
FN: Test Contact
EMAIL[HOME]: test@home.com
EMAIL[WORK]: test@work.com
---

#Contact`;

      mockApp.vault!.read = vi.fn().mockResolvedValue(content);
      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
        frontmatter: {
          UID: 'test-123',
          FN: 'Test Contact',
          'EMAIL[HOME]': 'test@home.com',
          'EMAIL[WORK]': 'test@work.com'
        }
      });

      const section = await ops.generateContactSection();

      expect(section).toContain('## Contact');
      expect(section).toContain('📧 Email');
      expect(section).toContain('Home test@home.com');
      // Only first field should be shown by default
      expect(section).not.toContain('Work');
    });

    it('should generate Contact section from phone frontmatter', async () => {
      const content = `---
UID: test-123
FN: Test Contact
TEL[CELL]: +1-555-1234
TEL[HOME]: +1-555-5678
---

#Contact`;

      mockApp.vault!.read = vi.fn().mockResolvedValue(content);
      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
        frontmatter: {
          UID: 'test-123',
          FN: 'Test Contact',
          'TEL[CELL]': '+1-555-1234',
          'TEL[HOME]': '+1-555-5678'
        }
      });

      const section = await ops.generateContactSection();

      expect(section).toContain('## Contact');
      expect(section).toContain('📞 Phone');
      expect(section).toContain('Cell +1-555-1234');
      // Only first field should be shown by default
      expect(section).not.toContain('Home');
    });

    it('should generate Contact section with address fields', async () => {
      const content = `---
UID: test-123
FN: Test Contact
ADR[HOME].STREET: 123 Main St
ADR[HOME].LOCALITY: Springfield
ADR[HOME].REGION: IL
ADR[HOME].POSTAL: 62701
ADR[HOME].COUNTRY: USA
---

#Contact`;

      mockApp.vault!.read = vi.fn().mockResolvedValue(content);
      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
        frontmatter: {
          UID: 'test-123',
          FN: 'Test Contact',
          'ADR[HOME].STREET': '123 Main St',
          'ADR[HOME].LOCALITY': 'Springfield',
          'ADR[HOME].REGION': 'IL',
          'ADR[HOME].POSTAL': '62701',
          'ADR[HOME].COUNTRY': 'USA'
        }
      });

      const section = await ops.generateContactSection();

      expect(section).toContain('## Contact');
      expect(section).toContain('🏠 Address');
      expect(section).toContain('123 Main St');
      expect(section).toContain('Springfield');
      expect(section).toContain('USA');
    });

    it('should return empty string when no contact fields in frontmatter', async () => {
      const content = `---
UID: test-123
FN: Test Contact
---

#Contact`;

      mockApp.vault!.read = vi.fn().mockResolvedValue(content);
      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
        frontmatter: {
          UID: 'test-123',
          FN: 'Test Contact'
        }
      });

      const section = await ops.generateContactSection();

      expect(section).toBe('');
    });

    it('should organize fields in correct order (EMAIL, TEL, ADR, URL)', async () => {
      const content = `---
UID: test-123
FN: Test Contact
URL[HOME]: https://example.com
ADR[HOME].STREET: 123 Main St
TEL[CELL]: +1-555-1234
EMAIL[HOME]: test@example.com
---

#Contact`;

      mockApp.vault!.read = vi.fn().mockResolvedValue(content);
      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
        frontmatter: {
          UID: 'test-123',
          FN: 'Test Contact',
          'EMAIL[HOME]': 'test@example.com',
          'TEL[CELL]': '+1-555-1234',
          'ADR[HOME].STREET': '123 Main St',
          'URL[HOME]': 'https://example.com'
        }
      });

      const section = await ops.generateContactSection();

      // EMAIL should come before TEL
      const emailIndex = section.indexOf('📧 Email');
      const telIndex = section.indexOf('📞 Phone');
      const adrIndex = section.indexOf('🏠 Address');
      const urlIndex = section.indexOf('🌐 Website');

      expect(emailIndex).toBeLessThan(telIndex);
      expect(telIndex).toBeLessThan(adrIndex);
      expect(adrIndex).toBeLessThan(urlIndex);
    });
  });

  describe('validateContactFields', () => {
    it('should validate email format', () => {
      const validEmail = { fieldType: 'EMAIL', fieldLabel: 'HOME', value: 'test@example.com' };
      const invalidEmail = { fieldType: 'EMAIL', fieldLabel: 'HOME', value: 'invalid-email' };

      const warnings1 = ops.validateContactFields([validEmail]);
      expect(warnings1).toHaveLength(0);

      const warnings2 = ops.validateContactFields([invalidEmail]);
      expect(warnings2.length).toBeGreaterThan(0);
      expect(warnings2[0]).toContain('email');
    });

    it('should validate phone format', () => {
      const validPhone = { fieldType: 'TEL', fieldLabel: 'CELL', value: '+1-555-1234' };
      const invalidPhone = { fieldType: 'TEL', fieldLabel: 'CELL', value: 'no-digits-here' };

      const warnings1 = ops.validateContactFields([validPhone]);
      expect(warnings1).toHaveLength(0);

      const warnings2 = ops.validateContactFields([invalidPhone]);
      expect(warnings2.length).toBeGreaterThan(0);
      expect(warnings2[0]).toContain('phone');
    });

    it('should validate URL format', () => {
      const validURL = { fieldType: 'URL', fieldLabel: 'HOME', value: 'https://example.com' };
      const invalidURL = { fieldType: 'URL', fieldLabel: 'HOME', value: 'not-a-url' };

      const warnings1 = ops.validateContactFields([validURL]);
      expect(warnings1).toHaveLength(0);

      const warnings2 = ops.validateContactFields([invalidURL]);
      expect(warnings2.length).toBeGreaterThan(0);
      expect(warnings2[0]).toContain('URL');
    });

    it('should allow multiple validation warnings', () => {
      const fields = [
        { fieldType: 'EMAIL', fieldLabel: 'HOME', value: 'invalid-email' },
        { fieldType: 'TEL', fieldLabel: 'CELL', value: 'no-digits' },
        { fieldType: 'URL', fieldLabel: 'HOME', value: 'not-a-url' }
      ];

      const warnings = ops.validateContactFields(fields);
      expect(warnings.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('updateContactSectionInContent', () => {
    it('should add Contact section when it does not exist', async () => {
      const initialContent = `---
UID: test-123
FN: Test Contact
---

#### Notes
Some notes here.

#Contact`;

      const newSection = `## Contact

📧 Email
- Home: test@example.com`;

      mockApp.vault!.read = vi.fn().mockResolvedValue(initialContent);
      mockApp.vault!.modify = vi.fn().mockResolvedValue(undefined);

      await ops.updateContactSectionInContent(newSection);

      expect(mockApp.vault!.modify).toHaveBeenCalled();
      const updatedContent = (mockApp.vault!.modify as any).mock.calls[0][1];
      expect(updatedContent).toContain('## Contact');
      expect(updatedContent).toContain('test@example.com');
    });

    it('should replace existing Contact section', async () => {
      const initialContent = `---
UID: test-123
FN: Test Contact
---

## Contact

📧 Email
- Old: old@example.com

#Contact`;

      const newSection = `## Contact

📧 Email
- New: new@example.com`;

      mockApp.vault!.read = vi.fn().mockResolvedValue(initialContent);
      mockApp.vault!.modify = vi.fn().mockResolvedValue(undefined);

      await ops.updateContactSectionInContent(newSection);

      expect(mockApp.vault!.modify).toHaveBeenCalled();
      const updatedContent = (mockApp.vault!.modify as any).mock.calls[0][1];
      expect(updatedContent).toContain('new@example.com');
      expect(updatedContent).not.toContain('old@example.com');
    });

    it('should not create duplicate Contact sections on multiple runs', async () => {
      const initialContent = `---
UID: test-123
FN: Test Contact
---
#Contact`;

      const newSection = `## Contact

📧 Email
- Home: test@example.com`;

      // First call - should add Contact section
      mockApp.vault!.read = vi.fn().mockResolvedValue(initialContent);
      let capturedContent = '';
      mockApp.vault!.modify = vi.fn().mockImplementation((file, content) => {
        capturedContent = content;
        return Promise.resolve();
      });

      await ops.updateContactSectionInContent(newSection);

      expect(mockApp.vault!.modify).toHaveBeenCalled();
      expect(capturedContent).toContain('## Contact');
      
      // Count occurrences of "## Contact"
      const firstRunMatches = (capturedContent.match(/## Contact/g) || []).length;
      expect(firstRunMatches).toBe(1);

      // Second call - should replace, not duplicate
      mockApp.vault!.read = vi.fn().mockResolvedValue(capturedContent);
      mockApp.vault!.modify = vi.fn().mockImplementation((file, content) => {
        capturedContent = content;
        return Promise.resolve();
      });

      await ops.updateContactSectionInContent(newSection);

      // Should still have only one "## Contact"
      const secondRunMatches = (capturedContent.match(/## Contact/g) || []).length;
      expect(secondRunMatches).toBe(1);
    });
  });
});
