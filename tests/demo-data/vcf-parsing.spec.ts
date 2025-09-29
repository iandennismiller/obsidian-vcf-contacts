import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VCardParser } from '../../src/models/vcardFile/parsing';
import { readFileSync } from 'fs';
import * as path from 'path';

describe('Demo VCF Data Parsing', () => {
  let vcfContent: string;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Read the demo VCF file
    const vcfPath = path.join(__dirname, '../../docs/demo-data/vcf/contacts.vcf');
    vcfContent = readFileSync(vcfPath, 'utf-8');
  });

  describe('Main VCF File Parsing', () => {
    it('should successfully parse the demo contacts.vcf file', async () => {
      const results = [];
      
      for await (const [slug, record] of VCardParser.parse(vcfContent)) {
        results.push({ slug, record });
      }
      
      // Should have parsed multiple contacts
      expect(results.length).toBeGreaterThan(0);
      
      // Each result should have slug and record
      results.forEach(result => {
        expect(result.slug).toBeDefined();
        expect(typeof result.slug).toBe('string');
        expect(result.record).toBeDefined();
        expect(typeof result.record).toBe('object');
      });
    });

    it('should parse contacts with Chinese names correctly', async () => {
      const results = [];
      
      for await (const [slug, record] of VCardParser.parse(vcfContent)) {
        results.push({ slug, record });
      }
      
      // Find the Chinese contact (伟 李)
      const chineseContact = results.find(r => 
        r.record.FN === '伟 李' || r.record.FN === '李伟'
      );
      
      expect(chineseContact).toBeDefined();
      expect(chineseContact?.record['N.FN']).toBe('李');
      expect(chineseContact?.record['N.GN']).toBe('伟');
      expect(chineseContact?.record.ORG).toBe('竹语科技有限公司');
    });

    it('should parse contacts with Arabic names correctly', async () => {
      const results = [];
      
      for await (const [slug, record] of VCardParser.parse(vcfContent)) {
        results.push({ slug, record });
      }
      
      // Find Arabic contact (Zahra Ali)
      const arabicContact = results.find(r => r.record.FN === 'Zahra Ali');
      
      expect(arabicContact).toBeDefined();
      expect(arabicContact?.record['N.FN']).toBe('Ali');
      expect(arabicContact?.record['N.GN']).toBe('Zahra');
      // Check for email addresses - might be with different TYPE syntax
      const emailFields = Object.keys(arabicContact?.record || {}).filter(key => key.startsWith('EMAIL'));
      expect(emailFields.length).toBeGreaterThan(0);
    });

    it('should handle contacts with photo data URIs', async () => {
      const results = [];
      
      for await (const [slug, record] of VCardParser.parse(vcfContent)) {
        results.push({ slug, record });
      }
      
      // Find contact with data URI photo (Zahra Ali)
      const photoContact = results.find(r => 
        r.record.PHOTO && r.record.PHOTO.startsWith('data:image/jpeg;base64,')
      );
      
      expect(photoContact).toBeDefined();
      expect(photoContact?.record.PHOTO).toMatch(/^data:image\/jpeg;base64,/);
    });

    it('should handle contacts with external photo URLs', async () => {
      const results = [];
      
      for await (const [slug, record] of VCardParser.parse(vcfContent)) {
        results.push({ slug, record });
      }
      
      // Find contact with external photo URL (李伟)
      const urlPhotoContact = results.find(r => 
        r.record.PHOTO && r.record.PHOTO.startsWith('https://')
      );
      
      expect(urlPhotoContact).toBeDefined();
      expect(urlPhotoContact?.record.PHOTO).toMatch(/^https:\/\/raw\.githubusercontent\.com/);
    });

    it('should parse all required vCard fields correctly', async () => {
      const results = [];
      
      for await (const [slug, record] of VCardParser.parse(vcfContent)) {
        results.push({ slug, record });
      }
      
      // Check that each contact has minimum required fields
      results.forEach(result => {
        const record = result.record;
        
        // Each contact should have FN (formatted name)
        expect(record.FN).toBeDefined();
        expect(typeof record.FN).toBe('string');
        expect(record.FN.trim().length).toBeGreaterThan(0);
        
        // Each contact should have VERSION
        expect(record.VERSION).toBeDefined();
        expect(record.VERSION).toBe('4.0');
      });
    });

    it('should parse structured name fields correctly', async () => {
      const results = [];
      
      for await (const [slug, record] of VCardParser.parse(vcfContent)) {
        results.push({ slug, record });
      }
      
      // Find contacts with structured names
      const structuredContacts = results.filter(r => 
        r.record['N.FN'] && r.record['N.GN']
      );
      
      expect(structuredContacts.length).toBeGreaterThan(0);
      
      structuredContacts.forEach(contact => {
        expect(contact.record['N.FN']).toBeDefined();
        expect(contact.record['N.GN']).toBeDefined();
        expect(typeof contact.record['N.FN']).toBe('string');
        expect(typeof contact.record['N.GN']).toBe('string');
      });
    });

    it('should parse contact addresses correctly', async () => {
      const results = [];
      
      for await (const [slug, record] of VCardParser.parse(vcfContent)) {
        results.push({ slug, record });
      }
      
      // Find contacts with addresses
      const addressContacts = results.filter(r => 
        Object.keys(r.record).some(key => key.startsWith('ADR'))
      );
      
      expect(addressContacts.length).toBeGreaterThan(0);
      
      // Test specific address structure (Chinese contact with Chinese address)
      const chineseContact = results.find(r => r.record.FN === '伟 李' || r.record.FN === '李伟');
      if (chineseContact) {
        const addressFields = Object.keys(chineseContact.record).filter(key => key.startsWith('ADR'));
        expect(addressFields.length).toBeGreaterThan(0);
        
        // Should have some address content
        const hasChineseContent = addressFields.some(key => {
          const value = chineseContact.record[key];
          return value && (value.includes('成都') || value.includes('中国'));
        });
        expect(hasChineseContent).toBe(true);
      }
    });

    it('should parse multiple email addresses correctly', async () => {
      const results = [];
      
      for await (const [slug, record] of VCardParser.parse(vcfContent)) {
        results.push({ slug, record });
      }
      
      // Find contacts with multiple emails
      const multiEmailContacts = results.filter(r => {
        const emailKeys = Object.keys(r.record).filter(key => key.startsWith('EMAIL'));
        return emailKeys.length > 1;
      });
      
      expect(multiEmailContacts.length).toBeGreaterThan(0);
      
      // Check Zahra Ali specifically (has both home and work emails)
      const zahra = results.find(r => r.record.FN === 'Zahra Ali');
      if (zahra) {
        const emailFields = Object.keys(zahra.record).filter(key => key.startsWith('EMAIL'));
        expect(emailFields.length).toBeGreaterThan(1);
        
        // Should have email addresses
        const hasHomeEmail = emailFields.some(key => zahra.record[key] === 'zahra.moon@miragemail.ae');
        const hasWorkEmail = emailFields.some(key => zahra.record[key] === 'zahra@dreambuild.ae');
        expect(hasHomeEmail || hasWorkEmail).toBe(true);
      }
    });

    it('should parse telephone numbers with different types correctly', async () => {
      const results = [];
      
      for await (const [slug, record] of VCardParser.parse(vcfContent)) {
        results.push({ slug, record });
      }
      
      // Find contacts with multiple phone numbers
      const multiPhoneContacts = results.filter(r => {
        const phoneKeys = Object.keys(r.record).filter(key => key.startsWith('TEL'));
        return phoneKeys.length > 1;
      });
      
      expect(multiPhoneContacts.length).toBeGreaterThan(0);
      
      // Check that phone numbers exist and have valid format
      multiPhoneContacts.forEach(contact => {
        const phoneKeys = Object.keys(contact.record).filter(key => key.startsWith('TEL'));
        expect(phoneKeys.length).toBeGreaterThan(1);
        
        // Check that phone numbers have valid values
        phoneKeys.forEach(key => {
          const phone = contact.record[key];
          expect(phone).toBeDefined();
          expect(typeof phone).toBe('string');
          expect(phone.trim().length).toBeGreaterThan(0);
        });
      });
    });

    it('should handle organization and role information', async () => {
      const results = [];
      
      for await (const [slug, record] of VCardParser.parse(vcfContent)) {
        results.push({ slug, record });
      }
      
      // Find contacts with organization info
      const orgContacts = results.filter(r => r.record.ORG);
      
      expect(orgContacts.length).toBeGreaterThan(0);
      
      orgContacts.forEach(contact => {
        expect(contact.record.ORG).toBeDefined();
        expect(typeof contact.record.ORG).toBe('string');
        expect(contact.record.ORG.trim().length).toBeGreaterThan(0);
      });
    });
  });
});