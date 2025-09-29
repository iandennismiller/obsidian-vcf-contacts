import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UidProcessor } from "../../../src/curators/uidValidate";
import { RunType } from "../../../src/interfaces";
import { setupCuratorMocks, cleanupCuratorMocks, createMockContact, createMockContactNote } from '../../setup/curatorMocks';
import { sampleContacts } from '../../fixtures/curatorTestData';
import type { Contact } from '../../../src/models/contactNote/types';

// Mock the dependencies
vi.mock('../../../src/context/sharedAppContext', () => ({
  getApp: vi.fn(),
}));

vi.mock('../../../src/context/sharedSettingsContext', () => ({
  getSettings: vi.fn(),
}));

vi.mock('../../../src/models', () => ({
  ContactNote: vi.fn(),
}));

describe('UidProcessor', () => {
  let mockContactNote: ReturnType<typeof createMockContactNote>;
  let mockApp: any;
  let mockSettings: any;

  beforeEach(async () => {
    const mocks = setupCuratorMocks();
    mockContactNote = mocks.mockContactNote;
    mockApp = mocks.mockApp;
    mockSettings = mocks.mockSettings;

    // Setup the mocks for each test
    const appContext = await import('../../../src/context/sharedAppContext');
    const settingsContext = await import('../../../src/context/sharedSettingsContext');
    const models = await import('../../../src/models');
    
    vi.mocked(appContext.getApp).mockReturnValue(mockApp);
    vi.mocked(settingsContext.getSettings).mockReturnValue(mockSettings);
    vi.mocked(models.ContactNote).mockImplementation(() => mockContactNote);
  });

  afterEach(() => {
    cleanupCuratorMocks();
  });

  describe('processor properties', () => {
    it('should have correct processor properties', () => {
      expect(UidProcessor.name).toBe('UidProcessor');
      expect(UidProcessor.runType).toBe(RunType.IMMEDIATELY);
      expect(UidProcessor.settingPropertyName).toBe('UIDProcessor');
      expect(UidProcessor.settingDescription).toContain('Automatically generates a unique identifier');
      expect(UidProcessor.settingDefaultValue).toBe(true);
    });

    it('should have a process function', () => {
      expect(typeof UidProcessor.process).toBe('function');
      expect(UidProcessor.process).toBeDefined();
    });
  });

  describe('process function', () => {
    it('should return undefined when processor is disabled', async () => {
      mockSettings.UIDProcessor = false;
      const contact = createMockContact();

      const result = await UidProcessor.process(contact);

      expect(result).toBeUndefined();
      expect(mockContactNote.updateFrontmatterValue).not.toHaveBeenCalled();
    });

    it('should return undefined when contact already has UID', async () => {
      mockSettings.UIDProcessor = true;
      const contact = createMockContact({
        data: {
          FN: 'John Doe',
          UID: 'existing-uid-123',
          EMAIL: 'john@example.com'
        }
      });

      const result = await UidProcessor.process(contact);

      expect(result).toBeUndefined();
      expect(mockContactNote.updateFrontmatterValue).not.toHaveBeenCalled();
    });

    it('should generate UID for contact without UID', async () => {
      mockSettings.UIDProcessor = true;
      const contact = createMockContact({
        data: {
          FN: 'John Doe',
          EMAIL: 'john@example.com'
          // No UID field
        }
      });

      const result = await UidProcessor.process(contact);

      expect(result).toBeDefined();
      expect(result?.message).toContain('A UID has been generated for contact');
      expect(mockContactNote.updateFrontmatterValue).toHaveBeenCalledWith(
        'UID',
        expect.stringMatching(/^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
      );
    });

    it('should generate valid UUID format', async () => {
      mockSettings.UIDProcessor = true;
      const contact = createMockContact({
        data: { FN: 'John Doe', EMAIL: 'john@example.com' }
      });

      await UidProcessor.process(contact);

      const updateCall = mockContactNote.updateFrontmatterValue.mock.calls[0];
      expect(updateCall[0]).toBe('UID');
      
      const generatedUID = updateCall[1];
      expect(generatedUID).toMatch(/^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      
      // Check UUID version 4 format
      const uuid = generatedUID.replace('urn:uuid:', '');
      expect(uuid[14]).toBe('4'); // Version 4
      expect(['8', '9', 'a', 'b']).toContain(uuid[19]); // Variant bits
    });

    it('should generate unique UIDs for different contacts', async () => {
      mockSettings.UIDProcessor = true;
      const contact1 = createMockContact({
        data: { FN: 'John Doe', EMAIL: 'john@example.com' }
      });
      const contact2 = createMockContact({
        data: { FN: 'Jane Doe', EMAIL: 'jane@example.com' }
      });

      await UidProcessor.process(contact1);
      await UidProcessor.process(contact2);

      const uid1 = mockContactNote.updateFrontmatterValue.mock.calls[0][1];
      const uid2 = mockContactNote.updateFrontmatterValue.mock.calls[1][1];
      
      expect(uid1).not.toBe(uid2);
      expect(uid1).toMatch(/^urn:uuid:/);
      expect(uid2).toMatch(/^urn:uuid:/);
    });

    it('should handle updateFrontmatterValue errors gracefully', async () => {
      mockSettings.UIDProcessor = true;
      mockContactNote.updateFrontmatterValue.mockRejectedValue(new Error('Update failed'));
      
      const contact = createMockContact({
        data: { FN: 'John Doe', EMAIL: 'john@example.com' }
      });

      // Should not throw, but may return undefined or handle error internally
      await expect(UidProcessor.process(contact)).resolves.not.toThrow();
    });
  });

  describe('result formatting', () => {
    it('should return proper CuratorQueItem structure', async () => {
      mockSettings.UIDProcessor = true;
      const contact = createMockContact({
        data: { FN: 'John Doe', EMAIL: 'john@example.com' }
      });

      const result = await UidProcessor.process(contact);

      expect(result).toMatchObject({
        name: 'UidProcessor',
        runType: RunType.IMMEDIATELY,
        file: contact.file,
        message: expect.stringContaining('A UID has been generated'),
        render: expect.any(Function),
        renderGroup: expect.any(Function)
      });
    });

    it('should include contact file name in message', async () => {
      mockSettings.UIDProcessor = true;
      const contact = createMockContact({
        data: { FN: 'John Doe', EMAIL: 'john@example.com' }
      });

      const result = await UidProcessor.process(contact);

      expect(result?.message).toContain(contact.file.name);
    });
  });

  describe('edge cases', () => {
    it('should handle contact with empty UID string', async () => {
      mockSettings.UIDProcessor = true;
      const contact = createMockContact({
        data: {
          FN: 'John Doe',
          UID: '', // Empty string should be treated as missing
          EMAIL: 'john@example.com'
        }
      });

      const result = await UidProcessor.process(contact);

      // This depends on implementation - empty string might be considered as "has UID"
      // Based on the source code: contact.data["UID"] would be truthy for empty string
      // so it should return undefined
      expect(result).toBeUndefined();
    });

    it('should handle contact with null UID', async () => {
      mockSettings.UIDProcessor = true;
      const contact = createMockContact({
        data: {
          FN: 'John Doe',
          UID: null,
          EMAIL: 'john@example.com'
        }
      });

      const result = await UidProcessor.process(contact);

      // null is falsy, so should generate UID
      expect(result).toBeDefined();
      expect(mockContactNote.updateFrontmatterValue).toHaveBeenCalled();
    });

    it('should handle contact with undefined UID', async () => {
      mockSettings.UIDProcessor = true;
      const contact = createMockContact({
        data: {
          FN: 'John Doe',
          EMAIL: 'john@example.com'
          // UID is undefined (not present)
        }
      });

      const result = await UidProcessor.process(contact);

      expect(result).toBeDefined();
      expect(mockContactNote.updateFrontmatterValue).toHaveBeenCalled();
    });
  });

  describe('UUID generation', () => {
    it('should generate different UIDs in rapid succession', async () => {
      mockSettings.UIDProcessor = true;
      const contact = createMockContact({
        data: { FN: 'John Doe', EMAIL: 'john@example.com' }
      });

      // Generate multiple UIDs quickly
      const promises = Array.from({ length: 10 }, () => UidProcessor.process(contact));
      await Promise.all(promises);

      const generatedUIDs = mockContactNote.updateFrontmatterValue.mock.calls.map(call => call[1]);
      const uniqueUIDs = new Set(generatedUIDs);
      
      expect(uniqueUIDs.size).toBe(generatedUIDs.length); // All should be unique
    });

    it('should include timestamp in UUID for ordering', async () => {
      mockSettings.UIDProcessor = true;
      const contact = createMockContact({
        data: { FN: 'John Doe', EMAIL: 'john@example.com' }
      });

      const beforeTime = Date.now();
      await UidProcessor.process(contact);
      const afterTime = Date.now();

      const generatedUID = mockContactNote.updateFrontmatterValue.mock.calls[0][1];
      const uuid = generatedUID.replace('urn:uuid:', '');
      
      // Extract timestamp from first 12 characters (hex encoded)
      const timestampHex = uuid.substring(0, 12);
      const timestamp = parseInt(timestampHex, 16);
      
      expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp).toBeLessThanOrEqual(afterTime);
    });
  });
});