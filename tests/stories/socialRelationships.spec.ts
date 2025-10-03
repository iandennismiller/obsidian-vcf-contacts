import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { ContactNote } from '../../src/models/contactNote';
import { ContactsPluginSettings } from 'src/plugin/settings';

/**
 * User Story 10: Social Relationships
 * As a user, I want to manage social relationships like "friend", "neighbor", 
 * "classmate", "teammate" and maintain them across my contact network.
 */
describe('Social Relationships Story', () => {
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
      vcardStorageMethod: 'vcard-folder',
      vcardFilename: 'contacts.vcf',
      vcardWatchFolder: '/test/vcf',
      vcardWatchEnabled: true,
      vcardWatchPollingInterval: 30,
      vcardWriteBackEnabled: false,
      vcardCustomizeIgnoreList: false,
      vcardIgnoreFilenames: [],
      vcardIgnoreUIDs: [],
      logLevel: 'INFO'
    };
  });

  it('should handle friend relationships', async () => {
    const mockFile = { basename: 'social-person', path: 'Contacts/social-person.md' } as TFile;
    const content = `---
UID: social-person-123
FN: Social Person
RELATED[friend]: name:Friend One
RELATED[1:friend]: name:Friend Two
RELATED[2:friend]: name:Friend Three
---

#### Related
- friend [[Friend One]]
- friend [[Friend Two]]
- friend [[Friend Three]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'social-person-123',
        FN: 'Social Person',
        'RELATED[friend]': 'name:Friend One',
        'RELATED[1:friend]': 'name:Friend Two',
        'RELATED[2:friend]': 'name:Friend Three'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const relationships = await contactNote.parseRelatedSection();

    expect(relationships).toHaveLength(3);
    expect(relationships.filter(r => r.type === 'friend')).toHaveLength(3);
  });

  it('should handle neighbor relationships', async () => {
    const mockFile = { basename: 'resident-contact', path: 'Contacts/resident-contact.md' } as TFile;
    const content = `---
UID: resident-contact-456
FN: Resident Contact
RELATED[neighbor]: name:Next Door Neighbor
RELATED[1:neighbor]: name:Across Street Neighbor
---

#### Related
- neighbor [[Next Door Neighbor]]
- neighbor [[Across Street Neighbor]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'resident-contact-456',
        FN: 'Resident Contact',
        'RELATED[neighbor]': 'name:Next Door Neighbor',
        'RELATED[1:neighbor]': 'name:Across Street Neighbor'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const relationships = await contactNote.parseRelatedSection();

    expect(relationships).toHaveLength(2);
    expect(relationships.filter(r => r.type === 'neighbor')).toHaveLength(2);
  });

  it('should handle classmate relationships', async () => {
    const mockFile = { basename: 'student-contact', path: 'Contacts/student-contact.md' } as TFile;
    const content = `---
UID: student-contact-789
FN: Student Contact
RELATED[classmate]: name:Classmate One
RELATED[1:classmate]: name:Classmate Two
---

#### Related
- classmate [[Classmate One]]
- classmate [[Classmate Two]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'student-contact-789',
        FN: 'Student Contact',
        'RELATED[classmate]': 'name:Classmate One',
        'RELATED[1:classmate]': 'name:Classmate Two'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const relationships = await contactNote.parseRelatedSection();

    expect(relationships).toHaveLength(2);
    expect(relationships.filter(r => r.type === 'classmate')).toHaveLength(2);
  });

  it('should handle teammate relationships', async () => {
    const mockFile = { basename: 'athlete-contact', path: 'Contacts/athlete-contact.md' } as TFile;
    const content = `---
UID: athlete-contact-111
FN: Athlete Contact
RELATED[teammate]: name:Teammate One
RELATED[1:teammate]: name:Teammate Two
RELATED[2:teammate]: name:Teammate Three
---

#### Related
- teammate [[Teammate One]]
- teammate [[Teammate Two]]
- teammate [[Teammate Three]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'athlete-contact-111',
        FN: 'Athlete Contact',
        'RELATED[teammate]': 'name:Teammate One',
        'RELATED[1:teammate]': 'name:Teammate Two',
        'RELATED[2:teammate]': 'name:Teammate Three'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const relationships = await contactNote.parseRelatedSection();

    expect(relationships).toHaveLength(3);
    expect(relationships.filter(r => r.type === 'teammate')).toHaveLength(3);
  });

  it('should handle multiple social relationship types', async () => {
    const mockFile = { basename: 'social-butterfly', path: 'Contacts/social-butterfly.md' } as TFile;
    const content = `---
UID: social-butterfly-222
FN: Social Butterfly
RELATED[friend]: name:Best Friend
RELATED[neighbor]: name:Friendly Neighbor
RELATED[classmate]: name:Old Classmate
RELATED[teammate]: name:Soccer Teammate
---

#### Related
- friend [[Best Friend]]
- neighbor [[Friendly Neighbor]]
- classmate [[Old Classmate]]
- teammate [[Soccer Teammate]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'social-butterfly-222',
        FN: 'Social Butterfly',
        'RELATED[friend]': 'name:Best Friend',
        'RELATED[neighbor]': 'name:Friendly Neighbor',
        'RELATED[classmate]': 'name:Old Classmate',
        'RELATED[teammate]': 'name:Soccer Teammate'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const relationships = await contactNote.parseRelatedSection();

    expect(relationships).toHaveLength(4);
    expect(relationships.map(r => r.type)).toContain('friend');
    expect(relationships.map(r => r.type)).toContain('neighbor');
    expect(relationships.map(r => r.type)).toContain('classmate');
    expect(relationships.map(r => r.type)).toContain('teammate');
  });

  it('should handle roommate relationships', async () => {
    const mockFile = { basename: 'roommate-contact', path: 'Contacts/roommate-contact.md' } as TFile;
    const content = `---
UID: roommate-contact-333
FN: Roommate Contact
RELATED[roommate]: name:Current Roommate
RELATED[1:roommate]: name:Former Roommate
---

#### Related
- roommate [[Current Roommate]]
- roommate [[Former Roommate]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'roommate-contact-333',
        FN: 'Roommate Contact',
        'RELATED[roommate]': 'name:Current Roommate',
        'RELATED[1:roommate]': 'name:Former Roommate'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const relationships = await contactNote.parseRelatedSection();

    expect(relationships).toHaveLength(2);
    expect(relationships.filter(r => r.type === 'roommate')).toHaveLength(2);
  });

  it('should handle acquaintance relationships', async () => {
    const mockFile = { basename: 'network-contact', path: 'Contacts/network-contact.md' } as TFile;
    const content = `---
UID: network-contact-444
FN: Network Contact
RELATED[acquaintance]: name:Casual Contact One
RELATED[1:acquaintance]: name:Casual Contact Two
---

#### Related
- acquaintance [[Casual Contact One]]
- acquaintance [[Casual Contact Two]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'network-contact-444',
        FN: 'Network Contact',
        'RELATED[acquaintance]': 'name:Casual Contact One',
        'RELATED[1:acquaintance]': 'name:Casual Contact Two'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const relationships = await contactNote.parseRelatedSection();

    expect(relationships).toHaveLength(2);
    expect(relationships.filter(r => r.type === 'acquaintance')).toHaveLength(2);
  });

  it('should sync social relationships from Related list to frontmatter', async () => {
    const mockFile = { basename: 'sync-social', path: 'Contacts/sync-social.md' } as TFile;
    const content = `---
UID: sync-social-555
FN: Sync Social Contact
---

#### Related
- friend [[New Friend]]
- neighbor [[New Neighbor]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'sync-social-555',
        FN: 'Sync Social Contact'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const result = await contactNote.syncRelatedListToFrontmatter();

    expect(result.success).toBe(true);
  });

  it('should handle club member relationships', async () => {
    const mockFile = { basename: 'club-member', path: 'Contacts/club-member.md' } as TFile;
    const content = `---
UID: club-member-666
FN: Club Member Contact
RELATED[club-member]: name:Fellow Member
---

#### Related
- club-member: [[Fellow Member]]

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(content);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'club-member-666',
        FN: 'Club Member Contact',
        'RELATED[club-member]': 'name:Fellow Member'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const relationships = await contactNote.parseRelatedSection();

    expect(relationships).toHaveLength(1);
    expect(relationships[0].type).toBe('club-member');
  });

  it('should preserve all social relationship types', async () => {
    const mockFile = { basename: 'type-test', path: 'Contacts/type-test.md' } as TFile;
    
    const socialTypes = [
      'friend',
      'neighbor',
      'classmate',
      'teammate',
      'roommate',
      'acquaintance',
      'club-member',
      'gym-buddy',
      'study-partner'
    ];

    for (const type of socialTypes) {
      const content = `---
UID: test-uid
FN: Test Contact
---

#### Related
- ${type}: [[Test Person]]

#Contact`;

      mockApp.vault!.read = vi.fn().mockResolvedValue(content);
      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
        frontmatter: {
          UID: 'test-uid',
          FN: 'Test Contact'
        }
      });

      const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
      const relationships = await contactNote.parseRelatedSection();

      expect(relationships).toHaveLength(1);
      expect(relationships[0].type).toBe(type);
    }
  });
});
