import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarkdownOperations } from '../../../../src/models/contactNote/markdownOperations';
import { ContactData } from '../../../../src/models/contactNote/contactData';
import { Gender } from '../../../../src/models/contactNote/types';

describe('MarkdownOperations', () => {
  let mockContactData: ContactData;
  let markdownOps: MarkdownOperations;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock ContactData
    mockContactData = {
      getContent: vi.fn(),
      updateContent: vi.fn(),
    } as any;

    markdownOps = new MarkdownOperations(mockContactData);
  });

  describe('mdRender', () => {
    it('should render basic contact information', () => {
      const record = {
        FN: 'John Doe',
        'N.GN': 'John',
        'N.FN': 'Doe',
        EMAIL: 'john@example.com',
        TEL: '+1234567890',
        UID: 'john-uid-123',
        VERSION: '4.0',
      };

      const result = markdownOps.mdRender(record, '#Contact');

      expect(result).toContain('---');
      expect(result).toContain('FN: John Doe');
      expect(result).toContain('EMAIL: john@example.com');
      expect(result).toContain('TEL: +1234567890');
      expect(result).toContain('#### Notes');
      expect(result).toContain('## Related');
      expect(result).toContain('#Contact');
    });

    it('should handle NOTE field with escaped newlines', () => {
      const record = {
        FN: 'John Doe',
        NOTE: 'Line 1\\nLine 2\\nLine 3',
        UID: 'john-uid',
        VERSION: '4.0',
      };

      const result = markdownOps.mdRender(record, '#Contact');

      expect(result).toContain('Line 1\nLine 2\nLine 3');
      expect(result).not.toContain('\\n');
    });

    it('should handle CATEGORIES as hashtags', () => {
      const record = {
        FN: 'John Doe',
        CATEGORIES: 'work,colleague,client',
        UID: 'john-uid',
        VERSION: '4.0',
      };

      const result = markdownOps.mdRender(record, '#Contact');

      expect(result).toContain('#work #colleague #client');
    });

    it('should sort name fields in correct order', () => {
      const record = {
        FN: 'Dr. John Michael Doe Jr.',
        'N.FN': 'Doe',
        'N.GN': 'John',
        'N.MN': 'Michael',
        'N.PREFIX': 'Dr.',
        'N.SUFFIX': 'Jr.',
        UID: 'john-uid',
        VERSION: '4.0',
      };

      const result = markdownOps.mdRender(record, '#Contact');

      // Extract frontmatter section
      const frontmatterMatch = result.match(/---\n([\s\S]*?)---/);
      expect(frontmatterMatch).toBeTruthy();
      
      // Verify all name fields are present in frontmatter
      const frontmatter = frontmatterMatch![1];
      expect(frontmatter).toContain('N.PREFIX');
      expect(frontmatter).toContain('N.GN');
      expect(frontmatter).toContain('N.MN');
      expect(frontmatter).toContain('N.FN');
      expect(frontmatter).toContain('N.SUFFIX');
    });

    it('should sort priority fields in correct order', () => {
      const record = {
        FN: 'John Doe',
        PHOTO: 'photo-data',
        ROLE: 'Developer',
        TITLE: 'Senior Developer',
        ORG: 'Tech Corp',
        BDAY: '1990-01-01',
        EMAIL: 'john@example.com',
        UID: 'john-uid',
        VERSION: '4.0',
      };

      const result = markdownOps.mdRender(record, '#Contact');

      const frontmatterMatch = result.match(/---\n([\s\S]*?)---/);
      expect(frontmatterMatch).toBeTruthy();
      
      const frontmatter = frontmatterMatch![1];
      const emailIndex = frontmatter.indexOf('EMAIL');
      const bdayIndex = frontmatter.indexOf('BDAY');
      const orgIndex = frontmatter.indexOf('ORG');

      expect(emailIndex).toBeLessThan(bdayIndex);
      expect(bdayIndex).toBeLessThan(orgIndex);
    });

    it('should generate Related section from RELATED fields', () => {
      const record = {
        FN: 'John Doe',
        'RELATED[spouse]': 'name:Jane Doe',
        'RELATED[1:child]': 'name:Alice Doe',
        UID: 'john-uid',
        VERSION: '4.0',
      };

      const result = markdownOps.mdRender(record, '#Contact');

      expect(result).toContain('## Related');
      expect(result).toContain('- spouse [[Jane Doe]]');
      expect(result).toContain('- child [[Alice Doe]]');
    });

    it('should apply gender-based relationship terms when genderLookup provided', () => {
      const record = {
        FN: 'John Doe',
        'RELATED[parent]': 'name:Jane Doe',
        'RELATED[1:parent]': 'name:Bob Doe',
        UID: 'john-uid',
        VERSION: '4.0',
      };

      const genderLookup = (name: string): Gender => {
        if (name === 'Jane Doe') return 'F';
        if (name === 'Bob Doe') return 'M';
        return undefined;
      };

      const result = markdownOps.mdRender(record, '#Contact', genderLookup);

      expect(result).toContain('- mother [[Jane Doe]]');
      expect(result).toContain('- father [[Bob Doe]]');
    });

    it('should handle RELATED fields with UUID values', () => {
      const record = {
        FN: 'John Doe',
        'RELATED[spouse]': 'urn:uuid:jane-uid-123',
        UID: 'john-uid',
        VERSION: '4.0',
      };

      const result = markdownOps.mdRender(record, '#Contact');

      expect(result).toContain('- spouse [[jane-uid-123]]');
    });

    it('should handle RELATED fields with UID values', () => {
      const record = {
        FN: 'John Doe',
        'RELATED[friend]': 'uid:friend-uid-456',
        UID: 'john-uid',
        VERSION: '4.0',
      };

      const result = markdownOps.mdRender(record, '#Contact');

      expect(result).toContain('- friend [[friend-uid-456]]');
    });

    it('should render empty Related section when no RELATED fields', () => {
      const record = {
        FN: 'John Doe',
        UID: 'john-uid',
        VERSION: '4.0',
      };

      const result = markdownOps.mdRender(record, '#Contact');

      expect(result).toContain('## Related\n');
      expect(result).not.toMatch(/- \w+:/);
    });

    it('should handle gender-aware relationship for various types', () => {
      const record = {
        FN: 'John Doe',
        'RELATED[child]': 'name:Alice',
        'RELATED[1:child]': 'name:Bob',
        'RELATED[2:sibling]': 'name:Carol',
        'RELATED[3:sibling]': 'name:Dave',
        UID: 'john-uid',
        VERSION: '4.0',
      };

      const genderLookup = (name: string): Gender => {
        if (name === 'Alice' || name === 'Carol') return 'F';
        if (name === 'Bob' || name === 'Dave') return 'M';
        return undefined;
      };

      const result = markdownOps.mdRender(record, '#Contact', genderLookup);

      expect(result).toContain('- daughter [[Alice]]');
      expect(result).toContain('- son [[Bob]]');
      expect(result).toContain('- sister [[Carol]]');
      expect(result).toContain('- brother [[Dave]]');
    });

    it('should use default relationship term when gender is unknown', () => {
      const record = {
        FN: 'John Doe',
        'RELATED[parent]': 'name:Unknown Person',
        UID: 'john-uid',
        VERSION: '4.0',
      };

      const genderLookup = (name: string): Gender => undefined;

      const result = markdownOps.mdRender(record, '#Contact', genderLookup);

      expect(result).toContain('- parent [[Unknown Person]]');
    });

    it('should not apply gender terms for UUID/UID references', () => {
      const record = {
        FN: 'John Doe',
        'RELATED[parent]': 'urn:uuid:parent-uid',
        UID: 'john-uid',
        VERSION: '4.0',
      };

      const genderLookup = vi.fn(() => 'F' as Gender);

      const result = markdownOps.mdRender(record, '#Contact', genderLookup);

      expect(result).toContain('- parent [[parent-uid]]');
      // Gender lookup should not be called for UUID references
      expect(genderLookup).not.toHaveBeenCalled();
    });
  });

  describe('extractMarkdownSections', () => {
    it('should extract sections from markdown content', async () => {
      const content = `---
FN: John Doe
---
#### Notes
This is a note.

## Related
- spouse [[Jane Doe]]

#### Custom Section
Some custom content.

#Contact
`;

      vi.mocked(mockContactData.getContent).mockResolvedValue(content);

      const sections = await markdownOps.extractMarkdownSections();

      expect(sections.size).toBe(3);
      expect(sections.get('Notes')).toBe('This is a note.');
      expect(sections.get('Related')).toBe('- spouse [[Jane Doe]]');
      // Section content may include trailing content until next section or end
      expect(sections.get('Custom Section')).toContain('Some custom content.');
    });

    it('should handle content with no sections', async () => {
      const content = `---
FN: John Doe
---
Just some text without sections.

#Contact
`;

      vi.mocked(mockContactData.getContent).mockResolvedValue(content);

      const sections = await markdownOps.extractMarkdownSections();

      expect(sections.size).toBe(0);
    });

    it('should handle multi-line section content', async () => {
      const content = `---
FN: John Doe
---
#### Notes
Line 1
Line 2
Line 3

#Contact
`;

      vi.mocked(mockContactData.getContent).mockResolvedValue(content);

      const sections = await markdownOps.extractMarkdownSections();

      // Section content may include trailing content
      expect(sections.get('Notes')).toContain('Line 1\nLine 2\nLine 3');
    });
  });

  describe('updateSection', () => {
    it('should update an existing section', async () => {
      const content = `---
FN: John Doe
---
#### Notes
Old note content.

## Related
- spouse [[Jane Doe]]

#Contact
`;

      vi.mocked(mockContactData.getContent).mockResolvedValue(content);

      await markdownOps.updateSection('Notes', 'New note content.');

      expect(mockContactData.updateContent).toHaveBeenCalled();
      const updatedContent = vi.mocked(mockContactData.updateContent).mock.calls[0][0];
      expect(updatedContent).toContain('#### Notes\nNew note content.');
      expect(updatedContent).not.toContain('Old note content.');
      expect(updatedContent).toContain('## Related');
    });

    it('should add new section when section does not exist', async () => {
      const content = `---
FN: John Doe
---
#### Notes
Some notes.

#Contact
`;

      vi.mocked(mockContactData.getContent).mockResolvedValue(content);

      await markdownOps.updateSection('Custom', 'Custom content.');

      expect(mockContactData.updateContent).toHaveBeenCalled();
      const updatedContent = vi.mocked(mockContactData.updateContent).mock.calls[0][0];
      expect(updatedContent).toContain('## Custom\nCustom content.');
      expect(updatedContent).toContain('#Contact');
    });

    it('should place new section before tags', async () => {
      const content = `---
FN: John Doe
---
#### Notes
Some notes.

#Contact #Work
`;

      vi.mocked(mockContactData.getContent).mockResolvedValue(content);

      await markdownOps.updateSection('Related', '- spouse [[Jane]]');

      expect(mockContactData.updateContent).toHaveBeenCalled();
      const updatedContent = vi.mocked(mockContactData.updateContent).mock.calls[0][0];
      
      const customIndex = updatedContent.indexOf('## Related');
      const tagIndex = updatedContent.indexOf('#Contact');
      
      expect(customIndex).toBeGreaterThan(-1);
      expect(customIndex).toBeLessThan(tagIndex);
    });

    it('should append new section when no tags exist', async () => {
      const content = `---
FN: John Doe
---
#### Notes
Some notes.`;

      vi.mocked(mockContactData.getContent).mockResolvedValue(content);

      await markdownOps.updateSection('Related', '- spouse [[Jane]]');

      expect(mockContactData.updateContent).toHaveBeenCalled();
      const updatedContent = vi.mocked(mockContactData.updateContent).mock.calls[0][0];
      expect(updatedContent).toContain('## Related\n- spouse [[Jane]]');
    });
  });
});
