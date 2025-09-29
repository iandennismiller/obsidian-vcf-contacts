import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConsistencyOperations } from '../../../../src/models/contactManager/consistencyOperations';
import { ContactManagerData } from '../../../../src/models/contactManager/contactManagerData';
import { TFile } from 'obsidian';

// Mock dependencies
vi.mock('../../../../src/context/sharedSettingsContext', () => ({
  getSettings: vi.fn(() => ({
    vcardSyncPostProcessor: true
  })),
  updateSettings: vi.fn()
}));

vi.mock('../../../../src/models/curatorManager/curatorManager', () => ({
  curatorService: {
    process: vi.fn().mockResolvedValue(undefined)
  }
}));

vi.mock('../../../../src/models/contactNote', () => ({
  ContactNote: vi.fn().mockImplementation(() => ({
    getFrontmatter: vi.fn(),
    syncFrontmatterToRelatedList: vi.fn(),
    syncRelatedListToFrontmatter: vi.fn()
  }))
}));

describe('ConsistencyOperations', () => {
  let mockContactManagerData: Partial<ContactManagerData>;
  let consistencyOperations: ConsistencyOperations;
  let mockFiles: TFile[];

  beforeEach(() => {
    vi.clearAllMocks();

    mockFiles = [
      { 
        basename: 'contact1', 
        path: 'Contacts/contact1.md',
        name: 'contact1.md'
      } as TFile,
      { 
        basename: 'contact2', 
        path: 'Contacts/contact2.md',
        name: 'contact2.md'
      } as TFile
    ];

    mockContactManagerData = {
      getAllContactFiles: vi.fn().mockReturnValue(mockFiles),
      extractUIDFromFile: vi.fn().mockResolvedValue('test-uid-123'),
      getApp: vi.fn().mockReturnValue({
        metadataCache: {
          getFileCache: vi.fn().mockReturnValue({
            frontmatter: { 
              UID: 'test-uid',
              REV: '20240101T120000Z',
              FN: 'Test Contact' 
            }
          })
        }
      }),
      getSettings: vi.fn().mockReturnValue({
        vcardSyncPostProcessor: true
      })
    };

    consistencyOperations = new ConsistencyOperations(mockContactManagerData as ContactManagerData);
  });

  describe('constructor', () => {
    it('should initialize with ContactManagerData', () => {
      expect(consistencyOperations).toBeDefined();
    });
  });

  describe('ensureContactDataConsistency', () => {
    it('should process all contact files for consistency', async () => {
      const { curatorService } = await import('../../../../src/models/curatorManager/curatorManager');
      vi.mocked(curatorService.process).mockResolvedValue(undefined);

      await consistencyOperations.ensureContactDataConsistency(5);

      expect(mockContactManagerData.getAllContactFiles).toHaveBeenCalled();
      expect(curatorService.process).toHaveBeenCalled();
    });

    it('should handle empty contact list', async () => {
      mockContactManagerData.getAllContactFiles = vi.fn().mockReturnValue([]);

      await expect(consistencyOperations.ensureContactDataConsistency())
        .resolves.not.toThrow();

      expect(mockContactManagerData.getAllContactFiles).toHaveBeenCalled();
    });

    it('should limit iterations to prevent infinite loops', async () => {
      const { curatorService } = await import('../../../../src/models/curatorManager/curatorManager');
      // Mock service to always return changes to test iteration limit
      curatorService.process = vi.fn().mockResolvedValue([
        { file: mockFiles[0], results: ['changed'] }
      ]);

      await consistencyOperations.ensureContactDataConsistency(2);

      // Should not exceed max iterations (3 calls per iteration + 1 final call)
      expect(curatorService.process).toHaveBeenCalledTimes(4);
    });

    it('should stop when no more changes are detected', async () => {
      const { curatorService } = await import('../../../../src/models/curatorManager/curatorManager');
      curatorService.process = vi.fn()
        .mockResolvedValueOnce([
          { file: mockFiles[0], results: ['changed'] }
        ])
        .mockResolvedValueOnce([]); // No changes on second iteration

      await consistencyOperations.ensureContactDataConsistency(5);

      expect(curatorService.process).toHaveBeenCalledTimes(4);
    });

    it('should handle curator service errors gracefully', async () => {
      const { curatorService } = await import('../../../../src/models/curatorManager/curatorManager');
      curatorService.process = vi.fn().mockRejectedValue(new Error('Service error'));

      await expect(consistencyOperations.ensureContactDataConsistency())
        .resolves.not.toThrow();
    });
  });

  describe('createContactTaskList', () => {
    it('should create task list from contact files', async () => {
      const mockApp = {
        metadataCache: {
          getFileCache: vi.fn().mockReturnValue({
            frontmatter: { 
              UID: 'test-uid',
              REV: '20240101T120000Z',
              FN: 'Test Contact' 
            }
          })
        }
      };
      
      mockContactManagerData.getApp = vi.fn().mockReturnValue(mockApp);

      // Access private method through any cast for testing
      const taskList = await (consistencyOperations as any).createContactTaskList(mockFiles);

      expect(taskList).toHaveLength(mockFiles.length);
      expect(taskList[0]).toHaveProperty('file');
      expect(taskList[0]).toHaveProperty('revTimestamp');
    });

    it('should handle files without frontmatter', async () => {
      const mockApp = {
        metadataCache: {
          getFileCache: vi.fn().mockReturnValue(null)
        }
      };
      
      mockContactManagerData.getApp = vi.fn().mockReturnValue(mockApp);

      const taskList = await (consistencyOperations as any).createContactTaskList(mockFiles);

      expect(taskList).toHaveLength(mockFiles.length);
      expect(taskList[0].revTimestamp).toBe(0); // Default for missing REV
    });

    it('should handle files with invalid REV field', async () => {
      const mockApp = {
        metadataCache: {
          getFileCache: vi.fn().mockReturnValue({
            frontmatter: { 
              UID: 'test-uid',
              REV: 'invalid-date',
              FN: 'Test Contact' 
            }
          })
        }
      };
      
      mockContactManagerData.getApp = vi.fn().mockReturnValue(mockApp);

      const taskList = await (consistencyOperations as any).createContactTaskList(mockFiles);

      expect(taskList[0].revTimestamp).toBe(0); // Default for invalid REV
    });
  });

  describe('processContactsWithInsights', () => {
    it('should process contacts through curator service', async () => {
      const { curatorService } = await import('../../../../src/models/curatorManager/curatorManager');
      const mockTaskList = [
        { file: mockFiles[0], revTimestamp: 1234567890 },
        { file: mockFiles[1], revTimestamp: 1234567891 }
      ];

      curatorService.process = vi.fn().mockResolvedValue([]);

      const result = await (consistencyOperations as any).processContactsWithInsights(mockTaskList);

      expect(curatorService.process).toHaveBeenCalledWith(
        expect.any(Array), // contacts array
        expect.any(String) // RunType.IMMEDIATELY
      );
      expect(result).toEqual([]);
    });

    it('should handle curator service failures', async () => {
      const { curatorService } = await import('../../../../src/models/curatorManager/curatorManager');
      const mockTaskList = [
        { file: mockFiles[0], revTimestamp: 1234567890 }
      ];

      curatorService.process = vi.fn().mockRejectedValue(new Error('Curator error'));

      const result = await (consistencyOperations as any).processContactsWithInsights(mockTaskList);

      expect(result).toEqual([]);
    });
  });

  describe('extractFrontmatterFromFiles', () => {
    it('should extract frontmatter from all files', async () => {
      const mockApp = {
        metadataCache: {
          getFileCache: vi.fn().mockReturnValue({
            frontmatter: { 
              UID: 'test-uid',
              FN: 'Test Contact' 
            }
          })
        }
      };
      
      mockContactManagerData.getApp = vi.fn().mockReturnValue(mockApp);

      const contacts = await (consistencyOperations as any).extractFrontmatterFromFiles(mockFiles);

      expect(contacts).toHaveLength(mockFiles.length);
      expect(contacts[0].file).toBe(mockFiles[0]);
      expect(contacts[0].data.UID).toBe('test-uid');
    });

    it('should provide empty frontmatter for files without metadata', async () => {
      const mockApp = {
        metadataCache: {
          getFileCache: vi.fn().mockReturnValue(null)
        }
      };
      
      mockContactManagerData.getApp = vi.fn().mockReturnValue(mockApp);

      const contacts = await (consistencyOperations as any).extractFrontmatterFromFiles(mockFiles);

      expect(contacts).toHaveLength(mockFiles.length);
      expect(contacts[0].data).toEqual({});
    });
  });

  describe('settings management during consistency check', () => {
    it('should temporarily disable vcardSyncPostProcessor', async () => {
      const { getSettings, updateSettings } = await import('../../../../src/context/sharedSettingsContext');
      const { curatorService } = await import('../../../../src/models/curatorManager/curatorManager');
      
      curatorService.process = vi.fn().mockResolvedValue([]);

      await consistencyOperations.ensureContactDataConsistency();

      // Should have temporarily disabled the post processor
      expect(updateSettings).toHaveBeenCalledWith({ vcardSyncPostProcessor: false });
      // Should have restored it afterwards
      expect(updateSettings).toHaveBeenCalledWith({ vcardSyncPostProcessor: true });
    });

    it('should restore settings even if processing fails', async () => {
      const { updateSettings } = await import('../../../../src/context/sharedSettingsContext');
      const { curatorService } = await import('../../../../src/models/curatorManager/curatorManager');
      
      curatorService.process = vi.fn().mockRejectedValue(new Error('Processing failed'));

      await consistencyOperations.ensureContactDataConsistency();

      // Should still restore settings despite error
      expect(updateSettings).toHaveBeenCalledWith({ vcardSyncPostProcessor: true });
    });
  });

  describe('error resilience', () => {
    it('should handle ContactManagerData errors', async () => {
      mockContactManagerData.getAllContactFiles = vi.fn().mockImplementation(() => {
        throw new Error('Data access error');
      });

      await expect(consistencyOperations.ensureContactDataConsistency())
        .resolves.not.toThrow();
    });

    it('should handle app context errors', async () => {
      mockContactManagerData.getApp = vi.fn().mockImplementation(() => {
        throw new Error('App context error');
      });

      await expect(consistencyOperations.ensureContactDataConsistency())
        .resolves.not.toThrow();
    });
  });
});