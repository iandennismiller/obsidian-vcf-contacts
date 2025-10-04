/**
 * @fileoverview Example test demonstrating usage of reusable fixtures
 * 
 * This file shows how to use the new test fixtures to reduce boilerplate
 * and improve test readability.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  createMockApp,
  createMockSettings,
  createMockTFile,
  createMockTFiles,
  createMockFrontmatter,
  createMockFileContent,
  setupCommonMocks,
  vcfTemplates,
  testDataGenerators,
  runTestCases
} from '../fixtures';
import type { App, TFile } from 'obsidian';
import type { ContactsPluginSettings } from '../../src/plugin/settings';

describe('Example: Using Test Fixtures', () => {
  describe('Basic Mock Usage', () => {
    let mockApp: Partial<App>;
    let mockSettings: ContactsPluginSettings;
    let mockFile: TFile;

    beforeEach(() => {
      // Create individual mocks
      mockApp = createMockApp();
      mockSettings = createMockSettings();
      mockFile = createMockTFile('example-contact');
    });

    it('should have properly configured mocks', () => {
      expect(mockApp.vault).toBeDefined();
      expect(mockApp.metadataCache).toBeDefined();
      expect(mockSettings.contactsFolder).toBe('Contacts');
      expect(mockFile.basename).toBe('example-contact');
    });

    it('can customize mock behavior', () => {
      const customApp = createMockApp({
        vault: {
          read: vi.fn().mockResolvedValue('custom content')
        }
      });

      expect(customApp.vault!.read).toBeDefined();
    });
  });

  describe('Using setupCommonMocks', () => {
    it('should provide all common mocks at once', () => {
      const { mockApp, mockSettings, mockFile } = setupCommonMocks({
        basename: 'test-contact',
        settings: { contactsFolder: 'MyContacts' }
      });

      expect(mockApp).toBeDefined();
      expect(mockSettings.contactsFolder).toBe('MyContacts');
      expect(mockFile.basename).toBe('test-contact');
    });
  });

  describe('Creating Multiple Files', () => {
    it('should create multiple mock files easily', () => {
      const files = createMockTFiles(['john-doe', 'jane-doe', 'bob-smith']);

      expect(files).toHaveLength(3);
      expect(files[0].basename).toBe('john-doe');
      expect(files[1].basename).toBe('jane-doe');
      expect(files[2].basename).toBe('bob-smith');
    });
  });

  describe('Using Mock Frontmatter', () => {
    it('should create basic frontmatter', () => {
      const fm = createMockFrontmatter.basic();

      expect(fm.UID).toBeDefined();
      expect(fm.FN).toBe('John Doe');
      expect(fm.EMAIL).toBe('john@example.com');
    });

    it('should create frontmatter with relationships', () => {
      const fm = createMockFrontmatter.withRelationships();

      expect(fm['RELATED.spouse']).toBeDefined();
      expect(fm['RELATED.child']).toBeDefined();
    });

    it('should support custom overrides', () => {
      const fm = createMockFrontmatter.basic({
        FN: 'Custom Name',
        EMAIL: 'custom@example.com'
      });

      expect(fm.FN).toBe('Custom Name');
      expect(fm.EMAIL).toBe('custom@example.com');
    });
  });

  describe('Creating File Content', () => {
    it('should create complete file content', () => {
      const content = createMockFileContent(
        createMockFrontmatter.basic(),
        '## Notes\nExample notes here'
      );

      expect(content).toContain('---');
      expect(content).toContain('UID: test-uid-123');
      expect(content).toContain('## Notes');
    });
  });

  describe('Using VCF Templates', () => {
    it('should create basic VCF', () => {
      const vcf = vcfTemplates.basic('test-uid', 'Test Contact');

      expect(vcf).toContain('BEGIN:VCARD');
      expect(vcf).toContain('UID:test-uid');
      expect(vcf).toContain('FN:Test Contact');
      expect(vcf).toContain('END:VCARD');
    });

    it('should create VCF with email', () => {
      const vcf = vcfTemplates.withEmail('uid', 'Name', 'test@example.com');

      expect(vcf).toContain('EMAIL:test@example.com');
    });

    it('should create VCF with relationships', () => {
      const vcf = vcfTemplates.withRelationships('uid', 'Name', [
        { type: 'spouse', value: 'name:Partner' }
      ]);

      expect(vcf).toContain('RELATED;TYPE=spouse:name:Partner');
    });
  });

  describe('Using Test Data Generators', () => {
    it('should generate unique UIDs', () => {
      const uid1 = testDataGenerators.uid();
      const uid2 = testDataGenerators.uid();

      expect(uid1).not.toBe(uid2);
      expect(uid1).toMatch(/^test-/);
    });

    it('should generate multiple contacts', () => {
      const contacts = testDataGenerators.contacts(3);

      expect(contacts).toHaveLength(3);
      contacts.forEach(contact => {
        expect(contact.UID).toBeDefined();
        expect(contact.FN).toBeDefined();
        expect(contact.EMAIL).toBeDefined();
      });
    });

    it('should generate timestamps', () => {
      const timestamp = testDataGenerators.timestamp();

      expect(timestamp).toMatch(/^\d{8}T\d{6}Z$/);
    });
  });

  describe('Running Test Cases', () => {
    it('should test multiple cases efficiently', async () => {
      const testCases = [
        { extension: '.vcf', expected: true },
        { extension: '.txt', expected: false },
        { extension: '.md', expected: false },
        { extension: '.VCF', expected: true }
      ];

      const isVcfFile = (filename: string) => 
        filename.toLowerCase().endsWith('.vcf');

      await runTestCases(testCases, (testCase) => {
        const result = isVcfFile(`file${testCase.extension}`);
        expect(result).toBe(testCase.expected);
      });
    });
  });

  describe('Customizing Mocks', () => {
    it('should customize vault behavior', async () => {
      const app = createMockApp({
        vault: {
          read: vi.fn().mockResolvedValue('custom vault content')
        }
      });

      const content = await app.vault!.read({} as TFile);
      expect(content).toBe('custom vault content');
    });

    it('should customize metadata cache', () => {
      const customFrontmatter = createMockFrontmatter.withGender('female', {
        FN: 'Jane Doe'
      });

      const app = createMockApp({
        metadataCache: {
          getFileCache: vi.fn().mockReturnValue({
            frontmatter: customFrontmatter
          })
        }
      });

      const cache = app.metadataCache!.getFileCache({} as any);
      expect(cache.frontmatter.FN).toBe('Jane Doe');
      expect(cache.frontmatter.GENDER).toBe('female');
    });
  });
});
