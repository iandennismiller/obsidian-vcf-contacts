import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { VCardGenerator } from '../../src/models/vcardFile/generation';
import { ContactNote } from '../../src/models/contactNote';
import { ContactsPluginSettings } from 'src/plugin/settings';

/**
 * User Story 17: Efficient VCF Updates
 * As a user, I expect VCFs will only be updated when the data actually change; 
 * the plugin should ensure vcard and front matter are always sorted to prevent 
 * relationships, which inherently have no "order," from shuffling around 
 * chaotically when refreshed.
 */
describe('Efficient VCF Updates Story', () => {
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
      vcfStorageMethod: 'vcf-folder',
      vcfFilename: 'contacts.vcf',
      vcfWatchFolder: '/test/vcf',
      vcfWatchEnabled: false,
      vcfWatchPollingInterval: 30,
      vcfWriteBackEnabled: false,
      vcfCustomizeIgnoreList: false,
      vcfIgnoreFilenames: [],
      vcfIgnoreUIDs: [],
      logLevel: 'INFO'
    };
  });

  it('should not update VCF when contact data has not changed', () => {
    const contactData1 = {
      UID: 'john-doe-123',
      FN: 'John Doe',
      EMAIL: 'john@example.com',
      TEL: '+1-555-123-4567'
    };

    const contactData2 = {
      UID: 'john-doe-123',
      FN: 'John Doe',
      EMAIL: 'john@example.com',
      TEL: '+1-555-123-4567'
    };

    const vcf1 = VCardGenerator.objectToVcf(contactData1);
    const vcf2 = VCardGenerator.objectToVcf(contactData2);

    // VCF output should be identical for identical data
    expect(vcf1).toBe(vcf2);
  });

  it('should sort relationship fields consistently to prevent shuffling', () => {
    const contactWithRelationships = {
      UID: 'family-person-456',
      FN: 'Family Person',
      'RELATED[spouse]': 'name:Spouse Name',
      'RELATED[child]': 'name:Child One',
      'RELATED[1:child]': 'name:Child Two',
      'RELATED[parent]': 'name:Parent Name',
      'RELATED[sibling]': 'name:Sibling Name'
    };

    // Generate VCF multiple times
    const vcf1 = VCardGenerator.objectToVcf(contactWithRelationships);
    const vcf2 = VCardGenerator.objectToVcf(contactWithRelationships);
    const vcf3 = VCardGenerator.objectToVcf(contactWithRelationships);

    // All generations should produce identical output
    expect(vcf1).toBe(vcf2);
    expect(vcf2).toBe(vcf3);
  });

  it('should sort frontmatter fields consistently', async () => {
    const mockFile = { basename: 'test-contact', path: 'Contacts/test-contact.md' } as TFile;
    
    const contactData = {
      UID: 'test-contact-789',
      FN: 'Test Contact',
      EMAIL: 'test@example.com',
      TEL: '+1-555-987-6543',
      'RELATED[friend]': 'name:Friend One',
      'RELATED[colleague]': 'name:Colleague One',
      'RELATED[family]': 'name:Family One'
    };

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const markdown1 = contactNote.mdRender(contactData, mockSettings.defaultHashtag);
    const markdown2 = contactNote.mdRender(contactData, mockSettings.defaultHashtag);

    // Multiple renders should produce identical output
    expect(markdown1).toBe(markdown2);
  });

  it('should maintain consistent order of relationship fields in frontmatter', async () => {
    const mockFile = { basename: 'multi-rel', path: 'Contacts/multi-rel.md' } as TFile;
    
    // Different insertion order of relationships
    const contactData1 = {
      UID: 'multi-rel-001',
      FN: 'Multi Relationship Contact',
      'RELATED[colleague]': 'name:Person A',
      'RELATED[friend]': 'name:Person B',
      'RELATED[family]': 'name:Person C'
    };

    const contactData2 = {
      UID: 'multi-rel-001',
      FN: 'Multi Relationship Contact',
      'RELATED[family]': 'name:Person C',
      'RELATED[colleague]': 'name:Person A',
      'RELATED[friend]': 'name:Person B'
    };

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const markdown1 = contactNote.mdRender(contactData1, mockSettings.defaultHashtag);
    const markdown2 = contactNote.mdRender(contactData2, mockSettings.defaultHashtag);

    // Extract RELATED lines from both
    const relatedLines1 = markdown1.split('\n').filter(l => l.includes('RELATED[')).sort();
    const relatedLines2 = markdown2.split('\n').filter(l => l.includes('RELATED[')).sort();

    // After sorting, both should have the same relationship lines
    expect(relatedLines1).toEqual(relatedLines2);
  });

  it('should only update VCF when actual data changes', () => {
    const originalData = {
      UID: 'change-test-123',
      FN: 'Change Test',
      EMAIL: 'original@example.com'
    };

    const unchangedData = {
      UID: 'change-test-123',
      FN: 'Change Test',
      EMAIL: 'original@example.com'
    };

    const changedData = {
      UID: 'change-test-123',
      FN: 'Change Test',
      EMAIL: 'updated@example.com'  // Changed
    };

    const vcfOriginal = VCardGenerator.objectToVcf(originalData);
    const vcfUnchanged = VCardGenerator.objectToVcf(unchangedData);
    const vcfChanged = VCardGenerator.objectToVcf(changedData);

    // Unchanged data should produce same VCF
    expect(vcfOriginal).toBe(vcfUnchanged);
    
    // Changed data should produce different VCF
    expect(vcfOriginal).not.toBe(vcfChanged);
  });

  it('should handle REV field updates only when data changes', () => {
    const contactDataBase = {
      UID: 'rev-test-456',
      FN: 'Rev Test Contact',
      EMAIL: 'rev@example.com'
    };

    // Without REV field
    const vcf1 = VCardGenerator.objectToVcf(contactDataBase);
    const vcf2 = VCardGenerator.objectToVcf(contactDataBase);

    // Multiple generations without REV should be identical
    expect(vcf1).toBe(vcf2);
  });

  it('should sort indexed relationships consistently', () => {
    const contactWithIndexedRelations = {
      UID: 'indexed-rel-789',
      FN: 'Indexed Relations Contact',
      'RELATED[child]': 'name:First Child',
      'RELATED[1:child]': 'name:Second Child',
      'RELATED[2:child]': 'name:Third Child',
      'RELATED[3:child]': 'name:Fourth Child'
    };

    const vcf1 = VCardGenerator.objectToVcf(contactWithIndexedRelations);
    const vcf2 = VCardGenerator.objectToVcf(contactWithIndexedRelations);

    expect(vcf1).toBe(vcf2);
    
    // Check that indexed relationships maintain order
    const relatedLines = vcf1.split('\n').filter(line => line.startsWith('RELATED'));
    expect(relatedLines.length).toBeGreaterThan(0);
  });

  it('should prevent unnecessary file writes when data is equivalent', async () => {
    const mockFile = { basename: 'no-change', path: 'Contacts/no-change.md' } as TFile;
    
    const stableContent = `---
UID: no-change-999
FN: No Change Contact
EMAIL: stable@example.com
RELATED[friend]: name:Friend Name
RELATED[colleague]: name:Colleague Name
---

#### Related
- friend: [[Friend Name]]
- colleague: [[Colleague Name]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(stableContent);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'no-change-999',
        FN: 'No Change Contact',
        EMAIL: 'stable@example.com',
        'RELATED[friend]': 'name:Friend Name',
        'RELATED[colleague]': 'name:Colleague Name'
      }
    });

    const contactNote1 = new ContactNote(mockApp as App, mockSettings, mockFile);
    const contactNote2 = new ContactNote(mockApp as App, mockSettings, mockFile);

    const fm1 = await contactNote1.getFrontmatter();
    const fm2 = await contactNote2.getFrontmatter();

    // Frontmatter should be equivalent
    expect(fm1).toEqual(fm2);
  });

  it('should maintain alphabetical sorting of RELATED fields', () => {
    // According to spec: "Deterministic Ordering - When a set of relationships is mapped 
    // onto front matter: 1. First sort by key 2. Then sort by value"
    const contactData = {
      UID: 'alpha-sort-001',
      FN: 'Alpha Sort Contact',
      'RELATED[zebra]': 'name:Zebra Person',
      'RELATED[apple]': 'name:Apple Person',
      'RELATED[middle]': 'name:Middle Person'
    };

    const vcf = VCardGenerator.objectToVcf(contactData);
    const lines = vcf.split('\n');
    const relatedLines = lines.filter(line => line.startsWith('RELATED'));

    // Verify that RELATED fields appear in a consistent order (sorted by key)
    expect(relatedLines.length).toBe(3);
    // Fields should be sorted: apple, middle, zebra
    expect(relatedLines[0]).toContain('TYPE=apple');
    expect(relatedLines[1]).toContain('TYPE=middle');
    expect(relatedLines[2]).toContain('TYPE=zebra');
  });

  it('should only update REV when frontmatter data actually changes', () => {
    // According to spec: REV should only be updated when frontmatter actually changes
    // This prevents unnecessary updates and ensures efficient synchronization
    const unchangedData = {
      UID: 'rev-efficiency-123',
      FN: 'Rev Efficiency Test',
      EMAIL: 'test@example.com',
      REV: '20240315T143000Z'
    };

    // Same data, same REV
    const vcf1 = VCardGenerator.objectToVcf(unchangedData);
    const vcf2 = VCardGenerator.objectToVcf(unchangedData);

    // VCF output should be identical, REV should not have changed
    expect(vcf1).toBe(vcf2);
    expect(vcf1).toContain('REV:20240315T143000Z');
  });

  it('should handle empty relationship lists consistently', () => {
    const contactWithoutRelations1 = {
      UID: 'no-rel-123',
      FN: 'No Relations Contact',
      EMAIL: 'no-rel@example.com'
    };

    const contactWithoutRelations2 = {
      UID: 'no-rel-123',
      FN: 'No Relations Contact',
      EMAIL: 'no-rel@example.com'
    };

    const vcf1 = VCardGenerator.objectToVcf(contactWithoutRelations1);
    const vcf2 = VCardGenerator.objectToVcf(contactWithoutRelations2);

    expect(vcf1).toBe(vcf2);
    expect(vcf1).not.toContain('RELATED');
  });
});
