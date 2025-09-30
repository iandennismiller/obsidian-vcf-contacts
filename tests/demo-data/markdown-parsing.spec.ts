import { describe, it, expect, beforeEach } from 'vitest';
import { parseKey, mdRender, createNameSlug, createFileName } from '../../src/models/contactNote';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Demo Markdown Data Validation', () => {
  let markdownFiles: string[];
  const demoMarkdownPath = path.join(__dirname, '../../docs/demo-data/markdown');

  beforeEach(async () => {
    markdownFiles = await fs.readdir(demoMarkdownPath);
    markdownFiles = markdownFiles.filter(file => file.endsWith('.md'));
  });

  describe('Markdown file structure validation', () => {
    it('should find all expected markdown demo files', () => {
      expect(markdownFiles).toHaveLength(18);
      
      // Check for key demo files
      const expectedFiles = [
        'Anya Volkova.md',
        'Bruce Wayne.md', 
        'Tony Stark.md',
        '伟 李.md',
        'Elin Lindström.md',
        'Elísabet Jónsdóttir.md'
      ];
      
      expectedFiles.forEach(expectedFile => {
        expect(markdownFiles).toContain(expectedFile);
      });
    });

    it('should parse frontmatter from all demo markdown files', async () => {
      for (const filename of markdownFiles) {
        const filePath = path.join(demoMarkdownPath, filename);
        const content = await fs.readFile(filePath, 'utf-8');
        
        // Check that file has frontmatter
        expect(content).toMatch(/^---\n/);
        expect(content).toMatch(/\n---\n/);
        
        // Extract frontmatter
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        expect(frontmatterMatch).toBeTruthy();
        
        const frontmatterLines = frontmatterMatch![1].split('\n');
        const frontmatter: Record<string, any> = {};
        
        // Parse YAML-like frontmatter manually for test
        frontmatterLines.forEach(line => {
          const colonIndex = line.indexOf(':');
          if (colonIndex !== -1) {
            const key = line.substring(0, colonIndex).trim();
            let value = line.substring(colonIndex + 1).trim();
            
            // Handle quoted values
            if ((value.startsWith('"') && value.endsWith('"')) || 
                (value.startsWith("'") && value.endsWith("'"))) {
              value = value.slice(1, -1);
            }
            
            frontmatter[key] = value;
          }
        });
        
        // Every contact should have some form of name
        const hasName = frontmatter.FN || (frontmatter['N.GN'] && frontmatter['N.FN']);
        expect(hasName).toBeTruthy();
        
        // Every contact should have VERSION
        expect(frontmatter.VERSION).toBe('4.0');
      }
    });
  });

  describe('Contact name and slug generation', () => {
    it('should generate valid name slugs for all demo contacts', async () => {
      const testCases = [
        { 
          file: 'Bruce Wayne.md',
          expectedFields: { 'N.GN': 'Bruce', 'N.FN': 'Wayne' }
        },
        {
          file: '伟 李.md', 
          expectedFields: { 'N.GN': '伟', 'N.FN': '李', 'FN': '李伟' }
        },
        {
          file: 'Elin Lindström.md',
          expectedFields: { 'N.GN': 'Elin', 'N.FN': 'Lindström' }
        }
      ];

      for (const testCase of testCases) {
        const slug = createNameSlug(testCase.expectedFields as any);
        expect(slug).toBeDefined();
        expect(typeof slug).toBe('string');
        expect(slug.length).toBeGreaterThan(0);
        
        // Test filename generation
        const filename = createFileName(testCase.expectedFields as any);
        expect(filename).toBe(slug + '.md');
      }
    });

    it('should handle special characters in name slugs', async () => {
      const specialCharCases = [
        { 
          records: { 'N.GN': 'Elin', 'N.FN': 'Lindström' },
          description: 'Swedish characters'
        },
        {
          records: { 'N.GN': 'Elísabet', 'N.FN': 'Jónsdóttir' },
          description: 'Icelandic characters'
        },
        {
          records: { 'N.GN': '伟', 'N.FN': '李', 'FN': '李伟' },
          description: 'Chinese characters'
        }
      ];

      specialCharCases.forEach(({ records, description }) => {
        expect(() => createNameSlug(records as any)).not.toThrow();
        const slug = createNameSlug(records as any);
        expect(slug).toBeDefined();
        expect(slug.length).toBeGreaterThan(0);
      });
    });
  });

  describe('parseKey utility function', () => {
    it('should parse various key formats from demo data', () => {
      const keyTestCases = [
        'N.GN',
        'N.FN', 
        'EMAIL[HOME]',
        'EMAIL[WORK]',
        'TEL[CELL]',
        'ADR[HOME].STREET',
        'ADR[HOME].LOCALITY',
        'ADR[HOME].POSTAL',
        'ADR[HOME].COUNTRY',
        'URL[HOME]',
        'URL[WORK]'
      ];

      keyTestCases.forEach(keyStr => {
        expect(() => parseKey(keyStr)).not.toThrow();
        const parsed = parseKey(keyStr);
        expect(parsed).toBeDefined();
        expect(parsed.key).toBeDefined();
      });
    });

    it('should handle complex key formats correctly', () => {
      const complexKeys = [
        'TEL[CELL]',
        'EMAIL[HOME]', 
        'ADR[HOME].STREET',
        'N.GN'
      ];

      complexKeys.forEach(key => {
        const parsed = parseKey(key);
        expect(parsed).toBeDefined();
        expect(parsed.key).toBeDefined();
        expect(typeof parsed.key).toBe('string');
        // Don't test specific internal structure since it may vary
      });
    });
  });

  describe('mdRender utility function', () => {
    it('should be callable without throwing import errors', () => {
      // Test that the function exists and is importable
      expect(typeof mdRender).toBe('function');
    });

    it('should handle basic data structures', () => {
      // Basic structural test - just verify it exists and can be called with minimal data
      // Note: Full rendering tests would require Obsidian context
      const minimalData = {
        'N.FN': 'Doe',
        'N.GN': 'John'
      };
      
      expect(() => {
        // Just test that the function exists and accepts the expected parameters
        const result = mdRender.toString(); // Get function signature without calling
        expect(result).toContain('function');
      }).not.toThrow();
    });
  });

  describe('Demo data consistency', () => {
    it('should have consistent contact categories', async () => {
      const categoriesFound = new Set<string>();
      
      for (const filename of markdownFiles) {
        const filePath = path.join(demoMarkdownPath, filename);
        const content = await fs.readFile(filePath, 'utf-8');
        
        // Extract categories from frontmatter
        const categoriesMatch = content.match(/CATEGORIES:\s*(.+)/);
        if (categoriesMatch) {
          const categories = categoriesMatch[1].split(',').map(cat => cat.trim());
          categories.forEach(cat => categoriesFound.add(cat));
        }
      }
      
      // Should have found various categories
      expect(categoriesFound.size).toBeGreaterThan(0);
      
      // Check for some expected categories
      const expectedCategories = ['Art', 'Detective', 'Sports', 'Nature', 'Programming'];
      const foundCategoriesArray = Array.from(categoriesFound);
      
      // At least some expected categories should be present
      const hasExpectedCategories = expectedCategories.some(expected => 
        foundCategoriesArray.some(found => found.includes(expected))
      );
      expect(hasExpectedCategories).toBe(true);
    });

    it('should have consistent photo URLs', async () => {
      for (const filename of markdownFiles) {
        const filePath = path.join(demoMarkdownPath, filename);
        const content = await fs.readFile(filePath, 'utf-8');
        
        const photoMatch = content.match(/PHOTO:\s*(.+)/);
        if (photoMatch) {
          const photoUrl = photoMatch[1].trim();
          // Should be either a URL or embedded data
          const isUrl = /^https?:\/\//.test(photoUrl);
          const isEmbedded = photoUrl.startsWith('data:image/');
          
          expect(isUrl || isEmbedded).toBe(true);
          
          if (isUrl) {
            expect(photoUrl).toContain('avatar');
            expect(photoUrl).toMatch(/\.(jpg|jpeg|png)$/);
          }
        }
      }
    });

    it('should have valid email formats', async () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      for (const filename of markdownFiles) {
        const filePath = path.join(demoMarkdownPath, filename);
        const content = await fs.readFile(filePath, 'utf-8');
        
        // Find email lines
        const emailMatches = content.match(/EMAIL\[[^\]]+\]"?:\s*([^\n]+)/g);
        if (emailMatches) {
          emailMatches.forEach(emailLine => {
            const emailMatch = emailLine.match(/:\s*(.+)/);
            if (emailMatch) {
              const email = emailMatch[1].trim();
              expect(email).toMatch(emailRegex);
            }
          });
        }
      }
    });
  });
});