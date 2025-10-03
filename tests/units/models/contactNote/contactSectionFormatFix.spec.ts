import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { ContactSectionOperations } from '../../../../src/models/contactNote/contactSectionOperations';
import { ContactData } from '../../../../src/models/contactNote/contactData';

/**
 * Test to validate the Contact section formatting fix
 * Issue: Fields should not show numeric index, should be title case, and only show first field
 */
describe('Contact Section Format Fix', () => {
  let mockApp: Partial<App>;
  let mockFile: TFile;
  let contactData: ContactData;
  let ops: ContactSectionOperations;

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

    contactData = new ContactData(mockApp as App, mockFile);
    ops = new ContactSectionOperations(contactData);
  });

  it('should format labels in title case without numeric index', async () => {
    const content = `---
UID: test-123
FN: Test Contact
TEL[1:WORK]: 555-555-5555
TEL[2:WORK]: 555-555-5556
---

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'test-123',
        FN: 'Test Contact',
        'TEL[1:WORK]': '555-555-5555',
        'TEL[2:WORK]': '555-555-5556'
      }
    });

    const section = await ops.generateContactSection();

    // Should show title case, no index, no colon after label
    expect(section).toContain('Work 555-555-5555');
    expect(section).not.toContain('1:WORK');
    expect(section).not.toContain('WORK:');
    
    // Should only show first field
    expect(section).not.toContain('555-555-5556');
  });

  it('should format regular labels in title case', async () => {
    const content = `---
UID: test-123
FN: Test Contact
EMAIL[HOME]: john@home.com
EMAIL[WORK]: john@work.com
TEL[CELL]: +1-555-1234
---

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'test-123',
        FN: 'Test Contact',
        'EMAIL[HOME]': 'john@home.com',
        'EMAIL[WORK]': 'john@work.com',
        'TEL[CELL]': '+1-555-1234'
      }
    });

    const section = await ops.generateContactSection();

    // Should show title case labels
    expect(section).toContain('Home john@home.com');
    expect(section).toContain('Cell +1-555-1234');
    
    // Should not show uppercase
    expect(section).not.toContain('HOME');
    expect(section).not.toContain('CELL');
    
    // Should not show colon after label
    expect(section).not.toContain('Home:');
    expect(section).not.toContain('Cell:');
    
    // Should only show first email
    expect(section).not.toContain('john@work.com');
  });
});
