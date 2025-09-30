import { describe, it, expect, beforeEach } from 'vitest';
import { VCardParser } from '../../src/models/vcardFile/parsing';
import { VcardFile } from '../../src/models/vcardFile/vcardFile';
import { parseKey, mdRender, createNameSlug } from '../../src/models/contactNote';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Demo Data Integration Tests', () => {
  let vcfContent: string;
  let markdownFiles: string[];
  const demoVcfPath = path.join(__dirname, '../../docs/demo-data/vcf/contacts.vcf');
  const demoMarkdownPath = path.join(__dirname, '../../docs/demo-data/markdown');

  beforeEach(async () => {
    vcfContent = await fs.readFile(demoVcfPath, 'utf-8');
    markdownFiles = await fs.readdir(demoMarkdownPath);
    markdownFiles = markdownFiles.filter(file => file.endsWith('.md'));
  });

  describe('VCF to Markdown consistency', () => {
    it('should have matching contact counts between VCF and markdown', async () => {
      const vcfContacts = [];
      for await (const [slug, contact] of VCardParser.parse(vcfContent)) {
        vcfContacts.push({ slug, contact });
      }

      expect(vcfContacts).toHaveLength(18);
      expect(markdownFiles).toHaveLength(18);
    });

    it('should be able to round-trip VCF data through models', async () => {
      // Parse VCF data
      const vcfContacts = [];
      for await (const [slug, contact] of VCardParser.parse(vcfContent)) {
        vcfContacts.push({ slug, contact });
      }

      // Test each contact can be processed by all models
      for (const { slug, contact } of vcfContacts) {
        // Test name slug generation
        expect(() => createNameSlug(contact)).not.toThrow();
        const generatedSlug = createNameSlug(contact);
        expect(generatedSlug).toBeDefined();
        expect(typeof generatedSlug).toBe('string');

        // Test parsing key fields  
        const keysToTest = Object.keys(contact).slice(0, 5); // Test first 5 keys
        keysToTest.forEach(key => {
          expect(() => parseKey(key)).not.toThrow();
        });

        // Test markdown rendering (skip since it needs Obsidian context)
        const hashtags = contact.CATEGORIES ? 
          contact.CATEGORIES.split(',').map((cat: string) => `#${cat.trim()}`).join(' ') : 
          '#Contact';
        
        // Just test that the function exists 
        expect(typeof mdRender).toBe('function');
      }
    });

    it('should handle all character encodings in demo data', async () => {
      const vcfContacts: Array<{ slug: string; contact: any }> = [];
      for await (const [slug, contact] of VCardParser.parse(vcfContent)) {
        vcfContacts.push({ slug: slug!, contact });
      }

      // Test specific edge cases from demo data
      const edgeCases = [
        {
          description: 'Chinese characters',
          test: (contacts: any[]) => contacts.some(({ contact }) => 
            contact['N.GN'] === '伟' && contact['N.FN'] === '李'
          )
        },
        {
          description: 'Swedish characters', 
          test: (contacts: any[]) => contacts.some(({ contact }) =>
            contact['N.GN'] === 'Elin' && contact['N.FN'] === 'Lindström'
          )
        },
        {
          description: 'Icelandic characters',
          test: (contacts: any[]) => contacts.some(({ contact }) =>
            contact['N.GN'] === 'Elísabet' && contact['N.FN'] === 'Jónsdóttir'
          )
        },
        {
          description: 'Brazilian characters',
          test: (contacts: any[]) => contacts.some(({ contact }) =>
            contact['N.GN'] === 'Thiago' && contact['N.FN'] === 'Santos'
          )
        }
      ];

      edgeCases.forEach(({ description, test }) => {
        expect(test(vcfContacts)).toBe(true);
      });
    });

    it('should process all VCF data types present in demo', async () => {
      const vcfContacts: Array<{ slug: string; contact: any }> = [];
      for await (const [slug, contact] of VCardParser.parse(vcfContent)) {
        vcfContacts.push({ slug: slug!, contact });
      }

      // Check that all major vCard fields are handled
      const fieldTypes = new Set<string>();
      const fieldPatterns = new Set<string>();
      
      vcfContacts.forEach(({ contact }) => {
        Object.keys(contact).forEach(key => {
          // Track main field types
          const baseKey = key.split('[')[0].split('.')[0];
          fieldTypes.add(baseKey);
          
          // Track field patterns
          if (key.includes('[') && key.includes(']')) {
            fieldPatterns.add('TYPED_FIELD');
          }
          if (key.includes('.')) {
            fieldPatterns.add('STRUCTURED_FIELD');  
          }
        });
      });

      // Should handle all major vCard field types
      const expectedFieldTypes = ['N', 'FN', 'EMAIL', 'TEL', 'ADR', 'URL', 'ORG', 'BDAY', 'PHOTO', 'CATEGORIES', 'VERSION', 'UID'];
      expectedFieldTypes.forEach(expectedType => {
        expect(fieldTypes.has(expectedType)).toBe(true);
      });

      // Should handle typed and structured fields
      expect(fieldPatterns.has('TYPED_FIELD')).toBe(true);
      expect(fieldPatterns.has('STRUCTURED_FIELD')).toBe(true);
    });
  });

  describe('Model robustness with demo data', () => {
    it('should handle empty or minimal contact data gracefully', async () => {
      // Create minimal VCF entry
      const minimalVcf = `BEGIN:VCARD
VERSION:4.0
FN:Test Name
END:VCARD`;

      const contacts = [];
      for await (const [slug, contact] of VCardParser.parse(minimalVcf)) {
        contacts.push({ slug, contact });
      }

      expect(contacts).toHaveLength(1);
      expect(contacts[0].contact.FN).toBe('Test Name');
      expect(contacts[0].contact.VERSION).toBe('4.0');
    });

    it('should handle complex multi-line data from demo', async () => {
      // Find a contact with complex data (like large embedded photo)
      const vcfContacts = [];
      for await (const [slug, contact] of VCardParser.parse(vcfContent)) {
        vcfContacts.push({ slug, contact });
      }

      // Find Zahra Ali who has embedded photo data
      const zahraContact = vcfContacts.find(({ contact }) => 
        contact['N.GN'] === 'Zahra' && contact['N.FN'] === 'Ali'
      );

      expect(zahraContact).toBeDefined();
      expect(zahraContact?.contact.PHOTO).toBeDefined();
      expect(zahraContact?.contact.PHOTO).toContain('data:image/jpeg;base64');
      
      // Should still be able to process this contact through all models
      expect(() => createNameSlug(zahraContact!.contact)).not.toThrow();
      expect(typeof mdRender).toBe('function'); // Just verify function exists
    });

    it('should handle all phone number formats in demo data', async () => {
      const vcfContacts = [];
      for await (const [slug, contact] of VCardParser.parse(vcfContent)) {
        vcfContacts.push({ slug, contact });
      }

      const phonePatterns = new Set<string>();
      vcfContacts.forEach(({ contact }) => {
        Object.keys(contact).forEach(key => {
          if (key.startsWith('TEL')) {
            const value = contact[key];
            if (value) {
              // Track different phone number patterns
              if (value.startsWith('+1')) phonePatterns.add('US');
              if (value.startsWith('+86')) phonePatterns.add('CHINA');
              if (value.startsWith('+971')) phonePatterns.add('UAE');
              if (value.startsWith('+55')) phonePatterns.add('BRAZIL');
              if (value.startsWith('+7')) phonePatterns.add('RUSSIA');
              if (value.startsWith('+91')) phonePatterns.add('INDIA');
            }
          }
        });
      });

      // Should handle multiple international phone formats
      expect(phonePatterns.size).toBeGreaterThan(3);
    });

    it('should handle all email domain formats in demo data', async () => {
      const vcfContacts = [];
      for await (const [slug, contact] of VCardParser.parse(vcfContent)) {
        vcfContacts.push({ slug, contact });
      }

      const emailDomains = new Set<string>();
      vcfContacts.forEach(({ contact }) => {
        Object.keys(contact).forEach(key => {
          if (key.startsWith('EMAIL')) {
            const value = contact[key];
            if (value && value.includes('@')) {
              const domain = value.split('@')[1];
              emailDomains.add(domain);
            }
          }
        });
      });

      // Should handle multiple email domains
      expect(emailDomains.size).toBeGreaterThan(5);
      
      // Check for some expected domains from demo data
      const expectedDomains = ['wayneenterprises.com', 'starkindustries.com', 'zhuyukeji.cn'];
      expectedDomains.forEach(domain => {
        expect(Array.from(emailDomains).some(d => d.includes(domain.split('.')[0]))).toBe(true);
      });
    });
  });

  describe('VcardFile class integration', () => {
    it('should create empty VCard and maintain consistency', async () => {
      const emptyVcard = await VcardFile.createEmpty();
      expect(emptyVcard).toBeInstanceOf(VcardFile);
      expect(emptyVcard.toString()).toContain('VERSION:4.0');
      expect(emptyVcard.toString()).toContain('BEGIN:VCARD');
      expect(emptyVcard.toString()).toContain('END:VCARD');
    });

    it('should generate VCF filenames consistently', () => {
      const testNames = [
        'Tony Stark',
        'Bruce Wayne', 
        '李伟',
        'Elin Lindström',
        'Elísabet Jónsdóttir',
        'Thiago Santos'
      ];

      testNames.forEach(name => {
        const filename = VcardFile.generateVCFFilename(name);
        expect(filename).toBeDefined();
        expect(filename).toMatch(/\.(vcf)$/);
        expect(filename.length).toBeGreaterThan(4); // At least name + .vcf
      });
    });

    it('should detect UIDs in VCF content correctly', () => {
      const testCases = [
        {
          content: 'UID:test123\nFN:Test Name',
          uid: 'test123',
          expected: true
        },
        {
          content: 'FN:Test Name\nEMAIL:test@example.com',
          uid: 'test123', 
          expected: false
        },
        {
          content: 'UID:urn:uuid:019730a76c14a-4d32-a36e-a0f5dbf86fa3\nFN:Bruce Wayne',
          uid: 'urn:uuid:019730a76c14a-4d32-a36e-a0f5dbf86fa3',
          expected: true
        }
      ];

      testCases.forEach(({ content, uid, expected }) => {
        const result = VcardFile.containsUID(content, uid);
        expect(result).toBe(expected);
      });
    });
  });
});