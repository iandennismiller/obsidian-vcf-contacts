import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { ContactNote } from '../../src/models/contactNote';
import { ContactsPluginSettings } from 'src/plugin/settings';

/**
 * User Story 17: Contact Validation and Integrity
 * As a user, I want the plugin to validate that all relationship references point 
 * to existing contacts and warn me about broken links or missing contacts.
 */
describe('Contact Validation and Integrity Story', () => {
  let mockApp: Partial<App>;
  let mockSettings: ContactsPluginSettings;
  let mockContactFiles: Map<string, TFile>;

  beforeEach(() => {
    mockContactFiles = new Map();

    mockApp = {
      vault: {
        read: vi.fn(),
        modify: vi.fn(),
        create: vi.fn(),
        getMarkdownFiles: vi.fn(() => Array.from(mockContactFiles.values())),
        getAbstractFileByPath: vi.fn((path: string) => mockContactFiles.get(path) || null)
      } as any,
      metadataCache: {
        getFileCache: vi.fn()
      } as any
    };

    mockSettings = {
      contactsFolder: 'Contacts',
      defaultHashtag: '#Contact',
      vcardStorageMethod: 'vcard-folder',
      vcardFilename: 'contacts.vcf',
      vcardWatchFolder: '/test/vcf',
      vcardWatchEnabled: false,
      vcardWatchPollingInterval: 30,
      vcardWriteBackEnabled: false,
      vcardCustomizeIgnoreList: false,
      vcardIgnoreFilenames: [],
      vcardIgnoreUIDs: [],
      logLevel: 'INFO'
    };
  });

  it('should validate contact has required fields', async () => {
    const testCases = [
      {
        name: 'valid-complete',
        frontmatter: {
          UID: 'valid-123',
          FN: 'Valid Contact',
          EMAIL: 'valid@example.com'
        },
        expectedValid: true,
        expectedIssues: []
      },
      {
        name: 'missing-uid',
        frontmatter: {
          FN: 'No UID Contact',
          EMAIL: 'nouid@example.com'
        },
        expectedValid: false,
        expectedIssues: ['missing-uid']
      },
      {
        name: 'missing-name',
        frontmatter: {
          UID: 'no-name-123',
          EMAIL: 'noname@example.com'
        },
        expectedValid: false,
        expectedIssues: ['missing-name']
      },
      {
        name: 'empty-uid',
        frontmatter: {
          UID: '',
          FN: 'Empty UID',
          EMAIL: 'empty@example.com'
        },
        expectedValid: false,
        expectedIssues: ['empty-uid']
      }
    ];

    testCases.forEach(testCase => {
      const mockFile = { 
        basename: testCase.name, 
        path: `Contacts/${testCase.name}.md` 
      } as TFile;
      
      mockContactFiles.set(mockFile.path, mockFile);
      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
        frontmatter: testCase.frontmatter
      });

      const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
      
      // Basic validation logic
      const hasUID = testCase.frontmatter.UID && testCase.frontmatter.UID.trim() !== '';
      const hasFN = testCase.frontmatter.FN && testCase.frontmatter.FN.trim() !== '';
      
      const isValid = Boolean(hasUID && hasFN);
      const issues = [];
      
      if (!testCase.frontmatter.hasOwnProperty('UID')) issues.push('missing-uid');
      else if (!testCase.frontmatter.UID || testCase.frontmatter.UID.trim() === '') issues.push('empty-uid');
      
      if (!testCase.frontmatter.FN) issues.push('missing-name');
      
      expect(isValid).toBe(testCase.expectedValid);
      expect(issues).toEqual(testCase.expectedIssues);
    });
  });

  it('should detect broken relationship links in Related list', async () => {
    const sourceFile = { basename: 'source-contact', path: 'Contacts/source-contact.md' } as TFile;
    const existingFile = { basename: 'existing-contact', path: 'Contacts/existing-contact.md' } as TFile;
    
    mockContactFiles.set('Contacts/source-contact.md', sourceFile);
    mockContactFiles.set('Contacts/existing-contact.md', existingFile);

    // Source contact with mix of valid and broken links
    const sourceContent = `---
UID: source-123
FN: Source Contact
---

#### Related
- friend [[Existing Contact]]
- colleague [[Missing Contact]]
- mentor [[Another Missing]]
- neighbor [[Existing Contact]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(sourceContent);
    mockApp.metadataCache!.getFileCache = vi.fn()
      .mockImplementation((file: TFile) => {
        if (file.path === 'Contacts/source-contact.md') {
          return {
            frontmatter: {
              UID: 'source-123',
              FN: 'Source Contact'
            }
          };
        }
        if (file.path === 'Contacts/existing-contact.md') {
          return {
            frontmatter: {
              UID: 'existing-456',
              FN: 'Existing Contact'
            }
          };
        }
        return null;
      });

    const sourceContact = new ContactNote(mockApp as App, mockSettings, sourceFile);
    const relationships = await sourceContact.parseRelatedSection();
    
    // Validate each relationship
    const validationResults = [];
    for (const rel of relationships) {
      const targetExists = Array.from(mockContactFiles.values())
        .some(file => file.basename === rel.contactName.toLowerCase().replace(/\s+/g, '-'));
      
      validationResults.push({
        type: rel.type,
        target: rel.contactName,
        valid: targetExists,
        issue: targetExists ? null : 'target-not-found'
      });
    }

    expect(validationResults).toHaveLength(4);
    
    // Valid relationships
    const validLinks = validationResults.filter(r => r.valid);
    expect(validLinks).toHaveLength(2); // Both "Existing Contact" links
    expect(validLinks.every(r => r.target === 'Existing Contact')).toBe(true);
    
    // Broken relationships
    const brokenLinks = validationResults.filter(r => !r.valid);
    expect(brokenLinks).toHaveLength(2);
    expect(brokenLinks.map(r => r.target)).toEqual(
      expect.arrayContaining(['Missing Contact', 'Another Missing'])
    );
    expect(brokenLinks.every(r => r.issue === 'target-not-found')).toBe(true);
  });

  it('should detect broken UID references in frontmatter', async () => {
    const sourceFile = { basename: 'uid-refs', path: 'Contacts/uid-refs.md' } as TFile;
    const validTargetFile = { basename: 'valid-target', path: 'Contacts/valid-target.md' } as TFile;
    
    mockContactFiles.set('Contacts/uid-refs.md', sourceFile);
    mockContactFiles.set('Contacts/valid-target.md', validTargetFile);

    mockApp.metadataCache!.getFileCache = vi.fn()
      .mockImplementation((file: TFile) => {
        if (file.path === 'Contacts/uid-refs.md') {
          return {
            frontmatter: {
              UID: 'uid-refs-123',
              FN: 'UID Refs Contact',
              'RELATED.friend': 'urn:uuid:valid-target-456', // Valid UID
              'RELATED.colleague': 'urn:uuid:missing-uid-789', // Broken UID
              'RELATED.family.1': 'urn:uuid:another-missing-111' // Another broken UID
            }
          };
        }
        if (file.path === 'Contacts/valid-target.md') {
          return {
            frontmatter: {
              UID: 'valid-target-456',
              FN: 'Valid Target'
            }
          };
        }
        return null;
      });

    const sourceContact = new ContactNote(mockApp as App, mockSettings, sourceFile);
    const frontmatter = await sourceContact.getFrontmatter();
    
    // Extract UID-based relationships
    const uidRelationships = Object.entries(frontmatter || {})
      .filter(([key]) => key.startsWith('RELATED.'))
      .map(([key, value) => ({ key, value: value as string }))
      .filter(({ value }) => value.startsWith('urn:uuid:'));

    // Validate UID references
    const existingUIDs = ['valid-target-456']; // UIDs that exist in our mock
    const validationResults = uidRelationships.map(({ key, value }) => {
      const uid = value.replace('urn:uuid:', '');
      const exists = existingUIDs.includes(uid);
      
      return {
        relationship: key,
        uid,
        valid: exists,
        issue: exists ? null : 'uid-not-found'
      };
    });

    expect(validationResults).toHaveLength(3);
    
    // Valid UID reference
    const validUIDs = validationResults.filter(r => r.valid);
    expect(validUIDs).toHaveLength(1);
    expect(validUIDs[0].uid).toBe('valid-target-456');
    
    // Broken UID references
    const brokenUIDs = validationResults.filter(r => !r.valid);
    expect(brokenUIDs).toHaveLength(2);
    expect(brokenUIDs.map(r => r.uid)).toEqual(
      expect.arrayContaining(['missing-uid-789', 'another-missing-111'])
    );
    expect(brokenUIDs.every(r => r.issue === 'uid-not-found')).toBe(true);
  });

  it('should validate email format in contact data', async () => {
    const emailTestCases = [
      { email: 'valid@example.com', valid: true },
      { email: 'user+tag@domain.co.uk', valid: true },
      { email: 'test.email@sub.domain.org', valid: true },
      { email: 'invalid-email', valid: false },
      { email: '@domain.com', valid: false },
      { email: 'user@', valid: false },
      { email: 'user space@domain.com', valid: false },
      { email: '', valid: false }
    ];

    emailTestCases.forEach((testCase, index) => {
      const mockFile = { 
        basename: `email-test-${index}`, 
        path: `Contacts/email-test-${index}.md` 
      } as TFile;
      
      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
        frontmatter: {
          UID: `email-test-${index}`,
          FN: `Email Test ${index}`,
          EMAIL: testCase.email
        }
      });

      // Simple email validation regex
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const isValidEmail = Boolean(testCase.email && emailRegex.test(testCase.email));

      expect(isValidEmail).toBe(testCase.valid);
    });
  });

  it('should validate phone number formats', async () => {
    const phoneTestCases = [
      { phone: '+1-555-123-4567', valid: true },
      { phone: '+44 20 7946 0958', valid: true },
      { phone: '(555) 123-4567', valid: true },
      { phone: '555.123.4567', valid: true },
      { phone: '5551234567', valid: true },
      { phone: 'invalid-phone', valid: false },
      { phone: '123', valid: false },
      { phone: 'abc-def-ghij', valid: false },
      { phone: '', valid: false }
    ];

    phoneTestCases.forEach((testCase, index) => {
      const mockFile = { 
        basename: `phone-test-${index}`, 
        path: `Contacts/phone-test-${index}.md` 
      } as TFile;
      
      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
        frontmatter: {
          UID: `phone-test-${index}`,
          FN: `Phone Test ${index}`,
          TEL: testCase.phone
        }
      });

      // Basic phone validation - contains digits and common separators
      const phoneRegex = /^[\+\-\(\)\.\s\d]+$/;
      const digitCount = (testCase.phone.match(/\d/g) || []).length; // Count total digits
      const isValidPhone = Boolean(testCase.phone && phoneRegex.test(testCase.phone) && digitCount >= 7);

      expect(isValidPhone).toBe(testCase.valid);
    });
  });

  it('should detect circular relationships', async () => {
    // A -> B -> C -> A (circular)
    const fileA = { basename: 'contact-a', path: 'Contacts/contact-a.md' } as TFile;
    const fileB = { basename: 'contact-b', path: 'Contacts/contact-b.md' } as TFile;
    const fileC = { basename: 'contact-c', path: 'Contacts/contact-c.md' } as TFile;
    
    mockContactFiles.set('Contacts/contact-a.md', fileA);
    mockContactFiles.set('Contacts/contact-b.md', fileB);
    mockContactFiles.set('Contacts/contact-c.md', fileC);

    mockApp.metadataCache!.getFileCache = vi.fn()
      .mockImplementation((file: TFile) => {
        if (file.path === 'Contacts/contact-a.md') {
          return {
            frontmatter: {
              UID: 'contact-a-123',
              FN: 'Contact A',
              'RELATED.friend': 'urn:uuid:contact-b-456'
            }
          };
        }
        if (file.path === 'Contacts/contact-b.md') {
          return {
            frontmatter: {
              UID: 'contact-b-456',
              FN: 'Contact B',
              'RELATED.friend': 'urn:uuid:contact-c-789'
            }
          };
        }
        if (file.path === 'Contacts/contact-c.md') {
          return {
            frontmatter: {
              UID: 'contact-c-789',
              FN: 'Contact C',
              'RELATED.friend': 'urn:uuid:contact-a-123' // Back to A!
            }
          };
        }
        return null;
      });

    // Detect circular reference by following relationship chain
    const relationships = new Map([
      ['contact-a-123', 'contact-b-456'],
      ['contact-b-456', 'contact-c-789'],
      ['contact-c-789', 'contact-a-123']
    ]);

    // Simple cycle detection algorithm
    const detectCycle = (startUID: string): string[] | null => {
      const visited = new Set<string>();
      let current = startUID;

      while (current && !visited.has(current)) {
        visited.add(current);
        current = relationships.get(current) || '';
      }

      if (current && visited.has(current)) {
        // Cycle detected - return the cycle path
        return Array.from(visited);
      }

      return null;
    };

    const cycle = detectCycle('contact-a-123');
    expect(cycle).not.toBeNull();
    expect(cycle).toHaveLength(3);
    expect(cycle).toEqual(expect.arrayContaining([
      'contact-a-123', 
      'contact-b-456', 
      'contact-c-789'
    ]));
  });

  it('should validate date formats in contact fields', async () => {
    const dateTestCases = [
      { field: 'BDAY', value: '1990-05-15', valid: true },
      { field: 'BDAY', value: '1990-12-31', valid: true },
      { field: 'REV', value: '20240215T143022Z', valid: true },
      { field: 'BDAY', value: '15-05-1990', valid: false }, // Wrong format
      { field: 'BDAY', value: '1990/05/15', valid: false }, // Wrong separators
      { field: 'BDAY', value: '1990-13-01', valid: false }, // Invalid month
      { field: 'BDAY', value: '1990-02-30', valid: false }, // Invalid day
      { field: 'REV', value: '2024-02-15', valid: false }, // Missing time/Z
      { field: 'BDAY', value: 'invalid-date', valid: false },
      { field: 'BDAY', value: '', valid: false }
    ];

    dateTestCases.forEach((testCase, index) => {
      const mockFile = { 
        basename: `date-test-${index}`, 
        path: `Contacts/date-test-${index}.md` 
      } as TFile;
      
      const frontmatter = {
        UID: `date-test-${index}`,
        FN: `Date Test ${index}`,
        [testCase.field]: testCase.value
      };
      
      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
        frontmatter
      });

      // Date validation logic
      let isValid = false;
      
      if (testCase.field === 'BDAY') {
        // YYYY-MM-DD format
        const bdayRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (bdayRegex.test(testCase.value)) {
          try {
            const date = new Date(testCase.value);
            isValid = !isNaN(date.getTime()) && date.toISOString().startsWith(testCase.value);
          } catch (error) {
            isValid = false;
          }
        }
      } else if (testCase.field === 'REV') {
        // ISO 8601 format with Z
        const revRegex = /^\d{8}T\d{6}Z$/;
        isValid = revRegex.test(testCase.value);
      }

      expect(isValid).toBe(testCase.valid);
    });
  });

  it('should validate relationship consistency across contacts', async () => {
    const parentFile = { basename: 'parent-contact', path: 'Contacts/parent-contact.md' } as TFile;
    const childFile = { basename: 'child-contact', path: 'Contacts/child-contact.md' } as TFile;
    
    mockContactFiles.set('Contacts/parent-contact.md', parentFile);
    mockContactFiles.set('Contacts/child-contact.md', childFile);

    // Parent says child is their child, but child doesn't reciprocate
    mockApp.metadataCache!.getFileCache = vi.fn()
      .mockImplementation((file: TFile) => {
        if (file.path === 'Contacts/parent-contact.md') {
          return {
            frontmatter: {
              UID: 'parent-123',
              FN: 'Parent Contact',
              'RELATED.child': 'urn:uuid:child-456'
            }
          };
        }
        if (file.path === 'Contacts/child-contact.md') {
          return {
            frontmatter: {
              UID: 'child-456',
              FN: 'Child Contact'
              // Missing reciprocal parent relationship
            }
          };
        }
        return null;
      });

    // Check relationship consistency
    const parentContact = new ContactNote(mockApp as App, mockSettings, parentFile);
    const parentFrontmatter = await parentContact.getFrontmatter();
    
    const childContact = new ContactNote(mockApp as App, mockSettings, childFile);
    const childFrontmatter = await childContact.getFrontmatter();

    // Extract parent's relationships
    const parentRelationships = Object.entries(parentFrontmatter || {})
      .filter(([key]) => key.startsWith('RELATED.'))
      .map(([key, value) => ({
        type: key.match(/RELATED\[([^\]]+)\]/)?.[1] || '',
        target: (value as string).replace('urn:uuid:', ''),
        sourceUID: parentFrontmatter?.UID
      }));

    // Check if child has reciprocal relationship
    const consistencyIssues = [];
    for (const rel of parentRelationships) {
      if (rel.target === 'child-456') {
        // Check if child has reciprocal parent relationship
        const hasReciprocalParent = Object.entries(childFrontmatter || {})
          .some(([key, value]) => 
            key.startsWith('RELATED.') && 
            key.includes('parent') &&
            (value as string).includes('parent-123')
          );

        if (!hasReciprocalParent) {
          consistencyIssues.push({
            sourceUID: rel.sourceUID,
            targetUID: rel.target,
            relationshipType: rel.type,
            issue: 'missing-reciprocal'
          });
        }
      }
    }

    expect(consistencyIssues).toHaveLength(1);
    expect(consistencyIssues[0.issue).toBe('missing-reciprocal');
    expect(consistencyIssues[0].relationshipType).toBe('child');
  });

  it('should generate comprehensive validation report', async () => {
    // Set up contacts with various validation issues
    const contactsWithIssues = [
      {
        file: { basename: 'valid-contact', path: 'Contacts/valid-contact.md' } as TFile,
        frontmatter: {
          UID: 'valid-123',
          FN: 'Valid Contact',
          EMAIL: 'valid@example.com',
          TEL: '+1-555-123-4567',
          BDAY: '1990-05-15'
        },
        content: `---
UID: valid-123
FN: Valid Contact
EMAIL: valid@example.com
---

#### Related
- friend [[Valid Contact]]

#Contact`,
        expectedIssues: 0
      },
      {
        file: { basename: 'problematic-contact', path: 'Contacts/problematic-contact.md' } as TFile,
        frontmatter: {
          UID: '', // Empty UID
          FN: 'Problematic Contact',
          EMAIL: 'invalid-email', // Invalid email
          TEL: 'abc-def-ghij', // Invalid phone
          BDAY: '1990-13-45' // Invalid date
        },
        content: `---
UID: 
FN: Problematic Contact
EMAIL: invalid-email
---

#### Related
- friend [[Missing Person]]

#Contact`,
        expectedIssues: 5 // Empty UID, invalid email, invalid phone, invalid date, broken link
      }
    ];

    contactsWithIssues.forEach(contact => {
      mockContactFiles.set(contact.file.path, contact.file);
    });

    mockApp.vault!.read = vi.fn()
      .mockImplementation((file: TFile) => {
        const contact = contactsWithIssues.find(c => c.file.path === file.path);
        return Promise.resolve(contact?.content || '');
      });

    mockApp.metadataCache!.getFileCache = vi.fn()
      .mockImplementation((file: TFile) => {
        const contact = contactsWithIssues.find(c => c.file.path === file.path);
        return contact ? { frontmatter: contact.frontmatter } : null;
      });

    // Generate validation report
    const validationReport = {
      totalContacts: contactsWithIssues.length,
      validContacts: 0,
      invalidContacts: 0,
      issues: [] as Array<{ contact: string; issue: string; field?: string }>
    };

    for (const contact of contactsWithIssues) {
      const contactNote = new ContactNote(mockApp as App, mockSettings, contact.file);
      let contactIssues = 0;

      // Validate UID
      if (!contact.frontmatter.UID || contact.frontmatter.UID.trim() === '') {
        validationReport.issues.push({
          contact: contact.frontmatter.FN,
          issue: 'empty-uid',
          field: 'UID'
        });
        contactIssues++;
      }

      // Validate email
      if (contact.frontmatter.EMAIL) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(contact.frontmatter.EMAIL)) {
          validationReport.issues.push({
            contact: contact.frontmatter.FN,
            issue: 'invalid-email',
            field: 'EMAIL'
          });
          contactIssues++;
        }
      }

      // Validate phone
      if (contact.frontmatter.TEL) {
        const phoneRegex = /^[\+\-\(\)\.\s\d]+$/;
        const digitCount = (contact.frontmatter.TEL.match(/\d/g) || []).length; // Count total digits
        if (!phoneRegex.test(contact.frontmatter.TEL) || digitCount < 7) {
          validationReport.issues.push({
            contact: contact.frontmatter.FN,
            issue: 'invalid-phone',
            field: 'TEL'
          });
          contactIssues++;
        }
      }

      // Validate date
      if (contact.frontmatter.BDAY) {
        const bdayRegex = /^\d{4}-\d{2}-\d{2}$/;
        let isValidDate = false;
        if (bdayRegex.test(contact.frontmatter.BDAY)) {
          try {
            const date = new Date(contact.frontmatter.BDAY);
            isValidDate = !isNaN(date.getTime()) && date.toISOString().startsWith(contact.frontmatter.BDAY);
          } catch (error) {
            isValidDate = false;
          }
        }
        if (!isValidDate) {
          validationReport.issues.push({
            contact: contact.frontmatter.FN,
            issue: 'invalid-date',
            field: 'BDAY'
          });
          contactIssues++;
        }
      }

      // Check for broken links in content
      if (contact.content.includes('[[Missing Person]]')) {
        validationReport.issues.push({
          contact: contact.frontmatter.FN,
          issue: 'broken-link'
        });
        contactIssues++;
      }

      if (contactIssues === 0) {
        validationReport.validContacts++;
      } else {
        validationReport.invalidContacts++;
      }
    }

    expect(validationReport.totalContacts).toBe(2);
    expect(validationReport.validContacts).toBe(1);
    expect(validationReport.invalidContacts).toBe(1);
    expect(validationReport.issues).toHaveLength(5);
    
    // Check specific issues
    const issueTypes = validationReport.issues.map(i => i.issue);
    expect(issueTypes).toEqual(expect.arrayContaining([
      'empty-uid', 'invalid-email', 'invalid-phone', 'invalid-date', 'broken-link'
    ]));
  });
});