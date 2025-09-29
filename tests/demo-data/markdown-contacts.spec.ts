import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import * as path from 'path';

// Simple YAML parser for frontmatter (matches Obsidian's parseYaml behavior)
function parseFrontmatter(content: string): Record<string, any> | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  
  const yamlContent = match[1];
  const result: Record<string, any> = {};
  
  // Simple YAML parsing - handles key: value pairs
  const lines = yamlContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;
    
    let key = trimmed.substring(0, colonIndex).trim();
    let value = trimmed.substring(colonIndex + 1).trim();
    
    // Remove quotes from key if present
    if ((key.startsWith('"') && key.endsWith('"')) || 
        (key.startsWith("'") && key.endsWith("'"))) {
      key = key.slice(1, -1);
    }
    
    // Remove quotes from value if present
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    
    result[key] = value;
  }
  
  return result;
}

describe('Demo Markdown Contact Files', () => {
  let markdownFiles: string[];
  const demoDataPath = path.join(__dirname, '../../docs/demo-data/markdown');

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Get all markdown files in the demo-data directory
    markdownFiles = readdirSync(demoDataPath)
      .filter(file => file.endsWith('.md'))
      .map(file => path.join(demoDataPath, file));
  });

  describe('File Structure Validation', () => {
    it('should have demo markdown files available', () => {
      expect(markdownFiles.length).toBeGreaterThan(0);
      console.log(`Found ${markdownFiles.length} demo markdown files`);
    });

    it('should have valid frontmatter in all markdown files', () => {
      markdownFiles.forEach(filePath => {
        const content = readFileSync(filePath, 'utf-8');
        const frontmatter = parseFrontmatter(content);
        
        expect(frontmatter).toBeDefined();
        expect(typeof frontmatter).toBe('object');
        
        // Should have FN (formatted name) OR at least N.FN and N.GN for structured names
        const hasFN = frontmatter!.FN;
        const hasStructuredName = frontmatter!['N.FN'] && frontmatter!['N.GN'];
        expect(hasFN || hasStructuredName).toBeTruthy();
        
        if (hasFN) {
          expect(typeof frontmatter!.FN).toBe('string');
          expect(frontmatter!.FN.trim().length).toBeGreaterThan(0);
          console.log(`✓ ${path.basename(filePath)}: FN="${frontmatter!.FN}"`);
        } else if (hasStructuredName) {
          console.log(`✓ ${path.basename(filePath)}: N.GN="${frontmatter!['N.GN']}" N.FN="${frontmatter!['N.FN']}"`);
        }
      });
    });

    it('should have VERSION field set to 4.0 in all contacts', () => {
      markdownFiles.forEach(filePath => {
        const content = readFileSync(filePath, 'utf-8');
        const frontmatter = parseFrontmatter(content);
        
        expect(frontmatter!.VERSION).toBeDefined();
        expect(frontmatter!.VERSION).toBe('4.0');
      });
    });

    it('should have UID field in all contacts (with few exceptions)', () => {
      const filesWithoutUID = [];
      
      markdownFiles.forEach(filePath => {
        const content = readFileSync(filePath, 'utf-8');
        const frontmatter = parseFrontmatter(content);
        
        if (!frontmatter!.UID) {
          filesWithoutUID.push(path.basename(filePath));
        } else {
          expect(typeof frontmatter!.UID).toBe('string');
          expect(frontmatter!.UID.trim().length).toBeGreaterThan(0);
          
          // UID should follow URN format
          expect(frontmatter!.UID).toMatch(/^urn:uuid:/);
        }
      });
      
      // Most files should have UID, allow a few exceptions
      expect(filesWithoutUID.length).toBeLessThanOrEqual(2);
      console.log(`Files without UID: ${filesWithoutUID.join(', ')}`);
    });
  });

  describe('Individual Contact Validation', () => {
    it('should correctly parse Bruce Wayne contact', () => {
      const bruceFile = markdownFiles.find(f => f.includes('Bruce Wayne'));
      expect(bruceFile).toBeDefined();
      
      const content = readFileSync(bruceFile!, 'utf-8');
      const frontmatter = parseFrontmatter(content);
      const data = frontmatter!;
      
      // Bruce Wayne doesn't have FN, but has structured name
      expect(data['N.FN']).toBe('Wayne');
      expect(data['N.GN']).toBe('Bruce');
      expect(data['EMAIL[HOME]']).toBe('bruce.wayne@wayneenterprises.com');
      expect(data['EMAIL[WORK]']).toBe('batman@batcave.org');
      expect(data.ORG).toBe('Wayne Enterprises');
      expect(data.BDAY).toBe('1939-05-27');
      expect(data.CATEGORIES).toBe('Detective, Billionaire, Vigilante');
    });

    it('should correctly parse Chinese contact (伟 李)', () => {
      const chineseFile = markdownFiles.find(f => f.includes('伟 李'));
      expect(chineseFile).toBeDefined();
      
      const content = readFileSync(chineseFile!, 'utf-8');
      const frontmatter = parseFrontmatter(content);
      const data = frontmatter!;
      
      expect(data.FN).toBe('李伟');
      expect(data['N.FN']).toBe('李');
      expect(data['N.GN']).toBe('伟');
      expect(data['EMAIL[HOME]']).toBe('liwei@zhuyukeji.cn');
      expect(data['EMAIL[WORK]']).toBe('li.wei@bamboo-tech.cn');
      expect(data.ORG).toBe('竹语科技有限公司');
      expect(data.CATEGORIES).toBe('自然, 编程, 茶');
      expect(data['ADR[HOME].COUNTRY']).toBe('中国');
    });

    it('should correctly parse Zahra Ali contact', () => {
      const zahraFile = markdownFiles.find(f => f.includes('Zahra Ali'));
      expect(zahraFile).toBeDefined();
      
      const content = readFileSync(zahraFile!, 'utf-8');
      const frontmatter = parseFrontmatter(content);
      const data = frontmatter!;
      
      expect(data.FN).toBe('Zahra Ali');
      expect(data['N.FN']).toBe('Ali');
      expect(data['N.GN']).toBe('Zahra');
      expect(data['EMAIL[HOME]']).toBe('zahra.moon@miragemail.ae');
      expect(data['EMAIL[WORK]']).toBe('zahra@dreambuild.ae');
      expect(data.ORG).toBe('Mirage Dream Builders');
      expect(data.ROLE).toBe('Lead Vision Architect');
      expect(data['ADR[HOME].COUNTRY']).toBe('UAE');
    });

    it('should correctly parse organization contact (India Gate)', () => {
      const orgFile = markdownFiles.find(f => f.includes('India Gate'));
      expect(orgFile).toBeDefined();
      
      const content = readFileSync(orgFile!, 'utf-8');
      const frontmatter = parseFrontmatter(content);
      const data = frontmatter!;
      
      expect(data.FN).toBe('India Gate (1931)');
      expect(data.ORG).toBe('Magic Trips');
      expect(data.KIND).toBe('ORG');
      expect(data.CATEGORIES).toBe('Trips');
      expect(data['ADR[HOME].COUNTRY']).toBe('India');
    });

    it('should correctly parse Snip & Sip AB organization', () => {
      const orgFile = markdownFiles.find(f => f.includes('Snip & Sip AB'));
      expect(orgFile).toBeDefined();
      
      const content = readFileSync(orgFile!, 'utf-8');
      const frontmatter = parseFrontmatter(content);
      const data = frontmatter!;
      
      expect(data.FN).toBe('Snip & Sip AB');
      expect(data.KIND).toBe('org');
      // Should have organization-specific fields
      expect(data.FN).toBeDefined();
    });
  });

  describe('Special Characters and Internationalization', () => {
    it('should handle special characters in contact names', () => {
      const specialFiles = markdownFiles.filter(f => 
        f.includes('Ó') || f.includes('ñ') || f.includes('é') || f.includes('Ø') || f.includes('伟')
      );
      
      expect(specialFiles.length).toBeGreaterThan(0);
      
      specialFiles.forEach(filePath => {
        const content = readFileSync(filePath, 'utf-8');
        const frontmatter = parseFrontmatter(content);
        
        expect(frontmatter!.FN).toBeDefined();
        expect(typeof frontmatter!.FN).toBe('string');
        expect(frontmatter!.FN.trim().length).toBeGreaterThan(0);
        
        console.log(`✓ Special chars in: ${frontmatter!.FN}`);
      });
    });

    it('should handle different language content properly', () => {
      // Find contacts with non-English content
      const internationalContacts = [];
      
      markdownFiles.forEach(filePath => {
        const content = readFileSync(filePath, 'utf-8');
        const frontmatter = parseFrontmatter(content);
        const data = frontmatter!;
        
        // Check for non-ASCII characters in various fields
        if (data.ORG && /[\u4e00-\u9fff\u0600-\u06ff\u00c0-\u017f]/.test(data.ORG)) {
          internationalContacts.push({
            file: path.basename(filePath),
            name: data.FN,
            org: data.ORG
          });
        }
        
        if (data.CATEGORIES && /[\u4e00-\u9fff\u0600-\u06ff\u00c0-\u017f]/.test(data.CATEGORIES)) {
          internationalContacts.push({
            file: path.basename(filePath),
            name: data.FN,
            categories: data.CATEGORIES
          });
        }
      });
      
      expect(internationalContacts.length).toBeGreaterThan(0);
      console.log('International content found:', internationalContacts);
    });
  });

  describe('Address and Contact Information', () => {
    it('should have properly structured address fields', () => {
      const addressContacts = [];
      
      markdownFiles.forEach(filePath => {
        const content = readFileSync(filePath, 'utf-8');
        const frontmatter = parseFrontmatter(content);
        const data = frontmatter!;
        
        const addressFields = Object.keys(data).filter(key => key.startsWith('ADR['));
        if (addressFields.length > 0) {
          addressContacts.push({
            name: data.FN,
            fields: addressFields
          });
        }
      });
      
      expect(addressContacts.length).toBeGreaterThan(0);
      
      // Check address structure
      addressContacts.forEach(contact => {
        expect(contact.fields.some(field => field.includes('.STREET'))).toBe(true);
        expect(contact.fields.some(field => field.includes('.LOCALITY'))).toBe(true);
        expect(contact.fields.some(field => field.includes('.COUNTRY'))).toBe(true);
      });
    });

    it('should have properly formatted email addresses', () => {
      markdownFiles.forEach(filePath => {
        const content = readFileSync(filePath, 'utf-8');
        const frontmatter = parseFrontmatter(content);
        const data = frontmatter!;
        
        const emailFields = Object.keys(data).filter(key => key.startsWith('EMAIL'));
        
        emailFields.forEach(emailField => {
          const email = data[emailField];
          expect(email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
        });
      });
    });

    it('should have properly formatted phone numbers', () => {
      markdownFiles.forEach(filePath => {
        const content = readFileSync(filePath, 'utf-8');
        const frontmatter = parseFrontmatter(content);
        const data = frontmatter!;
        
        const phoneFields = Object.keys(data).filter(key => key.startsWith('TEL'));
        
        phoneFields.forEach(phoneField => {
          const phone = data[phoneField];
          // Phone can be in format "+1234567890" or "TYPE:+1234567890"
          if (phone.includes(':')) {
            // Format like "CELL:+12125550000"
            const phonePart = phone.split(':')[1];
            expect(phonePart).toMatch(/^\+\d+/);
          } else {
            // Direct format like "+12125550000"
            expect(phone).toMatch(/^\+\d+/);
          }
        });
      });
    });

    it('should have valid URL fields', () => {
      markdownFiles.forEach(filePath => {
        const content = readFileSync(filePath, 'utf-8');
        const frontmatter = parseFrontmatter(content);
        const data = frontmatter!;
        
        const urlFields = Object.keys(data).filter(key => key.startsWith('URL'));
        
        urlFields.forEach(urlField => {
          const url = data[urlField];
          expect(url).toMatch(/^https?:\/\//);
        });
      });
    });
  });

  describe('Photo Fields', () => {
    it('should handle both data URI and external URL photos', () => {
      const photoContacts = [];
      
      markdownFiles.forEach(filePath => {
        const content = readFileSync(filePath, 'utf-8');
        const frontmatter = parseFrontmatter(content);
        const data = frontmatter!;
        
        if (data.PHOTO) {
          photoContacts.push({
            name: data.FN,
            photoType: data.PHOTO.startsWith('data:') ? 'dataURI' : 'externalURL',
            photo: data.PHOTO.substring(0, 50) + '...'
          });
        }
      });
      
      expect(photoContacts.length).toBeGreaterThan(0);
      
      // Should have both types
      const dataURIContacts = photoContacts.filter(c => c.photoType === 'dataURI');
      const urlContacts = photoContacts.filter(c => c.photoType === 'externalURL');
      
      expect(dataURIContacts.length).toBeGreaterThan(0);
      expect(urlContacts.length).toBeGreaterThan(0);
      
      console.log('Photo types found:', {
        dataURI: dataURIContacts.length,
        externalURL: urlContacts.length
      });
    });

    it('should have valid data URI format for embedded photos', () => {
      markdownFiles.forEach(filePath => {
        const content = readFileSync(filePath, 'utf-8');
        const frontmatter = parseFrontmatter(content);
        const data = frontmatter!;
        
        if (data.PHOTO && data.PHOTO.startsWith('data:')) {
          expect(data.PHOTO).toMatch(/^data:image\/(jpeg|jpg|png|gif);base64,/);
        }
      });
    });

    it('should have valid external URLs for photo links', () => {
      markdownFiles.forEach(filePath => {
        const content = readFileSync(filePath, 'utf-8');
        const frontmatter = parseFrontmatter(content);
        const data = frontmatter!;
        
        if (data.PHOTO && data.PHOTO.startsWith('http')) {
          expect(data.PHOTO).toMatch(/^https:\/\//);
          expect(data.PHOTO).toMatch(/\.(jpg|jpeg|png|gif)$/i);
        }
      });
    });
  });

  describe('Birthday and Date Fields', () => {
    it('should have properly formatted birthday dates', () => {
      markdownFiles.forEach(filePath => {
        const content = readFileSync(filePath, 'utf-8');
        const frontmatter = parseFrontmatter(content);
        const data = frontmatter!;
        
        if (data.BDAY) {
          // Should be in YYYY-MM-DD format
          expect(data.BDAY).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          
          // Should be a valid date
          const date = new Date(data.BDAY);
          expect(date.getTime()).not.toBeNaN();
        }
      });
    });
  });

  describe('Categories and Tags', () => {
    it('should have consistent category formatting', () => {
      const allCategories = [];
      
      markdownFiles.forEach(filePath => {
        const content = readFileSync(filePath, 'utf-8');
        const frontmatter = parseFrontmatter(content);
        const data = frontmatter!;
        
        if (data.CATEGORIES) {
          const categories = data.CATEGORIES.split(',').map((c: string) => c.trim());
          allCategories.push(...categories);
        }
      });
      
      expect(allCategories.length).toBeGreaterThan(0);
      
      // Categories should not be empty
      allCategories.forEach(category => {
        expect(category.length).toBeGreaterThan(0);
      });
      
      console.log('All categories found:', [...new Set(allCategories)]);
    });
  });
});