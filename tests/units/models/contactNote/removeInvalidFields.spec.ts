/**
 * Tests for removing invalid frontmatter fields functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContactNote } from 'src/models/contactNote';
import { App, TFile } from 'obsidian';
import { ContactsPluginSettings } from 'src/plugin/settings';

describe('ContactNote - Remove Invalid Fields', () => {
  let mockApp: Partial<App>;
  let mockSettings: ContactsPluginSettings;
  let mockFile: TFile;

  beforeEach(() => {
    vi.clearAllMocks();

    mockFile = {
      path: 'contacts/test.md',
      name: 'test.md',
      basename: 'test',
      extension: 'md',
    } as TFile;

    mockSettings = {
      contactsFolder: 'contacts',
    } as ContactsPluginSettings;
  });

  const createMockApp = (content: string, modifyMock?: any) => {
    return {
      vault: {
        read: vi.fn().mockResolvedValue(content),
        modify: modifyMock || vi.fn(),
      } as any,
      metadataCache: {
        getFileCache: vi.fn().mockReturnValue(null),
      } as any,
    };
  };

  describe('removeInvalidFrontmatterFields', () => {
    it('should remove invalid email fields', async () => {
      const content = `---
UID: test-123
FN: Test Contact
EMAIL[HOME]: not-an-email
EMAIL[WORK]: valid@example.com
---
## Notes
Test contact`;

      mockApp = createMockApp(content);
      const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
      const result = await contactNote.removeInvalidFrontmatterFields();

      expect(result.removed).toContain('EMAIL[HOME]');
      expect(result.removed).not.toContain('EMAIL[WORK]');
      expect(result.errors).toHaveLength(0);
      expect(mockApp.vault!.modify).toHaveBeenCalled();
    });

    it('should remove invalid phone number fields', async () => {
      const content = `---
UID: test-456
FN: Test Contact
TEL[HOME]: no-digits-here
TEL[CELL]: +1-555-555-5555
---
## Notes
Test contact`;

      mockApp = createMockApp(content);
      const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
      const result = await contactNote.removeInvalidFrontmatterFields();

      expect(result.removed).toContain('TEL[HOME]');
      expect(result.removed).not.toContain('TEL[CELL]');
      expect(result.errors).toHaveLength(0);
    });

    it('should remove invalid URL fields', async () => {
      const content = `---
UID: test-789
FN: Test Contact
URL[HOME]: not-a-url
URL[WORK]: https://example.com
---
## Notes
Test contact`;

      mockApp = createMockApp(content);
      const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
      const result = await contactNote.removeInvalidFrontmatterFields();

      expect(result.removed).toContain('URL[HOME]');
      expect(result.removed).not.toContain('URL[WORK]');
      expect(result.errors).toHaveLength(0);
    });

    it('should remove invalid date fields', async () => {
      const content = `---
UID: test-999
FN: Test Contact
BDAY: not-a-date
ANNIVERSARY: invalid-date-too
REV: 2024-01-01
---
## Notes
Test contact`;

      mockApp = createMockApp(content);
      const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
      const result = await contactNote.removeInvalidFrontmatterFields();

      expect(result.removed).toContain('BDAY');
      expect(result.removed).toContain('ANNIVERSARY');
      expect(result.removed).not.toContain('REV');
      expect(result.errors).toHaveLength(0);
    });

    it('should remove multiple invalid fields at once', async () => {
      const content = `---
UID: test-multi
FN: Test Contact
EMAIL[HOME]: invalid-email
TEL[HOME]: no-numbers
URL[HOME]: bad-url
EMAIL[WORK]: good@example.com
TEL[WORK]: 555-1234
---
## Notes
Test contact`;

      mockApp = createMockApp(content);
      const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
      const result = await contactNote.removeInvalidFrontmatterFields();

      expect(result.removed).toHaveLength(3);
      expect(result.removed).toContain('EMAIL[HOME]');
      expect(result.removed).toContain('TEL[HOME]');
      expect(result.removed).toContain('URL[HOME]');
      expect(result.errors).toHaveLength(0);
    });

    it('should return empty list when no invalid fields found', async () => {
      const content = `---
UID: test-valid
FN: Test Contact
EMAIL[HOME]: valid@example.com
TEL[HOME]: 555-1234
URL[HOME]: https://example.com
---
## Notes
Test contact`;

      mockApp = createMockApp(content);
      const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
      const result = await contactNote.removeInvalidFrontmatterFields();

      expect(result.removed).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(mockApp.vault!.modify).not.toHaveBeenCalled();
    });

    it('should preserve valid fields and only remove invalid ones', async () => {
      const content = `---
UID: test-preserve
FN: Test Contact
EMAIL[HOME]: bad-email
EMAIL[WORK]: good@example.com
TEL[HOME]: 555-1234
ORG: Test Company
---
## Notes
Test contact`;

      let modifiedContent = '';
      const modifyMock = vi.fn().mockImplementation(async (file: TFile, newContent: string) => {
        modifiedContent = newContent;
      });

      mockApp = createMockApp(content, modifyMock);
      const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
      const result = await contactNote.removeInvalidFrontmatterFields();

      expect(result.removed).toContain('EMAIL[HOME]');
      expect(result.removed).toHaveLength(1);
      
      // Check that valid fields are preserved
      expect(modifiedContent).toContain('EMAIL[WORK]: good@example.com');
      expect(modifiedContent).toContain('TEL[HOME]: 555-1234');
      expect(modifiedContent).toContain('ORG: Test Company');
      expect(modifiedContent).not.toContain('EMAIL[HOME]');
    });

    it('should skip non-string values', async () => {
      const content = `---
UID: test-nonstring
FN: Test Contact
CATEGORIES:
  - tag1
  - tag2
EMAIL[HOME]: valid@example.com
---
## Notes
Test contact`;

      mockApp = createMockApp(content);
      const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
      const result = await contactNote.removeInvalidFrontmatterFields();

      expect(result.removed).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle empty frontmatter gracefully', async () => {
      const content = `## Notes
Test contact with no frontmatter`;

      mockApp = createMockApp(content);
      const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
      const result = await contactNote.removeInvalidFrontmatterFields();

      expect(result.removed).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });
  });
});
