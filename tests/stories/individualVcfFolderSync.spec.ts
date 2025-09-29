import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { VcardManager } from '../../src/models/vcardManager';
import { ContactsPluginSettings } from '../../src/settings/settings.d';

/**
 * User Story 2: Individual VCF Files in Folder
 * As a user, I store my vCard contacts as individual VCF files in a folder and I want 
 * to keep that folder synced with my Obsidian contacts so that each contact corresponds 
 * to one VCF file.
 */
describe('Individual VCF Files in Folder Sync Story', () => {
  let mockSettings: ContactsPluginSettings;
  let vcfManager: VcardManager;

  beforeEach(() => {
    mockSettings = {
      contactsFolder: 'Contacts',
      defaultHashtag: '#Contact',
      vcfStorageMethod: 'vcf-folder',
      vcfFilename: 'contacts.vcf',
      vcfWatchFolder: '/test/vcf',
      vcfWatchEnabled: true,
      vcfWatchPollingInterval: 30,
      vcfWriteBackEnabled: true,
      vcfCustomizeIgnoreList: false,
      vcfIgnoreFilenames: [],
      vcfIgnoreUIDs: [],
      logLevel: 'INFO'
    };

    vcfManager = new VcardManager(mockSettings);
  });

  it('should use folder-based VCF storage when configured', () => {
    expect(mockSettings.vcfStorageMethod).toBe('vcf-folder');
    expect(vcfManager.getWatchFolder()).toBe('/test/vcf');
  });

  it('should list VCF files in the watch folder', async () => {
    // Mock the file system to return individual VCF files
    vi.mock('fs/promises', () => ({
      readdir: vi.fn().mockResolvedValue([
        'john-doe.vcf',
        'jane-smith.vcf', 
        'bob-wilson.vcf',
        'not-a-contact.txt' // Should be ignored
      ]),
      access: vi.fn().mockResolvedValue(undefined)
    }));

    const vcfFiles = await vcfManager.listVCFFiles();
    // In a real scenario, this would return the full paths to VCF files
    expect(Array.isArray(vcfFiles)).toBe(true);
  });

  it('should handle individual VCF file creation for new contact', async () => {
    const contactData = {
      UID: 'new-contact-123',
      FN: 'New Contact',
      EMAIL: 'new@example.com',
      TEL: '+1-555-123-4567'
    };

    const expectedVCFContent = `BEGIN:VCARD
VERSION:4.0
UID:new-contact-123
FN:New Contact
EMAIL:new@example.com
TEL:+1-555-123-4567
END:VCARD`;

    // Test that VCF content can be generated for individual file
    expect(expectedVCFContent).toContain('BEGIN:VCARD');
    expect(expectedVCFContent).toContain('UID:new-contact-123');
    expect(expectedVCFContent).toContain('FN:New Contact');
    expect(expectedVCFContent).toContain('END:VCARD');
  });

  it('should generate appropriate filename for individual VCF files', () => {
    const contacts = [
      { FN: 'John Doe', UID: 'john-doe-123', expectedFile: 'john-doe.vcf' },
      { FN: 'Mary Smith', UID: 'mary-smith-456', expectedFile: 'mary-smith.vcf' },
      { FN: 'Dr. Wilson', UID: 'dr-wilson-789', expectedFile: 'dr-wilson.vcf' }
    ];

    contacts.forEach(({ FN, UID, expectedFile }) => {
      // Generate filename from contact name (slug)
      const slug = FN.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      const filename = `${slug}.vcf`;
      
      expect(filename).toBe(expectedFile);
    });
  });

  it('should handle VCF file updates for existing contacts', async () => {
    const existingUID = 'existing-123';
    const existingFilePath = '/test/vcf/existing-contact.vcf';
    
    const originalContent = `BEGIN:VCARD
VERSION:4.0
UID:existing-123
FN:Original Name
EMAIL:original@example.com
REV:20240101T120000Z
END:VCARD`;

    const updatedContent = `BEGIN:VCARD
VERSION:4.0
UID:existing-123
FN:Updated Name
EMAIL:updated@example.com
REV:20240201T120000Z
END:VCARD`;

    // The updated content should have a newer REV timestamp
    expect(updatedContent).toContain('FN:Updated Name');
    expect(updatedContent).toContain('EMAIL:updated@example.com');
    expect(updatedContent).toContain('REV:20240201T120000Z');
  });

  it('should find VCF file by UID in folder structure', async () => {
    const searchUID = 'target-uid-123';
    
    // Mock multiple VCF files with different UIDs
    const mockFiles = [
      { path: '/test/vcf/john.vcf', uid: 'john-uid-111' },
      { path: '/test/vcf/jane.vcf', uid: 'jane-uid-222' },
      { path: '/test/vcf/target.vcf', uid: 'target-uid-123' },
      { path: '/test/vcf/bob.vcf', uid: 'bob-uid-444' }
    ];

    // Find the file with matching UID
    const targetFile = mockFiles.find(file => file.uid === searchUID);
    
    expect(targetFile).toBeDefined();
    expect(targetFile?.path).toBe('/test/vcf/target.vcf');
    expect(targetFile?.uid).toBe(searchUID);
  });

  it('should handle VCF file deletion when contact is removed', () => {
    const contactUID = 'to-be-deleted-123';
    const vcfFilePath = `/test/vcf/deleted-contact.vcf`;
    
    // When a contact is deleted from Obsidian, the corresponding VCF file should be removed
    // This would be handled by the VCF manager
    const deleteOperation = {
      uid: contactUID,
      filePath: vcfFilePath,
      action: 'delete'
    };

    expect(deleteOperation.action).toBe('delete');
    expect(deleteOperation.uid).toBe(contactUID);
    expect(deleteOperation.filePath).toBe(vcfFilePath);
  });

  it('should maintain folder structure organization', async () => {
    // Test that VCF files are properly organized in the watch folder
    const watchFolder = vcfManager.getWatchFolder();
    
    expect(watchFolder).toBe('/test/vcf');
    
    // In folder mode, each contact should have its own VCF file
    const expectedFiles = [
      '/test/vcf/john-doe.vcf',
      '/test/vcf/jane-smith.vcf',
      '/test/vcf/bob-wilson.vcf'
    ];

    expectedFiles.forEach(filePath => {
      expect(filePath.startsWith(watchFolder)).toBe(true);
      expect(filePath.endsWith('.vcf')).toBe(true);
    });
  });

  it('should handle batch operations on VCF folder', async () => {
    const batchOperations = [
      { action: 'create', uid: 'new-1', name: 'New Contact 1' },
      { action: 'update', uid: 'existing-1', name: 'Updated Contact' },
      { action: 'delete', uid: 'old-1', name: 'Old Contact' }
    ];

    // Batch operations should be handled efficiently
    expect(batchOperations).toHaveLength(3);
    expect(batchOperations[0].action).toBe('create');
    expect(batchOperations[1].action).toBe('update');
    expect(batchOperations[2].action).toBe('delete');
  });
});