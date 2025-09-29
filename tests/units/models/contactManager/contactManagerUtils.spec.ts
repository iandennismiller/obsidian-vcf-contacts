import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContactManagerUtils } from '../../../../src/models/contactManager/contactManagerUtils';
import { App, TFile, Notice } from 'obsidian';
import { VCardForObsidianRecord } from '../../../../src/models/vcardFile';

// Mock external dependencies
vi.mock('obsidian', () => ({
  Notice: vi.fn(),
  normalizePath: vi.fn((path) => path),
  TFile: vi.fn()
}));

vi.mock('../../../../src/ui/modals/fileExistsModal', () => ({
  FileExistsModal: vi.fn().mockImplementation((app, filePath, callback) => ({
    open: vi.fn().mockImplementation(() => {
      // Auto-resolve with "skip" action for testing
      setTimeout(() => callback("skip"), 0);
    })
  }))
}));

vi.mock('../../../../src/insights/insightService', () => ({
  insightService: {
    process: vi.fn().mockResolvedValue(undefined)
  }
}));

describe('ContactManagerUtils', () => {
  let mockApp: Partial<App>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockApp = {
      vault: {
        getAbstractFileByPath: vi.fn(),
        adapter: {
          exists: vi.fn()
        },
        create: vi.fn(),
        modify: vi.fn()
      } as any,
      workspace: {
        getActiveFile: vi.fn(),
        openLinkText: vi.fn(),
        getLeaf: vi.fn().mockReturnValue({
          openFile: vi.fn()
        })
      } as any,
      metadataCache: {
        getFileCache: vi.fn()
      } as any
    };
  });

  describe('createContactFile', () => {
    it('should create contact file in specified folder', async () => {
      const mockFolder = { path: 'Contacts' };
      mockApp.vault!.getAbstractFileByPath = vi.fn().mockReturnValue(mockFolder);
      mockApp.vault!.adapter!.exists = vi.fn().mockResolvedValue(false);
      mockApp.vault!.create = vi.fn().mockResolvedValue({});
      mockApp.workspace!.getActiveFile = vi.fn().mockReturnValue(null);

      await ContactManagerUtils.createContactFile(
        mockApp as App, 
        'Contacts', 
        'test content', 
        'test.md'
      );

      expect(mockApp.vault!.create).toHaveBeenCalledWith('Contacts/test.md', 'test content');
    });

    it('should handle missing folder gracefully', async () => {
      mockApp.vault!.getAbstractFileByPath = vi.fn().mockReturnValue(null);
      
      await ContactManagerUtils.createContactFile(
        mockApp as App, 
        'NonExistent', 
        'test content', 
        'test.md'
      );

      expect(Notice).toHaveBeenCalledWith(
        expect.stringContaining("Can not find path: 'NonExistent'")
      );
    });

    it('should use parent folder when active file is in contacts folder', async () => {
      const mockFolder = { path: 'Contacts' };
      const mockActiveFile = { 
        parent: { path: 'Contacts/Subfolder' }
      } as TFile;
      
      mockApp.vault!.getAbstractFileByPath = vi.fn().mockReturnValue(mockFolder);
      mockApp.workspace!.getActiveFile = vi.fn().mockReturnValue(mockActiveFile);
      mockApp.vault!.adapter!.exists = vi.fn().mockResolvedValue(false);
      mockApp.vault!.create = vi.fn().mockResolvedValue({});

      await ContactManagerUtils.createContactFile(
        mockApp as App, 
        'Contacts', 
        'test content', 
        'test.md'
      );

      expect(mockApp.vault!.create).toHaveBeenCalledWith('Contacts/Subfolder/test.md', 'test content');
    });

    it('should handle existing files with modal', async () => {
      const mockFolder = { path: 'Contacts' };
      mockApp.vault!.getAbstractFileByPath = vi.fn().mockReturnValue(mockFolder);
      mockApp.vault!.adapter!.exists = vi.fn().mockResolvedValue(true);
      mockApp.workspace!.getActiveFile = vi.fn().mockReturnValue(null);

      await ContactManagerUtils.createContactFile(
        mockApp as App, 
        'Contacts', 
        'test content', 
        'existing.md'
      );

      // Should not create file when it exists (modal will handle)
      expect(mockApp.vault!.create).not.toHaveBeenCalled();
    });
  });

  describe('handleFileCreation', () => {
    it('should create new file when it does not exist', async () => {
      mockApp.vault!.adapter!.exists = vi.fn().mockResolvedValue(false);
      mockApp.vault!.create = vi.fn().mockResolvedValue({});

      await ContactManagerUtils.handleFileCreation(
        mockApp as App, 
        'Contacts/new.md', 
        'content'
      );

      expect(mockApp.vault!.create).toHaveBeenCalledWith('Contacts/new.md', 'content');
    });

    it('should show modal when file exists', async () => {
      mockApp.vault!.adapter!.exists = vi.fn().mockResolvedValue(true);

      await ContactManagerUtils.handleFileCreation(
        mockApp as App, 
        'Contacts/existing.md', 
        'content'
      );

      // FileExistsModal should be created
      const { FileExistsModal } = await import('../../../../src/ui/modals/fileExistsModal');
      expect(FileExistsModal).toHaveBeenCalledWith(
        mockApp,
        'Contacts/existing.md',
        expect.any(Function)
      );
    });
  });

  describe('openFile', () => {
    it('should open file with openLinkText when no current file', async () => {
      const mockFile = { path: 'Contacts/test.md', basename: 'test' } as TFile;
      mockApp.workspace!.getActiveFile = vi.fn().mockReturnValue(null);

      await ContactManagerUtils.openFile(mockApp as App, mockFile);

      expect(mockApp.workspace!.openLinkText).toHaveBeenCalledWith('test.md', '');
    });

    it('should open file with openLinkText when current file is different', async () => {
      const mockFile = { path: 'Contacts/test.md', basename: 'test' } as TFile;
      const mockCurrentFile = { path: 'Contacts/other.md', basename: 'other' } as TFile;
      
      mockApp.workspace!.getActiveFile = vi.fn().mockReturnValue(mockCurrentFile);

      await ContactManagerUtils.openFile(mockApp as App, mockFile);

      expect(mockApp.workspace!.openLinkText).toHaveBeenCalledWith('test.md', 'Contacts/other.md');
    });

    it('should not open file when it is already active', async () => {
      const mockFile = { path: 'Contacts/test.md', basename: 'test' } as TFile;
      mockApp.workspace!.getActiveFile = vi.fn().mockReturnValue(mockFile);

      await ContactManagerUtils.openFile(mockApp as App, mockFile);

      expect(mockApp.workspace!.openLinkText).not.toHaveBeenCalled();
    });
  });

  describe('openCreatedFile', () => {
    it('should open newly created file', async () => {
      const mockFile = { path: 'Contacts/new.md', basename: 'new' } as TFile;
      const mockLeaf = { openFile: vi.fn() };
      
      mockApp.workspace!.getLeaf = vi.fn().mockReturnValue(mockLeaf);

      await ContactManagerUtils.openCreatedFile(mockApp as App, mockFile);

      expect(mockLeaf.openFile).toHaveBeenCalledWith(mockFile, { active: true });
    });

    it('should handle errors when opening created file', async () => {
      const mockFile = { path: 'Contacts/new.md', basename: 'new' } as TFile;
      const mockLeaf = { 
        openFile: vi.fn().mockRejectedValue(new Error('Open failed'))
      };
      
      mockApp.workspace!.getLeaf = vi.fn().mockReturnValue(mockLeaf);

      // Should not throw error
      await expect(ContactManagerUtils.openCreatedFile(mockApp as App, mockFile))
        .resolves.toBeUndefined();
    });
  });

  describe('ensureHasName', () => {
    it('should add default name when FN is missing', async () => {
      const contact: VCardForObsidianRecord = {
        UID: 'test-123',
        EMAIL: 'test@example.com'
      };

      const result = await ContactManagerUtils.ensureHasName(contact);

      expect(result.FN).toBeDefined();
      expect(typeof result.FN).toBe('string');
    });

    it('should preserve existing FN field', async () => {
      const contact: VCardForObsidianRecord = {
        UID: 'test-123',
        FN: 'John Doe',
        EMAIL: 'john@example.com'
      };

      const result = await ContactManagerUtils.ensureHasName(contact);

      expect(result.FN).toBe('John Doe');
    });

    it('should add default name when FN is empty', async () => {
      const contact: VCardForObsidianRecord = {
        UID: 'test-123',
        FN: '',
        EMAIL: 'test@example.com'
      };

      const result = await ContactManagerUtils.ensureHasName(contact);

      expect(result.FN).toBeDefined();
      expect(result.FN).not.toBe('');
    });
  });

  describe('getFrontmatterFromFiles', () => {
    it('should extract frontmatter from multiple files', async () => {
      const mockFiles = [
        { path: 'Contacts/contact1.md', basename: 'contact1' } as TFile,
        { path: 'Contacts/contact2.md', basename: 'contact2' } as TFile
      ];

      mockApp.metadataCache!.getFileCache = vi.fn()
        .mockReturnValueOnce({
          frontmatter: { UID: 'uid-1', FN: 'Contact 1' }
        })
        .mockReturnValueOnce({
          frontmatter: { UID: 'uid-2', FN: 'Contact 2' }
        });

      const contacts = await ContactManagerUtils.getFrontmatterFromFiles(
        mockApp as App, 
        mockFiles
      );

      expect(contacts).toHaveLength(2);
      expect(contacts[0].file).toBe(mockFiles[0]);
      expect(contacts[0].data.UID).toBe('uid-1');
      expect(contacts[1].file).toBe(mockFiles[1]);
      expect(contacts[1].data.UID).toBe('uid-2');
    });

    it('should handle files without frontmatter', async () => {
      const mockFiles = [
        { path: 'Contacts/contact1.md', basename: 'contact1' } as TFile
      ];

      mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue({
        frontmatter: {}
      });

      const contacts = await ContactManagerUtils.getFrontmatterFromFiles(
        mockApp as App, 
        mockFiles
      );

      expect(contacts).toHaveLength(0);
    });

    it('should handle empty file array', async () => {
      const contacts = await ContactManagerUtils.getFrontmatterFromFiles(
        mockApp as App, 
        []
      );

      expect(contacts).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should handle vault errors gracefully in createContactFile', async () => {
      mockApp.vault!.getAbstractFileByPath = vi.fn().mockImplementation(() => {
        throw new Error('Vault error');
      });

      await expect(ContactManagerUtils.createContactFile(
        mockApp as App, 
        'Contacts', 
        'content', 
        'test.md'
      )).resolves.not.toThrow();
    });

    it('should handle file creation errors gracefully', async () => {
      mockApp.vault!.adapter!.exists = vi.fn().mockResolvedValue(false);
      mockApp.vault!.create = vi.fn().mockRejectedValue(new Error('Creation failed'));
      mockApp.workspace!.getActiveFile = vi.fn().mockReturnValue(null);

      await expect(ContactManagerUtils.handleFileCreation(
        mockApp as App, 
        'Contacts/test.md', 
        'content'
      )).resolves.not.toThrow();
    });
  });
});