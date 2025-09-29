import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CuratorManager, curatorService } from '../../../src/models/curatorManager/curatorManager';
import { RunType } from "../../../src/interfaces/curatorManager.d";

// Mock dependencies
const mockApp = {
  workspace: {
    getActiveFile: vi.fn()
  }
} as any;

const mockSettings = {
  contactsFolder: 'Contacts'
} as any;

const mockContactManager = {
  getContactByFile: vi.fn(),
  getAllContactFiles: vi.fn()
} as any;

const mockPlugin = {
  addCommand: vi.fn()
} as any;

// Mock Notice for command tests
vi.mock('obsidian', () => ({
  Notice: vi.fn()
}));

// Mock processor for testing
const mockProcessor = {
  name: 'TestProcessor',
  runType: RunType.IMMEDIATELY,
  settingPropertyName: 'testProcessor',
  settingDescription: 'Test processor for unit testing',
  settingDefaultValue: true,
  process: vi.fn().mockResolvedValue(undefined)
};

const mockProcessorWithResult = {
  name: 'ProcessorWithResult',
  runType: RunType.INPROVEMENT,
  settingPropertyName: 'processorWithResult',
  settingDescription: 'Processor that returns results',
  settingDefaultValue: true,
  process: vi.fn().mockResolvedValue({
    name: 'ProcessorWithResult',
    runType: RunType.INPROVEMENT,
    file: { path: 'test.md' },
    message: 'Test result',
    render: vi.fn(),
    renderGroup: vi.fn()
  })
};

describe('CuratorManager', () => {
  let curatorManager: CuratorManager;

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear processors between tests
    (curatorService as any)._clearProcessors();
    curatorManager = new CuratorManager(mockApp, mockSettings, mockContactManager);
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with required dependencies', () => {
      expect(curatorManager).toBeDefined();
      expect(curatorManager).toBeInstanceOf(CuratorManager);
    });
  });

  describe('Processor Registration', () => {
    it('should register processors correctly', () => {
      expect(() => curatorManager.register(mockProcessor)).not.toThrow();
    });

    it('should register multiple processors', () => {
      expect(() => {
        curatorManager.register(mockProcessor);
        curatorManager.register(mockProcessorWithResult);
      }).not.toThrow();
    });

    it('should provide settings for registered processors', () => {
      curatorManager.register(mockProcessor);
      const settings = curatorManager.settings();
      
      expect(settings).toBeInstanceOf(Array);
      const testProcessorSetting = settings.find(s => s.name === 'TestProcessor');
      expect(testProcessorSetting).toBeDefined();
      expect(testProcessorSetting?.settingPropertyName).toBe('testProcessor');
      expect(testProcessorSetting?.settingDescription).toBe('Test processor for unit testing');
      expect(testProcessorSetting?.settingDefaultValue).toBe(true);
      expect(testProcessorSetting?.runType).toBe(RunType.IMMEDIATELY);
    });

    it('should support different run types', () => {
      curatorManager.register(mockProcessor); // IMMEDIATELY
      curatorManager.register(mockProcessorWithResult); // INPROVEMENT
      
      const settings = curatorManager.settings();
      expect(settings.some(s => s.runType === RunType.IMMEDIATELY)).toBe(true);
      expect(settings.some(s => s.runType === RunType.INPROVEMENT)).toBe(true);
    });
  });

  describe('Contact Processing', () => {
    const mockContact = {
      data: { FN: 'Test Contact' },
      file: { path: 'test.md' }
    };

    it('should process single contact', async () => {
      curatorManager.register(mockProcessorWithResult);
      const results = await curatorManager.process(mockContact, RunType.INPROVEMENT);
      
      expect(results).toBeInstanceOf(Array);
      expect(mockProcessorWithResult.process).toHaveBeenCalledWith(mockContact);
    });

    it('should process array of contacts', async () => {
      curatorManager.register(mockProcessorWithResult);
      const contacts = [mockContact, { ...mockContact, data: { FN: 'Contact 2' } }];
      const results = await curatorManager.process(contacts, RunType.INPROVEMENT);
      
      expect(results).toBeInstanceOf(Array);
      expect(mockProcessorWithResult.process).toHaveBeenCalledTimes(2);
    });

    it('should filter out undefined results', async () => {
      curatorManager.register(mockProcessor); // This returns undefined
      const results = await curatorManager.process(mockContact, RunType.IMMEDIATELY);
      
      // mockProcessor returns undefined, so results should be empty
      expect(results).toEqual([]);
    });

    it('should return actual results when processors produce them', async () => {
      curatorManager.register(mockProcessorWithResult);
      const results = await curatorManager.process(mockContact, RunType.INPROVEMENT);
      
      expect(results.length).toBe(1);
      expect(results[0]).toHaveProperty('name', 'ProcessorWithResult');
      expect(results[0]).toHaveProperty('message', 'Test result');
    });

    it('should only run processors matching the specified run type', async () => {
      curatorManager.register(mockProcessor); // IMMEDIATELY
      curatorManager.register(mockProcessorWithResult); // INPROVEMENT
      
      await curatorManager.process(mockContact, RunType.IMMEDIATELY);
      
      // Only mockProcessor (IMMEDIATELY) should be called
      expect(mockProcessor.process).toHaveBeenCalledWith(mockContact);
      expect(mockProcessorWithResult.process).not.toHaveBeenCalled();
    });
  });

  describe('Command Registration', () => {
    it('should register curator processor commands', () => {
      curatorManager.registerCommands(mockPlugin);
      
      expect(mockPlugin.addCommand).toHaveBeenCalledTimes(2);
      expect(mockPlugin.addCommand).toHaveBeenCalledWith({
        id: 'run-curator-processors-current',
        name: "Run curator processors on current contact",
        callback: expect.any(Function)
      });
      expect(mockPlugin.addCommand).toHaveBeenCalledWith({
        id: 'run-curator-processors-all',
        name: "Run curator processors on all contacts",
        callback: expect.any(Function)
      });
    });

    it('should handle command callbacks', () => {
      curatorManager.registerCommands(mockPlugin);
      
      const commands = mockPlugin.addCommand.mock.calls;
      expect(commands[0][0].callback).toBeInstanceOf(Function);
      expect(commands[1][0].callback).toBeInstanceOf(Function);
    });
  });

  describe('Run Curator Processors on Current Contact', () => {
    it('should handle no active file', async () => {
      mockApp.workspace.getActiveFile.mockReturnValue(null);
      
      await curatorManager.runCuratorProcessorsOnCurrent();
      
      expect(mockApp.workspace.getActiveFile).toHaveBeenCalled();
      // Should exit early, no further processing
      expect(mockContactManager.getContactByFile).not.toHaveBeenCalled();
    });

    it('should handle file not in contacts folder', async () => {
      const mockFile = { path: 'Other/file.md' };
      mockApp.workspace.getActiveFile.mockReturnValue(mockFile);
      
      await curatorManager.runCuratorProcessorsOnCurrent();
      
      expect(mockContactManager.getContactByFile).not.toHaveBeenCalled();
    });

    it('should process file in contacts folder', async () => {
      const mockFile = { path: 'Contacts/contact.md', name: 'contact.md' };
      const mockContact = { data: { FN: 'Test' }, file: mockFile };
      
      mockApp.workspace.getActiveFile.mockReturnValue(mockFile);
      mockContactManager.getContactByFile.mockResolvedValue(mockContact);
      
      // Register a processor that returns results
      curatorManager.register(mockProcessorWithResult);
      
      await curatorManager.runCuratorProcessorsOnCurrent();
      
      expect(mockContactManager.getContactByFile).toHaveBeenCalledWith(mockFile);
    });

    it('should handle contact loading failure', async () => {
      const mockFile = { path: 'Contacts/contact.md' };
      mockApp.workspace.getActiveFile.mockReturnValue(mockFile);
      mockContactManager.getContactByFile.mockResolvedValue(null);
      
      await curatorManager.runCuratorProcessorsOnCurrent();
      
      expect(mockContactManager.getContactByFile).toHaveBeenCalledWith(mockFile);
    });

    it('should handle processing errors gracefully', async () => {
      const mockFile = { path: 'Contacts/contact.md' };
      const mockContact = { data: { FN: 'Test' }, file: mockFile };
      
      mockApp.workspace.getActiveFile.mockReturnValue(mockFile);
      mockContactManager.getContactByFile.mockRejectedValue(new Error('Test error'));
      
      // Should not throw
      await expect(curatorManager.runCuratorProcessorsOnCurrent()).resolves.not.toThrow();
    });
  });

  describe('Run Curator Processors on All Contacts', () => {
    it('should process all contact files', async () => {
      const mockFiles = [
        { path: 'Contacts/contact1.md', name: 'contact1.md' },
        { path: 'Contacts/contact2.md', name: 'contact2.md' }
      ];
      const mockContacts = [
        { data: { FN: 'Contact 1' }, file: mockFiles[0] },
        { data: { FN: 'Contact 2' }, file: mockFiles[1] }
      ];
      
      mockContactManager.getAllContactFiles.mockReturnValue(mockFiles);
      mockContactManager.getContactByFile
        .mockResolvedValueOnce(mockContacts[0])
        .mockResolvedValueOnce(mockContacts[1]);
      
      curatorManager.register(mockProcessorWithResult);
      
      await curatorManager.runCuratorProcessorsOnAll();
      
      expect(mockContactManager.getAllContactFiles).toHaveBeenCalled();
      expect(mockContactManager.getContactByFile).toHaveBeenCalledTimes(2);
    });

    it('should handle individual contact processing errors', async () => {
      const mockFiles = [
        { path: 'Contacts/contact1.md', name: 'contact1.md' },
        { path: 'Contacts/contact2.md', name: 'contact2.md' }
      ];
      
      mockContactManager.getAllContactFiles.mockReturnValue(mockFiles);
      mockContactManager.getContactByFile
        .mockRejectedValueOnce(new Error('Error on contact 1'))
        .mockResolvedValueOnce({ data: { FN: 'Contact 2' }, file: mockFiles[1] });
      
      // Should not throw and continue processing
      await expect(curatorManager.runCuratorProcessorsOnAll()).resolves.not.toThrow();
      expect(mockContactManager.getContactByFile).toHaveBeenCalledTimes(2);
    });

    it('should handle overall processing errors gracefully', async () => {
      mockContactManager.getAllContactFiles.mockImplementation(() => {
        throw new Error('Failed to get contact files');
      });
      
      // Should not throw
      await expect(curatorManager.runCuratorProcessorsOnAll()).resolves.not.toThrow();
    });

    it('should skip null contacts', async () => {
      const mockFiles = [{ path: 'Contacts/contact1.md', name: 'contact1.md' }];
      
      mockContactManager.getAllContactFiles.mockReturnValue(mockFiles);
      mockContactManager.getContactByFile.mockResolvedValue(null);
      
      curatorManager.register(mockProcessorWithResult);
      
      await curatorManager.runCuratorProcessorsOnAll();
      
      expect(mockContactManager.getContactByFile).toHaveBeenCalledWith(mockFiles[0]);
      // Processing should continue even with null contact
    });
  });

  describe('Curator Service (Singleton)', () => {
    it('should provide service methods', () => {
      expect(typeof curatorService.register).toBe('function');
      expect(typeof curatorService.process).toBe('function');
      expect(typeof curatorService.settings).toBe('function');
    });

    it('should register processors in service', () => {
      expect(() => curatorService.register(mockProcessor)).not.toThrow();
      
      const settings = curatorService.settings();
      expect(settings.some(s => s.name === 'TestProcessor')).toBe(true);
    });

    it('should process contacts via service', async () => {
      const mockContact = { data: { FN: 'Test' }, file: { path: 'test.md' } };
      
      curatorService.register(mockProcessorWithResult);
      const results = await curatorService.process(mockContact, RunType.INPROVEMENT);
      
      expect(results).toBeInstanceOf(Array);
      expect(mockProcessorWithResult.process).toHaveBeenCalledWith(mockContact);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle processor that throws error', async () => {
      const errorProcessor = {
        ...mockProcessor,
        name: 'ErrorProcessor',
        process: vi.fn().mockRejectedValue(new Error('Processing failed'))
      };
      
      curatorManager.register(errorProcessor);
      
      // Should handle error gracefully
      await expect(curatorManager.process(
        { data: { FN: 'Test' }, file: { path: 'test.md' } }, 
        RunType.IMMEDIATELY
      )).rejects.toThrow('Processing failed');
    });

    it('should return empty settings when no processors registered', () => {
      const newManager = new CuratorManager(mockApp, mockSettings, mockContactManager);
      const settings = newManager.settings();
      
      expect(settings).toEqual([]);
    });

    it('should handle empty contact array', async () => {
      const results = await curatorManager.process([], RunType.IMMEDIATELY);
      
      expect(results).toEqual([]);
    });
  });
});