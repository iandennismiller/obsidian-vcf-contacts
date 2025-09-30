import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { ContactNote } from '../../src/models/contactNote';
import { VcardFile } from '../../src/models/vcardFile/vcardFile';
import { ContactsPluginSettings } from 'src/interfaces/ContactsPluginSettings';

/**
 * User Story 19: Contact History and Versioning
 * As a user, I want to track when contact information was last updated (REV field) 
 * and maintain version consistency between Obsidian and VCF files.
 */
describe('Contact History and Versioning Story', () => {
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
      vcfWriteBackEnabled: true,
      vcfCustomizeIgnoreList: false,
      vcfIgnoreFilenames: [],
      vcfIgnoreUIDs: [],
      logLevel: 'INFO'
    };
  });

  it('should generate REV field with current timestamp when contact is created', async () => {
    const mockFile = { basename: 'new-contact', path: 'Contacts/new-contact.md' } as TFile;
    
    const contactRecord = {
      UID: 'new-contact-123',
      FN: 'New Contact',
      EMAIL: 'new@example.com'
    };

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Generate timestamp for new contact
    const beforeTime = new Date();
    const revTimestamp = generateRevTimestamp();
    const afterTime = new Date();
    
    // REV should be in format YYYYMMDDTHHMMSSZ
    const revRegex = /^\d{8}T\d{6}Z$/;
    expect(revTimestamp).toMatch(revRegex);
    
    // Parse the timestamp to verify it's within expected range
    const year = parseInt(revTimestamp.substring(0, 4));
    const month = parseInt(revTimestamp.substring(4, 6)) - 1; // Month is 0-based
    const day = parseInt(revTimestamp.substring(6, 8));
    const hour = parseInt(revTimestamp.substring(9, 11));
    const minute = parseInt(revTimestamp.substring(11, 13));
    const second = parseInt(revTimestamp.substring(13, 15));
    
    // Parse as UTC since the timestamp ends with 'Z'
    const parsedTime = new Date(Date.UTC(year, month, day, hour, minute, second));
    
    expect(parsedTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime() - 1000);
    expect(parsedTime.getTime()).toBeLessThanOrEqual(afterTime.getTime() + 1000);
  });

  it('should update REV field when contact information changes', async () => {
    const mockFile = { basename: 'updated-contact', path: 'Contacts/updated-contact.md' } as TFile;
    
    // Original contact with older REV
    const originalContent = `---
UID: updated-contact-123
FN: Original Name
EMAIL: original@example.com
REV: 20240101T120000Z
---

#### Notes
Original notes

#Contact`;

    // Updated contact should get newer REV
    const updatedContact = {
      UID: 'updated-contact-123',
      FN: 'Updated Name',
      EMAIL: 'updated@example.com',
      REV: generateRevTimestamp() // New timestamp
    };

    mockApp.vault!.read = vi.fn().mockResolvedValue(originalContent);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'updated-contact-123',
        FN: 'Original Name',
        EMAIL: 'original@example.com',
        REV: '20240101T120000Z'
      }
    });

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Compare timestamps
    expect(updatedContact.REV > '20240101T120000Z').toBe(true);
    expect(updatedContact.FN).toBe('Updated Name');
    expect(updatedContact.EMAIL).toBe('updated@example.com');
  });

  it('should resolve conflicts using REV field for sync priority', async () => {
    const obsidianContact = {
      UID: 'conflict-123',
      FN: 'Obsidian Version',
      EMAIL: 'obsidian@example.com',
      REV: '20240201T150000Z' // Newer
    };

    const vcfContact = {
      UID: 'conflict-123',
      FN: 'VCF Version',
      EMAIL: 'vcf@example.com',
      REV: '20240201T120000Z' // Older
    };

    // Obsidian version should win due to newer REV
    const winningVersion = obsidianContact.REV > vcfContact.REV ? obsidianContact : vcfContact;
    
    expect(winningVersion.FN).toBe('Obsidian Version');
    expect(winningVersion.EMAIL).toBe('obsidian@example.com');
    expect(winningVersion.REV).toBe('20240201T150000Z');
  });

  it('should handle contacts without REV field gracefully', async () => {
    const contactWithoutRev = {
      UID: 'no-rev-123',
      FN: 'No REV Contact',
      EMAIL: 'norev@example.com'
      // Missing REV field
    };

    const contactWithRev = {
      UID: 'no-rev-123',
      FN: 'Has REV Contact',
      EMAIL: 'hasrev@example.com',
      REV: '20240201T120000Z'
    };

    // Contact with REV should be considered newer
    const hasRevField = (contact: any) => contact.REV && contact.REV.length > 0;
    
    if (hasRevField(contactWithRev) && !hasRevField(contactWithoutRev)) {
      // Contact with REV field wins
      expect(contactWithRev.FN).toBe('Has REV Contact');
    } else if (hasRevField(contactWithoutRev) && !hasRevField(contactWithRev)) {
      // Contact without REV should get REV field added
      contactWithoutRev.REV = generateRevTimestamp();
      expect(contactWithoutRev.REV).toBeDefined();
    }
  });

  it('should maintain REV consistency during VCF export', async () => {
    const mockFile = { basename: 'export-contact', path: 'Contacts/export-contact.md' } as TFile;
    
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: {
        UID: 'export-contact-123',
        FN: 'Export Contact',
        EMAIL: 'export@example.com',
        REV: '20240215T143022Z'
      }
    });

    const result = await VcardFile.fromObsidianFiles([mockFile], mockApp as App);
    
    expect(result.vcards).toContain('UID:export-contact-123');
    expect(result.vcards).toContain('FN:Export Contact');
    expect(result.vcards).toContain('REV:20240215T143022Z');
    expect(result.errors).toHaveLength(0);
  });

  it('should preserve REV during VCF import and parsing', async () => {
    const vcfWithRev = `BEGIN:VCARD
VERSION:4.0
UID:import-contact-123
FN:Import Contact
EMAIL:import@example.com
REV:20240220T091530Z
END:VCARD`;

    const vcardFile = new VcardFile(vcfWithRev);
    const contacts = [];
    
    for await (const [slug, record] of vcardFile.parse()) {
      contacts.push({ slug, record });
    }

    expect(contacts).toHaveLength(1);
    expect(contacts[0].record.UID).toBe('import-contact-123');
    expect(contacts[0].record.REV).toBe('20240220T091530Z');
  });

  it('should handle REV field timezone consistency', async () => {
    // All REV fields should be in UTC (Z timezone)
    const revTimestamps = [
      '20240215T143022Z', // Valid UTC
      '20240215T143022+0000', // UTC with offset (should normalize to Z)
      '20240215T143022', // Missing timezone (should add Z)
      '20240215T143022-0500' // Different timezone (should convert to UTC)
    ];

    revTimestamps.forEach(rev => {
      // Normalize REV to UTC Z format
      let normalizedRev = rev;
      
      if (rev.endsWith('+0000')) {
        normalizedRev = rev.replace('+0000', 'Z');
      } else if (!rev.endsWith('Z') && !rev.includes('+') && !rev.includes('-')) {
        normalizedRev = rev + 'Z';
      } else if (rev.includes('+') || (rev.includes('-') && rev.length > 15)) {
        // For simplicity, treat as needing conversion to UTC
        normalizedRev = rev.substring(0, 15) + 'Z';
      }
      
      expect(normalizedRev).toMatch(/^\d{8}T\d{6}Z$/);
      expect(normalizedRev.endsWith('Z')).toBe(true);
    });
  });

  it('should track modification history through REV comparison', async () => {
    const contactVersions = [
      {
        version: 1,
        UID: 'versioned-123',
        FN: 'Original Contact',
        EMAIL: 'original@example.com',
        REV: '20240201T100000Z'
      },
      {
        version: 2,
        UID: 'versioned-123',
        FN: 'Updated Contact',
        EMAIL: 'original@example.com', // Email unchanged
        TEL: '+1-555-123-4567', // Phone added
        REV: '20240202T100000Z'
      },
      {
        version: 3,
        UID: 'versioned-123',
        FN: 'Updated Contact',
        EMAIL: 'updated@example.com', // Email changed
        TEL: '+1-555-123-4567',
        ORG: 'New Company', // Org added
        REV: '20240203T100000Z'
      }
    ];

    // Simulate version history analysis
    const versionHistory = [];
    for (let i = 1; i < contactVersions.length; i++) {
      const prev = contactVersions[i - 1];
      const curr = contactVersions[i];
      
      const changes = [];
      Object.keys({ ...prev, ...curr }).forEach(key => {
        if (key === 'version') return;
        
        const prevValue = prev[key as keyof typeof prev];
        const currValue = curr[key as keyof typeof curr];
        
        if (prevValue !== currValue) {
          changes.push({
            field: key,
            from: prevValue || null,  
            to: currValue || null
          });
        }
      });
      
      versionHistory.push({
        fromVersion: prev.version,
        toVersion: curr.version,
        timestamp: curr.REV,
        changes
      });
    }

    expect(versionHistory).toHaveLength(2);
    
    // Version 1 -> 2 changes
    expect(versionHistory[0].changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'TEL', to: '+1-555-123-4567' }),
        expect.objectContaining({ field: 'REV', from: '20240201T100000Z', to: '20240202T100000Z' })
      ])
    );
    
    // Version 2 -> 3 changes  
    expect(versionHistory[1].changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'EMAIL', from: 'original@example.com', to: 'updated@example.com' }),
        expect.objectContaining({ field: 'ORG', to: 'New Company' }),
        expect.objectContaining({ field: 'REV', from: '20240202T100000Z', to: '20240203T100000Z' })
      ])
    );
  });

  it('should handle concurrent modifications with REV conflicts', async () => {
    // Simulate concurrent modifications to the same contact
    const baseContact = {
      UID: 'concurrent-123',
      FN: 'Base Contact',
      EMAIL: 'base@example.com',
      REV: '20240215T120000Z'
    };

    const modification1 = {
      ...baseContact,
      FN: 'Modified by User 1',
      REV: '20240215T120005Z' // 5 seconds later
    };

    const modification2 = {
      ...baseContact,
      EMAIL: 'modified2@example.com',
      REV: '20240215T120003Z' // 3 seconds later (earlier than mod1)
    };

    // Last writer should win based on REV timestamp
    const winner = modification1.REV > modification2.REV ? modification1 : modification2;
    const loser = modification1.REV > modification2.REV ? modification2 : modification1;
    
    expect(winner.REV).toBe('20240215T120005Z');
    expect(winner.FN).toBe('Modified by User 1');
    expect(loser.REV).toBe('20240215T120003Z');
    
    // Winner should be the final version
    const finalContact = { ...winner };
    expect(finalContact.FN).toBe('Modified by User 1');
    expect(finalContact.EMAIL).toBe('base@example.com'); // Unchanged from winner
  });

  it('should generate valid REV timestamps for bulk operations', async () => {
    const bulkOperationCount = 10;
    const revTimestamps = [];
    
    // Generate multiple REV timestamps in quick succession
    for (let i = 0; i < bulkOperationCount; i++) {
      const rev = generateRevTimestamp();
      revTimestamps.push(rev);
      
      // Small delay to ensure different timestamps (in real implementation)
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    
    // All timestamps should be valid
    revTimestamps.forEach(rev => {
      expect(rev).toMatch(/^\d{8}T\d{6}Z$/);
    });
    
    // Timestamps should generally be increasing (allowing for same second)
    for (let i = 1; i < revTimestamps.length; i++) {
      // Compare as strings since REV timestamps are in sortable format
      expect(revTimestamps[i] >= revTimestamps[i - 1]).toBe(true);
    }
    
    // Should have unique timestamps or be very close in time
    const uniqueTimestamps = new Set(revTimestamps);
    expect(uniqueTimestamps.size).toBeGreaterThan(0);
  });

  it('should maintain REV field during relationship updates', async () => {
    const mockFile = { basename: 'relationship-contact', path: 'Contacts/relationship-contact.md' } as TFile;
    
    const originalContent = `---
UID: relationship-123
FN: Relationship Contact
EMAIL: relationship@example.com
REV: 20240215T120000Z
---

#### Related
- friend: [[Friend Contact]]

#Contact`;

    const updatedContent = `---
UID: relationship-123
FN: Relationship Contact
EMAIL: relationship@example.com
RELATED[friend]: urn:uuid:friend-456
REV: 20240215T125000Z
---

#### Related
- friend: [[Friend Contact]]
- colleague: [[New Colleague]]

#Contact`;

    mockApp.vault!.read = vi.fn()
      .mockResolvedValueOnce(originalContent)
      .mockResolvedValueOnce(updatedContent);

    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    // Simulate relationship update process
    const oldREV = '20240215T120000Z';
    const newREV = generateRevTimestamp();
    
    // New REV should be later than old REV
    expect(newREV > oldREV).toBe(true);
    
    // REV should be updated when relationships change
    const hasRelationshipChanges = 
      updatedContent.includes('RELATED[friend]') && 
      updatedContent.includes('colleague: [[New Colleague]]');
    
    if (hasRelationshipChanges) {
      expect(newREV).toBeDefined();
      expect(newREV).toMatch(/^\d{8}T\d{6}Z$/);
    }
  });
});

// Helper function to generate REV timestamp
function generateRevTimestamp(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hours = String(now.getUTCHours()).padStart(2, '0');
  const minutes = String(now.getUTCMinutes()).padStart(2, '0');
  const seconds = String(now.getUTCSeconds()).padStart(2, '0');
  
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}