import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { ContactNote } from '../../src/models/contactNote';
import { ContactsPluginSettings } from 'src/plugin/settings';

/**
 * User Story 34a: Contact Section Before Related Section
 * As a user, I expect the Contact section to always appear before the Related section 
 * in contact notes. This ensures a consistent document structure where contact 
 * information is presented before relationship information.
 */
describe('Contact Before Related Section Ordering Story', () => {
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

  it('should add Contact section before existing Related section', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Initial content with only Related section
    const initialContent = `---
UID: john-doe-123
FN: John Doe
EMAIL[HOME]: john@home.com
---

#### Related
- friend [[Jane Doe]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(initialContent);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL[HOME]': 'john@home.com'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const contactSection = await contactNote.generateContactSection();
    
    // Add Contact section
    await contactNote.updateContactSectionInContent(contactSection);
    
    // Get the updated content
    const modifyCall = mockApp.vault!.modify as any;
    expect(modifyCall).toHaveBeenCalled();
    const updatedContent = modifyCall.mock.calls[0][1];
    
    // Verify Contact appears before Related
    const contactIndex = updatedContent.indexOf('## Contact');
    const relatedIndex = updatedContent.indexOf('#### Related');
    
    expect(contactIndex).toBeGreaterThan(-1); // Contact exists
    expect(relatedIndex).toBeGreaterThan(-1); // Related exists
    expect(contactIndex).toBeLessThan(relatedIndex); // Contact before Related
  });

  it('should add Related section after existing Contact section', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Initial content with only Contact section
    const initialContent = `---
UID: john-doe-123
FN: John Doe
EMAIL[HOME]: john@home.com
RELATED[friend]: urn:uuid:jane-doe-456
---

## Contact

📧 Email
- Home: john@home.com

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(initialContent);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL[HOME]': 'john@home.com',
        'RELATED[friend]': 'urn:uuid:jane-doe-456'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Mock finding Jane Doe contact for relationship resolution
    mockApp.vault!.getMarkdownFiles = vi.fn().mockReturnValue([
      { basename: 'jane-doe', path: 'Contacts/jane-doe.md' } as TFile
    ]);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'jane-doe-456',
        FN: 'Jane Doe'
      }
    });
    
    // Add Related section
    await contactNote.updateRelatedSectionInContent([{ type: 'friend', contactName: 'Jane Doe' }]);
    
    // Get the updated content
    const modifyCall = mockApp.vault!.modify as any;
    expect(modifyCall).toHaveBeenCalled();
    const updatedContent = modifyCall.mock.calls[0][1];
    
    // Verify Contact appears before Related
    const contactIndex = updatedContent.indexOf('## Contact');
    const relatedIndex = updatedContent.indexOf('#### Related');
    
    expect(contactIndex).toBeGreaterThan(-1); // Contact exists
    expect(relatedIndex).toBeGreaterThan(-1); // Related exists
    expect(contactIndex).toBeLessThan(relatedIndex); // Contact before Related
  });

  it('should maintain Contact before Related when both sections exist', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Content with both sections in correct order
    const initialContent = `---
UID: john-doe-123
FN: John Doe
EMAIL[HOME]: john@home.com
EMAIL[WORK]: john@work.com
---

## Contact

📧 Email
- Home: john@home.com

#### Related
- friend [[Jane Doe]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(initialContent);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL[HOME]': 'john@home.com',
        'EMAIL[WORK]': 'john@work.com'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const contactSection = await contactNote.generateContactSection();
    
    // Update Contact section (adding work email)
    await contactNote.updateContactSectionInContent(contactSection);
    
    // Get the updated content
    const modifyCall = mockApp.vault!.modify as any;
    expect(modifyCall).toHaveBeenCalled();
    const updatedContent = modifyCall.mock.calls[0][1];
    
    // Verify Contact still appears before Related
    const contactIndex = updatedContent.indexOf('## Contact');
    const relatedIndex = updatedContent.indexOf('#### Related');
    
    expect(contactIndex).toBeGreaterThan(-1); // Contact exists
    expect(relatedIndex).toBeGreaterThan(-1); // Related exists
    expect(contactIndex).toBeLessThan(relatedIndex); // Contact before Related
    expect(updatedContent).toContain('john@work.com'); // Work email was added
  });

  it('should place both sections before hashtags', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Content without sections but with hashtags
    const initialContent = `---
UID: john-doe-123
FN: John Doe
EMAIL[HOME]: john@home.com
---

Some notes here.

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(initialContent);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL[HOME]': 'john@home.com'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const contactSection = await contactNote.generateContactSection();
    
    // Add Contact section
    await contactNote.updateContactSectionInContent(contactSection);
    
    // Get the updated content after adding Contact
    const modifyCall1 = mockApp.vault!.modify as any;
    const contentAfterContact = modifyCall1.mock.calls[0][1];
    
    // Update mock to return content with Contact section
    mockApp.vault!.read = vi.fn().mockResolvedValue(contentAfterContact);
    
    // Add Related section
    await contactNote.updateRelatedSectionInContent([{ type: 'friend', contactName: 'Jane Doe' }]);
    
    // Get the final updated content
    const modifyCall2 = mockApp.vault!.modify as any;
    const finalContent = modifyCall2.mock.calls[modifyCall2.mock.calls.length - 1][1];
    
    // Verify ordering: Contact before Related before hashtags
    const contactIndex = finalContent.indexOf('## Contact');
    const relatedIndex = finalContent.indexOf('#### Related');
    const hashtagIndex = finalContent.indexOf('#Contact');
    
    expect(contactIndex).toBeGreaterThan(-1);
    expect(relatedIndex).toBeGreaterThan(-1);
    expect(hashtagIndex).toBeGreaterThan(-1);
    expect(contactIndex).toBeLessThan(relatedIndex);
    expect(relatedIndex).toBeLessThan(hashtagIndex);
  });

  it('should handle missing Contact section when updating Related', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Content with no sections
    const initialContent = `---
UID: john-doe-123
FN: John Doe
---

Notes here.

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(initialContent);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Add Related section when no Contact exists
    await contactNote.updateRelatedSectionInContent([{ type: 'friend', contactName: 'Jane Doe' }]);
    
    // Get the updated content
    const modifyCall = mockApp.vault!.modify as any;
    expect(modifyCall).toHaveBeenCalled();
    const updatedContent = modifyCall.mock.calls[0][1];
    
    // Verify Related section was added
    expect(updatedContent).toContain('#### Related');
    expect(updatedContent).toContain('friend [[Jane Doe]]');
    
    // Verify it's before hashtags
    const relatedIndex = updatedContent.indexOf('#### Related');
    const hashtagIndex = updatedContent.indexOf('#Contact');
    expect(relatedIndex).toBeLessThan(hashtagIndex);
  });

  it('should handle missing Related section when updating Contact', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Content with no sections
    const initialContent = `---
UID: john-doe-123
FN: John Doe
EMAIL[HOME]: john@home.com
---

Notes here.

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(initialContent);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL[HOME]': 'john@home.com'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const contactSection = await contactNote.generateContactSection();
    
    // Add Contact section when no Related exists
    await contactNote.updateContactSectionInContent(contactSection);
    
    // Get the updated content
    const modifyCall = mockApp.vault!.modify as any;
    expect(modifyCall).toHaveBeenCalled();
    const updatedContent = modifyCall.mock.calls[0][1];
    
    // Verify Contact section was added
    expect(updatedContent).toContain('## Contact');
    expect(updatedContent).toContain('john@home.com');
    
    // Verify it's before hashtags
    const contactIndex = updatedContent.indexOf('## Contact');
    const hashtagIndex = updatedContent.indexOf('#Contact');
    expect(contactIndex).toBeLessThan(hashtagIndex);
  });

  it('should fix ordering when Contact exists after Related by moving Contact before Related', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Content with Contact AFTER Related (wrong order)
    const initialContent = `---
UID: john-doe-123
FN: John Doe
EMAIL[HOME]: john@home.com
EMAIL[WORK]: john@work.com
---

#### Related
- friend [[Jane Doe]]

## Contact

📧 Email
- Home: john@home.com

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(initialContent);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL[HOME]': 'john@home.com',
        'EMAIL[WORK]': 'john@work.com'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const contactSection = await contactNote.generateContactSection();
    
    // Update Contact section - should detect wrong order and fix it
    await contactNote.updateContactSectionInContent(contactSection);
    
    // Get the updated content
    const modifyCall = mockApp.vault!.modify as any;
    expect(modifyCall).toHaveBeenCalled();
    const updatedContent = modifyCall.mock.calls[0][1];
    
    // Verify Contact now appears before Related
    const contactIndex = updatedContent.indexOf('## Contact');
    const relatedIndex = updatedContent.indexOf('#### Related');
    
    expect(contactIndex).toBeGreaterThan(-1); // Contact exists
    expect(relatedIndex).toBeGreaterThan(-1); // Related exists
    expect(contactIndex).toBeLessThan(relatedIndex); // Contact before Related (fixed!)
    expect(updatedContent).toContain('john@work.com'); // Work email was added
  });

  it('should fix ordering when updating Related and Contact is after Related', async () => {
    const mockFile = { basename: 'john-doe', path: 'Contacts/john-doe.md' } as TFile;
    
    // Content with Contact AFTER Related (wrong order)
    const initialContent = `---
UID: john-doe-123
FN: John Doe
EMAIL[HOME]: john@home.com
---

#### Related
- friend [[Jane Doe]]

## Contact

📧 Email
- Home: john@home.com

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(initialContent);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'john-doe-123',
        FN: 'John Doe',
        'EMAIL[HOME]': 'john@home.com'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Update Related section - should detect wrong order and fix it
    await contactNote.updateRelatedSectionInContent([
      { type: 'friend', contactName: 'Jane Doe' },
      { type: 'colleague', contactName: 'Bob Smith' }
    ]);
    
    // Get the updated content
    const modifyCall = mockApp.vault!.modify as any;
    expect(modifyCall).toHaveBeenCalled();
    const updatedContent = modifyCall.mock.calls[0][1];
    
    // Verify Contact now appears before Related
    const contactIndex = updatedContent.indexOf('## Contact');
    const relatedIndex = updatedContent.indexOf('#### Related');
    
    expect(contactIndex).toBeGreaterThan(-1); // Contact exists
    expect(relatedIndex).toBeGreaterThan(-1); // Related exists
    expect(contactIndex).toBeLessThan(relatedIndex); // Contact before Related (fixed!)
    expect(updatedContent).toContain('colleague [[Bob Smith]]'); // New relationship was added
  });
});
