import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RelatedOtherProcessor } from '../src/insights/processors/RelatedOtherProcessor';
import { Contact, ContactNote, FrontmatterRelationship } from '../src/contacts/contactNote';
import { ContactManager } from '../src/contacts/contactManager';
import { RunType } from '../src/insights/insight.d';
import { setSettings, clearSettings } from '../src/context/sharedSettingsContext';
import { setApp, clearApp } from '../src/context/sharedAppContext';
import type { ContactsPluginSettings } from '../src/settings/settings.d';
import type { App, TFile } from 'obsidian';

const mockSettings: ContactsPluginSettings = {
  contactsFolder: '/contacts',
  defaultHashtag: '#contact',
  vcfWatchFolder: '/test/vcf',
  vcfWatchEnabled: true,
  vcfWatchPollingInterval: 5000,
  vcfWriteBackEnabled: false,
  vcfIgnoreFilenames: [],
  vcfIgnoreUIDs: [],
  logLevel: 'INFO',
  relatedOtherProcessor: true,
};

describe('RelatedOtherProcessor Integration', () => {
  let mockApp: App;
  let mockContactManager: ContactManager;
  let mockContactNote: ContactNote;

  beforeEach(() => {
    vi.clearAllMocks();
    clearSettings();
    clearApp();
    
    // Set up mock app context
    mockApp = {
      metadataCache: {
        getFileCache: vi.fn(() => ({ frontmatter: {} }))
      }
    } as unknown as App;
    
    setApp(mockApp);
    setSettings(mockSettings);
    
    // Mock ContactManager
    mockContactManager = {
      getAllContactFiles: vi.fn()
    } as unknown as ContactManager;
    
    // Mock ContactNote
    mockContactNote = {
      parseFrontmatterRelationships: vi.fn(),
      getFrontmatter: vi.fn(),
      updateMultipleFrontmatterValues: vi.fn(),
      generateRevTimestamp: vi.fn(() => '20250923T231928Z'),
      convertToGenderlessType: vi.fn((type: string) => type.toLowerCase())
    } as unknown as ContactNote;
  });

  it('should process reciprocal relationships correctly', async () => {
    // Create mock files
    const aliceFile: TFile = { basename: 'Alice', path: '/contacts/Alice.md' } as TFile;
    const bobFile: TFile = { basename: 'Bob', path: '/contacts/Bob.md' } as TFile;
    const charlieFile: TFile = { basename: 'Charlie', path: '/contacts/Charlie.md' } as TFile;
    
    // Alice is the contact being processed
    const aliceContact: Contact = {
      data: { UID: 'alice-uid' },
      file: aliceFile
    };

    // Mock getAllContactFiles to return Bob and Charlie (other contacts)
    vi.mocked(mockContactManager.getAllContactFiles).mockReturnValue([aliceFile, bobFile, charlieFile]);

    // Mock Bob's relationships - Bob has Alice as parent
    const bobRelationships: FrontmatterRelationship[] = [
      {
        type: 'parent',
        value: 'Alice',
        parsedValue: { type: 'name', value: 'Alice' }
      }
    ];

    // Mock Charlie's relationships - Charlie has Alice as friend
    const charlieRelationships: FrontmatterRelationship[] = [
      {
        type: 'friend',
        value: 'Alice',
        parsedValue: { type: 'name', value: 'Alice' }
      }
    ];

    // Mock Alice's current relationships (empty initially)
    const aliceRelationships: FrontmatterRelationship[] = [];
    const aliceFrontmatter = {};

    // Set up the ContactManager and ContactNote mocks
    const ContactManagerMock = vi.fn().mockImplementation(() => mockContactManager);
    const ContactNoteMock = vi.fn().mockImplementation((app, settings, file) => {
      if (file.path === '/contacts/Alice.md') {
        return {
          ...mockContactNote,
          parseFrontmatterRelationships: vi.fn().mockResolvedValue(aliceRelationships),
          getFrontmatter: vi.fn().mockResolvedValue(aliceFrontmatter)
        };
      } else if (file.path === '/contacts/Bob.md') {
        return {
          ...mockContactNote,
          parseFrontmatterRelationships: vi.fn().mockResolvedValue(bobRelationships)
        };
      } else if (file.path === '/contacts/Charlie.md') {
        return {
          ...mockContactNote,
          parseFrontmatterRelationships: vi.fn().mockResolvedValue(charlieRelationships)
        };
      }
      return mockContactNote;
    });

    // Mock the reciprocal relationship function
    const getReciprocalRelationshipTypeMock = vi.fn()
      .mockReturnValueOnce('child')  // parent -> child
      .mockReturnValueOnce('friend'); // friend -> friend

    // Apply mocks
    vi.doMock('../src/contacts/contactManager', () => ({ ContactManager: ContactManagerMock }));
    vi.doMock('../src/contacts/contactNote', () => ({ ContactNote: ContactNoteMock }));
    vi.doMock('../src/util/reciprocalRelationships', () => ({
      getReciprocalRelationshipType: getReciprocalRelationshipTypeMock
    }));

    // Mock loggingService
    const loggingServiceMock = {
      info: vi.fn(),
      error: vi.fn()
    };
    vi.doMock('../src/services/loggingService', () => ({ loggingService: loggingServiceMock }));

    // Test the processor
    const result = await RelatedOtherProcessor.process(aliceContact);

    // Verify results
    expect(result).toBeDefined();
    expect(result?.name).toBe('RelatedOtherProcessor');
    expect(result?.message).toContain('2 missing reciprocal relationship');
    
    // Verify that updateMultipleFrontmatterValues was called with the right data
    const mockAliceContactNote = ContactNoteMock.mock.results[0].value;
    expect(mockAliceContactNote.updateMultipleFrontmatterValues).toHaveBeenCalledWith({
      'RELATED[child]': 'Bob',
      'RELATED[friend]': 'Charlie',
      'REV': '20250923T231928Z'
    });

    // Verify logging
    expect(loggingServiceMock.info).toHaveBeenCalledWith(
      '[RelatedOtherProcessor] Adding reciprocal relationship: Alice -> child -> Bob'
    );
    expect(loggingServiceMock.info).toHaveBeenCalledWith(
      '[RelatedOtherProcessor] Adding reciprocal relationship: Alice -> friend -> Charlie'
    );
  });

  it('should not add relationships that already exist', async () => {
    const aliceFile: TFile = { basename: 'Alice', path: '/contacts/Alice.md' } as TFile;
    const bobFile: TFile = { basename: 'Bob', path: '/contacts/Bob.md' } as TFile;
    
    const aliceContact: Contact = {
      data: { UID: 'alice-uid' },
      file: aliceFile
    };

    // Mock getAllContactFiles
    vi.mocked(mockContactManager.getAllContactFiles).mockReturnValue([aliceFile, bobFile]);

    // Bob has Alice as parent
    const bobRelationships: FrontmatterRelationship[] = [
      {
        type: 'parent',
        value: 'Alice',
        parsedValue: { type: 'name', value: 'Alice' }
      }
    ];

    // Alice already has Bob as child
    const aliceRelationships: FrontmatterRelationship[] = [
      {
        type: 'child',
        value: 'Bob',
        parsedValue: { type: 'name', value: 'Bob' }
      }
    ];
    
    const aliceFrontmatter = { 'RELATED[child]': 'Bob' };

    const ContactManagerMock = vi.fn().mockImplementation(() => mockContactManager);
    const ContactNoteMock = vi.fn().mockImplementation((app, settings, file) => {
      if (file.path === '/contacts/Alice.md') {
        return {
          ...mockContactNote,
          parseFrontmatterRelationships: vi.fn().mockResolvedValue(aliceRelationships),
          getFrontmatter: vi.fn().mockResolvedValue(aliceFrontmatter)
        };
      } else if (file.path === '/contacts/Bob.md') {
        return {
          ...mockContactNote,
          parseFrontmatterRelationships: vi.fn().mockResolvedValue(bobRelationships)
        };
      }
      return mockContactNote;
    });

    const getReciprocalRelationshipTypeMock = vi.fn().mockReturnValue('child');

    vi.doMock('../src/contacts/contactManager', () => ({ ContactManager: ContactManagerMock }));
    vi.doMock('../src/contacts/contactNote', () => ({ ContactNote: ContactNoteMock }));
    vi.doMock('../src/util/reciprocalRelationships', () => ({
      getReciprocalRelationshipType: getReciprocalRelationshipTypeMock
    }));

    // Test the processor - should return undefined since no changes needed
    const result = await RelatedOtherProcessor.process(aliceContact);

    // Should return undefined since no changes were needed
    expect(result).toBeUndefined();
  });
});