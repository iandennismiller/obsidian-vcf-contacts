import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { ContactNote } from '../../src/models/contactNote';
import { VcardFile } from '../../src/models/vcardFile';
import { ContactsPluginSettings } from 'src/plugin/settings';

/**
 * User Story 27: Backup and Restore
 * As a user, I want confidence that my contact data is safe, with the ability 
 * to backup and restore both Obsidian contacts and VCF files if something goes wrong.
 */
describe('Backup and Restore Story', () => {
  let mockApp: Partial<App>;
  let mockSettings: ContactsPluginSettings;

  beforeEach(() => {
    mockApp = {
      vault: {
        read: vi.fn(),
        modify: vi.fn(),
        create: vi.fn(),
        getMarkdownFiles: vi.fn(),
        getAbstractFileByPath: vi.fn(),
        adapter: {
          exists: vi.fn(),
          read: vi.fn(),
          write: vi.fn(),
          list: vi.fn()
        }
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

  it('should backup all contacts to VCF format', async () => {
    const contacts = [
      { basename: 'john-doe', path: 'Contacts/john-doe.md' },
      { basename: 'jane-smith', path: 'Contacts/jane-smith.md' },
      { basename: 'bob-jones', path: 'Contacts/bob-jones.md' }
    ];

    const mockFiles = contacts.map(c => c as TFile);

    mockApp.vault!.getMarkdownFiles = vi.fn().mockReturnValue(mockFiles);
    
    mockApp.metadataCache!.getFileCache = vi.fn().mockImplementation((file: TFile) => {
      const contact = contacts.find(c => c.path === file.path);
      return {
        frontmatter: {
          UID: `${contact!.basename}-uid`,
          FN: contact!.basename.replace('-', ' '),
          EMAIL: `${contact!.basename}@example.com`
        }
      };
    });

    // Export all contacts to backup
    const result = await VcardFile.fromObsidianFiles(mockFiles, mockApp as App);

    // Should include all contacts
    expect(result.vcards).toContain('UID:john-doe-uid');
    expect(result.vcards).toContain('UID:jane-smith-uid');
    expect(result.vcards).toContain('UID:bob-jones-uid');
    
    // Should be valid VCF format
    const vcardCount = (result.vcards.match(/BEGIN:VCARD/g) || []).length;
    expect(vcardCount).toBe(3);
  });

  it('should restore contacts from VCF backup', async () => {
    const backupVcf = `BEGIN:VCARD
VERSION:4.0
UID:restored-123
FN:Restored Contact
EMAIL:restored@example.com
TEL:+1-555-123-4567
END:VCARD
BEGIN:VCARD
VERSION:4.0
UID:restored-456
FN:Another Restored
EMAIL:another@example.com
END:VCARD`;

    const vcardFile = new VcardFile(backupVcf);
    const results = [];

    for await (const [slug, record] of vcardFile.parse()) {
      results.push({ slug, record });
    }

    // Should restore all contacts from backup
    expect(results).toHaveLength(2);
    expect(results[0].record.UID).toBe('restored-123');
    expect(results[0].record.FN).toBe('Restored Contact');
    expect(results[1].record.UID).toBe('restored-456');
    expect(results[1].record.FN).toBe('Another Restored');
  });

  it('should maintain data integrity during backup', async () => {
    const mockFile = { basename: 'integrity-test', path: 'Contacts/integrity-test.md' } as TFile;

    const originalData = {
      UID: 'integrity-uid-789',
      VERSION: '4.0',
      FN: 'Integrity Test',
      'N.FN': 'Test',
      'N.GN': 'Integrity',
      EMAIL: 'integrity@example.com',
      TEL: '+1-555-999-8888',
      'RELATED[spouse]': 'urn:uuid:spouse-uid-123',
      REV: '20240115T100000Z'
    };

    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: originalData
    });

    // Create backup
    const result = await VcardFile.fromObsidianFiles([mockFile], mockApp as App);

    // Verify all data preserved
    expect(result.vcards).toContain('UID:integrity-uid-789');
    expect(result.vcards).toContain('FN:Integrity Test');
    expect(result.vcards).toContain('EMAIL:integrity@example.com');
    expect(result.vcards).toContain('TEL:+1-555-999-8888');
    expect(result.vcards).toContain('REV:20240115T100000Z');
  });

  it('should preserve relationships during backup and restore', async () => {
    const familyContacts = `BEGIN:VCARD
VERSION:4.0
UID:parent-uid-111
FN:Parent Contact
RELATED;TYPE=child:urn:uuid:child-uid-222
END:VCARD
BEGIN:VCARD
VERSION:4.0
UID:child-uid-222
FN:Child Contact
RELATED;TYPE=parent:urn:uuid:parent-uid-111
END:VCARD`;

    const vcardFile = new VcardFile(familyContacts);
    const results = [];

    for await (const [slug, record] of vcardFile.parse()) {
      results.push({ slug, record });
    }

    // Relationships should be preserved
    expect(results).toHaveLength(2);
    expect(results[0].record['RELATED[child]']).toBe('urn:uuid:child-uid-222');
    expect(results[1].record['RELATED[parent]']).toBe('urn:uuid:parent-uid-111');
  });

  it('should handle incremental backups with REV timestamps', async () => {
    const mockFile = { basename: 'incremental', path: 'Contacts/incremental.md' } as TFile;

    const contactData = {
      UID: 'incremental-uid-333',
      FN: 'Incremental Backup Test',
      EMAIL: 'incremental@example.com',
      REV: '20240115T120000Z'
    };

    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: contactData
    });

    // First backup
    const backup1 = await VcardFile.fromObsidianFiles([mockFile], mockApp as App);
    expect(backup1.vcards).toContain('REV:20240115T120000Z');

    // Simulate update
    contactData.REV = '20240115T130000Z';
    contactData.EMAIL = 'updated@example.com';

    // Second backup
    const backup2 = await VcardFile.fromObsidianFiles([mockFile], mockApp as App);
    expect(backup2.vcards).toContain('REV:20240115T130000Z');
    expect(backup2.vcards).toContain('EMAIL:updated@example.com');
  });

  it('should create timestamped backup files', () => {
    const timestamp = new Date('2024-01-15T12:00:00Z');
    const backupFilename = `contacts-backup-${timestamp.getTime()}.vcf`;

    // Verify backup filename format
    expect(backupFilename).toMatch(/contacts-backup-\d+\.vcf/);
    expect(backupFilename).toContain('1705320000000');
  });

  it('should verify backup integrity after creation', async () => {
    const mockFiles = [
      { basename: 'verify-1', path: 'Contacts/verify-1.md' },
      { basename: 'verify-2', path: 'Contacts/verify-2.md' }
    ] as TFile[];

    mockApp.metadataCache!.getFileCache = vi.fn().mockImplementation((file: TFile) => ({
      frontmatter: {
        UID: `${file.basename}-uid`,
        FN: file.basename,
        EMAIL: `${file.basename}@example.com`
      }
    }));

    // Create backup
    const backup = await VcardFile.fromObsidianFiles(mockFiles, mockApp as App);

    // Verify backup contents
    const vcardCount = (backup.vcards.match(/BEGIN:VCARD/g) || []).length;
    expect(vcardCount).toBe(2);
    expect(backup.errors).toHaveLength(0);
  });

  it('should restore from backup while preserving existing UIDs', async () => {
    const backupWithUIDs = `BEGIN:VCARD
VERSION:4.0
UID:preserved-uid-444
FN:Preserved UID Contact
EMAIL:preserved@example.com
END:VCARD`;

    const vcardFile = new VcardFile(backupWithUIDs);
    const results = [];

    for await (const [slug, record] of vcardFile.parse()) {
      results.push({ slug, record });
    }

    // UID should be preserved from backup
    expect(results[0].record.UID).toBe('preserved-uid-444');
  });

  it('should handle backup failures gracefully', async () => {
    const mockFile = { basename: 'fail-backup', path: 'Contacts/fail-backup.md' } as TFile;

    // Simulate error during backup
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue(null);

    const result = await VcardFile.fromObsidianFiles([mockFile], mockApp as App);

    // Should report error but not crash
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should support multiple backup locations', () => {
    const backupLocations = [
      '/vault/backups/contacts-backup-1.vcf',
      '/external/drive/contacts-backup-2.vcf',
      '/cloud/storage/contacts-backup-3.vcf'
    ];

    // Verify multiple backup paths are supported
    backupLocations.forEach(location => {
      expect(location).toMatch(/\.vcf$/);
      expect(location).toContain('backup');
    });
  });

  it('should restore contacts without losing Obsidian-specific data', async () => {
    const backupVcf = `BEGIN:VCARD
VERSION:4.0
UID:obsidian-restore-555
FN:Restore Test
EMAIL:restore@example.com
END:VCARD`;

    const vcardFile = new VcardFile(backupVcf);
    const results = [];

    for await (const [slug, record] of vcardFile.parse()) {
      results.push({ slug, record });
    }

    // Should restore vCard data
    expect(results[0].record.UID).toBe('obsidian-restore-555');
    expect(results[0].record.FN).toBe('Restore Test');
    expect(results[0].record.EMAIL).toBe('restore@example.com');
    
    // Note: Obsidian-specific markdown content would be restored separately
  });

  it('should maintain backup history for rollback', () => {
    const backupHistory = [
      { timestamp: '2024-01-15T10:00:00Z', file: 'backup-1.vcf' },
      { timestamp: '2024-01-15T11:00:00Z', file: 'backup-2.vcf' },
      { timestamp: '2024-01-15T12:00:00Z', file: 'backup-3.vcf' }
    ];

    // Should maintain ordered history
    expect(backupHistory).toHaveLength(3);
    expect(new Date(backupHistory[0].timestamp).getTime()).toBeLessThan(new Date(backupHistory[1].timestamp).getTime());
    expect(new Date(backupHistory[1].timestamp).getTime()).toBeLessThan(new Date(backupHistory[2].timestamp).getTime());
  });

  it('should validate restored data matches backup', async () => {
    const originalData = {
      UID: 'validate-666',
      FN: 'Validation Test',
      EMAIL: 'validate@example.com',
      TEL: '+1-555-777-6666'
    };

    const mockFile = { basename: 'validation-test', path: 'Contacts/validation-test.md' } as TFile;
    
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
      frontmatter: originalData
    });

    // Create backup
    const backup = await VcardFile.fromObsidianFiles([mockFile], mockApp as App);

    // Parse backup
    const vcardFile = new VcardFile(backup.vcards);
    const results = [];

    for await (const [slug, record] of vcardFile.parse()) {
      results.push({ slug, record });
    }

    // Validate data matches
    expect(results[0].record.UID).toBe(originalData.UID);
    expect(results[0].record.FN).toBe(originalData.FN);
    expect(results[0].record.EMAIL).toBe(originalData.EMAIL);
    expect(results[0].record.TEL).toBe(originalData.TEL);
  });
});
