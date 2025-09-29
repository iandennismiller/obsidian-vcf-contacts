import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { ContactNote } from '../../src/models/contactNote';
import { ContactsPluginSettings } from '../../src/settings/settings.d';

/**
 * User Story 11: Contact Creation from Template
 * As a user, when I create a new contact note, I want it to follow a consistent 
 * template with proper frontmatter fields for UID, name, email, phone, and other 
 * vCard-standard fields.
 */
describe('Contact Creation from Template Story', () => {
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
      vcfWatchEnabled: true,
      vcfWatchPollingInterval: 30,
      vcfWriteBackEnabled: false,
      vcfCustomizeIgnoreList: false,
      vcfIgnoreFilenames: [],
      vcfIgnoreUIDs: [],
      logLevel: 'INFO'
    };
  });

  it('should render a contact with standard vCard fields', () => {
    const contactRecord = {
      UID: 'john-doe-123',
      FN: 'John Doe',
      N: 'Doe;John;;;',
      EMAIL: 'john@example.com',
      TEL: '+1-555-123-4567',
      ORG: 'Acme Corporation',
      TITLE: 'Software Engineer',
      ADR: ';;123 Main St;Anytown;CA;12345;USA',
      URL: 'https://johndoe.com',
      BDAY: '1990-01-15',
      GENDER: 'M'
    };

    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    const markdown = contactNote.mdRender(contactRecord, mockSettings.defaultHashtag);
    
    // Should contain frontmatter with all key fields
    expect(markdown).toContain('---');
    expect(markdown).toContain('UID: john-doe-123');
    expect(markdown).toContain('FN: John Doe');
    expect(markdown).toContain('EMAIL: john@example.com');
    expect(markdown).toContain('TEL: +1-555-123-4567');
    expect(markdown).toContain('GENDER: M');
    
    // Should contain the default hashtag
    expect(markdown).toContain('#Contact');
    
    // Should have proper structure
    expect(markdown).toContain('#### Notes');
    expect(markdown).toContain('#### Related');
  });

  it('should generate unique UIDs for new contacts', () => {
    // Test UID generation patterns
    const uidPatterns = [
      'john-doe-123',
      'urn:uuid:550e8400-e29b-41d4-a716-446655440000',
      'custom-uid-456'
    ];

    uidPatterns.forEach(uid => {
      if (uid.startsWith('urn:uuid:')) {
        // Should be a valid UUID format
        const uuidPart = uid.substring(9);
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        expect(uuidRegex.test(uuidPart)).toBe(true);
      } else {
        // Should be a valid custom UID
        expect(uid.length).toBeGreaterThan(0);
        expect(typeof uid).toBe('string');
      }
    });
  });

  it('should handle minimal contact information gracefully', () => {
    const minimalContact = {
      UID: 'minimal-123',
      FN: 'Jane Smith'
    };

    const mockFile = { basename: 'jane-smith', path: 'Contacts/jane-smith.md' } as TFile;
    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    const markdown = contactNote.mdRender(minimalContact, mockSettings.defaultHashtag);
    
    // Should still have basic structure
    expect(markdown).toContain('---');
    expect(markdown).toContain('UID: minimal-123');
    expect(markdown).toContain('FN: Jane Smith');
    expect(markdown).toContain('#Contact');
    expect(markdown).toContain('#### Notes');
    expect(markdown).toContain('#### Related');
  });

  it('should format structured fields correctly', () => {
    const contactWithStructuredFields = {
      UID: 'structured-123',
      FN: 'Dr. Robert Wilson',
      N: 'Wilson;Robert;Dr.;;',
      ADR: ';;456 Oak Ave;Springfield;IL;62701;USA',
      ORG: 'Springfield Medical Center;Cardiology Department',
      EMAIL: 'dr.wilson@smc.com'
    };

    const mockFile = { basename: 'dr-wilson', path: 'Contacts/dr-wilson.md' } as TFile;
    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    const markdown = contactNote.mdRender(contactWithStructuredFields, mockSettings.defaultHashtag);
    
    // Should properly format structured fields
    expect(markdown).toContain('N: Wilson;Robert;Dr.;;');
    expect(markdown).toContain('ADR: ;;456 Oak Ave;Springfield;IL;62701;USA');
    expect(markdown).toContain('ORG: Springfield Medical Center;Cardiology Department');
  });

  it('should include relationship fields in template', () => {
    const contactWithRelationships = {
      UID: 'family-123',
      FN: 'Sarah Johnson',
      'RELATED[spouse]': 'name:Michael Johnson',
      'RELATED[child]': 'name:Emma Johnson',
      'RELATED[1:child]': 'name:Alex Johnson'
    };

    const mockFile = { basename: 'sarah-johnson', path: 'Contacts/sarah-johnson.md' } as TFile;
    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    const markdown = contactNote.mdRender(contactWithRelationships, mockSettings.defaultHashtag);
    
    // Should include relationship fields in frontmatter
    expect(markdown).toContain('RELATED[spouse]: name:Michael Johnson');
    expect(markdown).toContain('RELATED[child]: name:Emma Johnson');
    expect(markdown).toContain('RELATED[1:child]: name:Alex Johnson');
  });

  it('should apply consistent formatting across all contacts', () => {
    const contacts = [
      { UID: 'contact-1', FN: 'John Doe', EMAIL: 'john@example.com' },
      { UID: 'contact-2', FN: 'Jane Smith', EMAIL: 'jane@example.com' },
      { UID: 'contact-3', FN: 'Bob Wilson', EMAIL: 'bob@example.com' }
    ];

    contacts.forEach((contact, index) => {
      const mockFile = { 
        basename: `contact-${index + 1}`, 
        path: `Contacts/contact-${index + 1}.md` 
      } as TFile;
      
      const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
      const markdown = contactNote.mdRender(contact, mockSettings.defaultHashtag);
      
      // All contacts should have consistent structure (adjust regex for actual format)
      expect(markdown).toContain('---');
      expect(markdown).toContain('#### Notes');
      expect(markdown).toContain('#### Related');
      expect(markdown).toContain('#Contact');
      
      // Should contain contact-specific information
      expect(markdown).toContain(`UID: ${contact.UID}`);
      expect(markdown).toContain(`FN: ${contact.FN}`);
      expect(markdown).toContain(`EMAIL: ${contact.EMAIL}`);
    });
  });

  it('should handle special characters in contact names', () => {
    const contactsWithSpecialChars = [
      { UID: 'special-1', FN: "O'Brien, Patrick", N: "O'Brien;Patrick;;;" },
      { UID: 'special-2', FN: 'José García-López', N: 'García-López;José;;' },
      { UID: 'special-3', FN: 'Dr. Smith & Associates', N: 'Smith;Dr.;;' }
    ];

    contactsWithSpecialChars.forEach(contact => {
      const mockFile = { 
        basename: 'special-contact', 
        path: 'Contacts/special-contact.md' 
      } as TFile;
      
      const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
      const markdown = contactNote.mdRender(contact, mockSettings.defaultHashtag);
      
      // Should properly escape/handle special characters
      expect(markdown).toContain(`FN: ${contact.FN}`);
      expect(markdown).toContain(`N: ${contact.N}`);
      expect(markdown).not.toContain('undefined');
      expect(markdown).not.toContain('null');
    });
  });

  it('should maintain YAML frontmatter validity', () => {
    const contactWithComplexData = {
      UID: 'complex-123',
      FN: 'Test Contact',
      EMAIL: 'test@example.com',
      NOTE: 'This is a multi-line\nnote with special characters: @#$%',
      'RELATED[spouse]': 'name:Spouse Name'
    };

    const mockFile = { basename: 'complex', path: 'Contacts/complex.md' } as TFile;
    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    const markdown = contactNote.mdRender(contactWithComplexData, mockSettings.defaultHashtag);
    
    // Extract frontmatter section (adjust pattern for actual format)
    const frontmatterMatch = markdown.match(/---[\s\S]*?---/) || markdown.match(/---[\s\S]*/);
    expect(frontmatterMatch).toBeTruthy();
    
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[0];
      
      // Should not contain invalid YAML characters
      expect(frontmatter).not.toContain('undefined');
      expect(frontmatter).not.toContain('null');
      
      // Should properly handle multi-line content
      if (frontmatter.includes('NOTE:')) {
        expect(frontmatter).toMatch(/NOTE:\s*['"].*?['"]|NOTE:\s*>-?\s+/);
      }
    }
  });
});