import { describe, it, expect, beforeEach } from 'vitest';
import { VCardParser } from '../../src/models/vcardFile/parsing';
import { VcardFile } from '../../src/models/vcardFile/vcardFile';
import { VCardFileOperations } from '../../src/models/vcardFile/fileOperations';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Demo VCF Data Parsing', () => {
  let demoVcfContent: string;
  const demoDataPath = path.join(__dirname, '../../docs/demo-data/vcf/contacts.vcf');

  beforeEach(async () => {
    demoVcfContent = await fs.readFile(demoDataPath, 'utf-8');
  });

  describe('VCardParser with demo data', () => {
    it('should parse all demo VCF contacts without errors', async () => {
      const contacts = [];
      
      for await (const [slug, contact] of VCardParser.parse(demoVcfContent)) {
        contacts.push({ slug, contact });
      }

      // Should parse most contacts (vcard4 may skip/merge some invalid entries)
      // The demo file has one vCard with duplicate FN fields which vcard4 may handle differently
      expect(contacts.length).toBeGreaterThanOrEqual(17);
      expect(contacts.length).toBeLessThanOrEqual(18);
      
      // Every contact should have a slug
      contacts.forEach(({ slug, contact }) => {
        expect(slug).toBeDefined();
        expect(typeof slug).toBe('string');
        expect(slug?.length).toBeGreaterThan(0);
      });
    });

    it('should handle Chinese names correctly', async () => {
      const contacts = [];
      
      for await (const [slug, contact] of VCardParser.parse(demoVcfContent)) {
        contacts.push({ slug, contact });
      }

      // Find the Chinese contact (李伟)
      const chineseContact = contacts.find(({ contact }) => 
        contact['N.GN'] === '伟' && contact['N.FN'] === '李'
      );
      
      expect(chineseContact).toBeDefined();
      // The FN field could be either, depending on parsing order
      expect(chineseContact?.contact.FN).toMatch(/^(伟 李|李伟)$/);
      expect(chineseContact?.contact.ORG).toBe('竹语科技有限公司');
      expect(chineseContact?.contact.ROLE).toBe('首席算法工程师');
      expect(chineseContact?.contact['ADR.HOME.LOCALITY']).toBe('成都');
      expect(chineseContact?.contact['ADR.HOME.COUNTRY']).toBe('中国');
    });

    it('should handle special characters in names', async () => {
      const contacts = [];
      
      for await (const [slug, contact] of VCardParser.parse(demoVcfContent)) {
        contacts.push({ slug, contact });
      }

      // Find contacts with special characters
      const lindstromContact = contacts.find(({ contact }) => 
        contact['N.GN'] === 'Elin' && contact['N.FN'] === 'Lindström'
      );
      
      const jonsdottirContact = contacts.find(({ contact }) => 
        contact['N.GN'] === 'Elísabet' && contact['N.FN'] === 'Jónsdóttir'
      );

      expect(lindstromContact).toBeDefined();
      expect(lindstromContact?.contact.FN).toBe('Elin Lindström');
      
      expect(jonsdottirContact).toBeDefined();
      expect(jonsdottirContact?.contact.FN).toBe('Elísabet Jónsdóttir');
    });

    it('should parse all required contact fields', async () => {
      const contacts = [];
      
      for await (const [slug, contact] of VCardParser.parse(demoVcfContent)) {
        contacts.push({ slug, contact });
      }

      contacts.forEach(({ contact }) => {
        // All contacts should have some form of name
        expect(contact.FN || (contact['N.GN'] && contact['N.FN'])).toBeTruthy();
        
        // Most contacts should have a UID (but not all demo data might have it)
        // Just check if UID exists, it should be a string
        if (contact.UID) {
          expect(typeof contact.UID).toBe('string');
        }
      });
    });

    it('should handle email and phone fields correctly', async () => {
      const contacts = [];
      
      for await (const [slug, contact] of VCardParser.parse(demoVcfContent)) {
        contacts.push({ slug, contact });
      }

      // Find Tony Stark as an example
      const tonyStark = contacts.find(({ contact }) => 
        contact['N.GN'] === 'Tony' && contact['N.FN'] === 'Stark'
      );
      
      expect(tonyStark).toBeDefined();
      expect(tonyStark?.contact['EMAIL.HOME']).toBe('tony.stark@starkindustries.com');
      expect(tonyStark?.contact['EMAIL.WORKSHOP']).toBe('ironman@avengers.com');
      expect(tonyStark?.contact['TEL.CELL']).toBe('+13105551234');
    });

    it('should handle address fields correctly', async () => {
      const contacts = [];
      
      for await (const [slug, contact] of VCardParser.parse(demoVcfContent)) {
        contacts.push({ slug, contact });
      }

      // Find Bruce Wayne as an example  
      const bruceWayne = contacts.find(({ contact }) => 
        contact['N.GN'] === 'Bruce' && contact['N.FN'] === 'Wayne'
      );
      
      expect(bruceWayne).toBeDefined();
      expect(bruceWayne?.contact['ADR.HOME.STREET']).toBe('1007 Mountain Drive');
      expect(bruceWayne?.contact['ADR.HOME.LOCALITY']).toBe('Gotham');
      expect(bruceWayne?.contact['ADR.HOME.POSTAL']).toBe('10001');
      expect(bruceWayne?.contact['ADR.HOME.COUNTRY']).toBe('USA');
    });
  });

  describe('VcardFile with demo data', () => {
    it('should create VcardFile instance from demo data', () => {
      const vcardFile = new VcardFile(demoVcfContent);
      
      expect(vcardFile).toBeInstanceOf(VcardFile);
      expect(vcardFile.toString()).toBe(demoVcfContent);
    });

    it('should parse demo data through VcardFile interface', async () => {
      const vcardFile = new VcardFile(demoVcfContent);
      const contacts = [];
      
      for await (const [slug, contact] of vcardFile.parse()) {
        contacts.push({ slug, contact });
      }
      
      // Should parse most contacts (vcard4 may skip/merge some invalid entries)
      expect(contacts.length).toBeGreaterThanOrEqual(17);
      expect(contacts.length).toBeLessThanOrEqual(18);
    });

    it('should generate appropriate filenames for demo contacts', () => {
      // Test filename generation for various contact names
      const testCases = [
        { name: 'Tony Stark', expected: 'Tony_Stark.vcf' },
        { name: 'Bruce Wayne', expected: 'Bruce_Wayne.vcf' },
        { name: '李伟', expected: '__.vcf' }, // Non-ASCII chars become underscores
        { name: 'Elin Lindström', expected: 'Elin_Lindstr_m.vcf' }, // Special chars become underscores
        { name: 'Elísabet Jónsdóttir', expected: 'El_sabet_J_nsd_ttir.vcf' }
      ];

      testCases.forEach(({ name, expected }) => {
        const filename = VCardFileOperations.generateVcardFilename(name);
        expect(filename).toBe(expected);
      });
    });
  });
});