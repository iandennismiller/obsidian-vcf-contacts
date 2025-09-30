// @vitest-skip - Deprecated: This test was for individual utility modules that have been consolidated into ContactNote
// The functionality tested here is now available via ContactNote.updateFrontmatterValue() and ContactNote.generateRevTimestamp()
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TFile, App } from 'obsidian';

// Mock obsidian
vi.mock('obsidian', () => ({
  parseYaml: vi.fn((content: string) => {
    // Simple YAML parser mock
    const lines = content.split('\n');
    const result: any = {};
    lines.forEach(line => {
      if (line.includes(':')) {
        const [key, value] = line.split(':').map(s => s.trim());
        result[key] = value;
      }
    });
    return result;
  }),
  stringifyYaml: vi.fn((obj: any) => {
    return Object.entries(obj)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
  }),
  TFile: vi.fn(),
  App: vi.fn()
}));

// Mock shared app context
vi.mock('src/plugin/context/sharedAppContext', () => ({
  getApp: vi.fn(() => mockApp)
}));

const mockApp = {
  vault: {
    read: vi.fn(),
    modify: vi.fn()
  }
} as unknown as App;

describe.skip('REV field management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // These functions are no longer exported from src/contacts but are available via ContactNote
  const updateFrontMatterValue = null as any;
  const updateMultipleFrontMatterValues = null as any;
  const generateRevTimestamp = null as any;

  describe('generateRevTimestamp', () => {
    it('should generate timestamp in vCard REV format', () => {
      // Mock Date to return a specific timestamp
      const mockDate = new Date('2025-09-23T23:19:28.000Z');
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate);
      
      const timestamp = generateRevTimestamp();
      expect(timestamp).toBe('20250923T231928Z');
      expect(timestamp).toMatch(/^\d{8}T\d{6}Z$/);
    });
  });

  describe('updateFrontMatterValue', () => {
    it('should update REV field automatically when changing other fields', async () => {
      const mockFile = { path: 'test.md' } as TFile;
      const existingContent = `---\nFN: John Doe\nEMAIL: old@example.com\n---\nSome content`;

      const mockDate = new Date('2025-09-23T23:19:28.000Z');
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate);

      mockApp.vault.read = vi.fn().mockResolvedValue(existingContent);
      mockApp.vault.modify = vi.fn();

      await updateFrontMatterValue(mockFile, 'EMAIL', 'new@example.com', mockApp);

      expect(mockApp.vault.modify).toHaveBeenCalledWith(
        mockFile,
        expect.stringContaining('REV: 20250923T231928Z')
      );
      expect(mockApp.vault.modify).toHaveBeenCalledWith(
        mockFile,
        expect.stringContaining('EMAIL: new@example.com')
      );
    });

    it('should not update file when value has not changed', async () => {
      const mockFile = { path: 'test.md' } as TFile;
      const existingContent = `---\nFN: John Doe\nEMAIL: same@example.com\n---\nSome content`;

      mockApp.vault.read = vi.fn().mockResolvedValue(existingContent);
      mockApp.vault.modify = vi.fn();

      await updateFrontMatterValue(mockFile, 'EMAIL', 'same@example.com', mockApp);

      expect(mockApp.vault.modify).not.toHaveBeenCalled();
    });

    it('should not update REV when updating REV itself', async () => {
      const mockFile = { path: 'test.md' } as TFile;
      const existingContent = `---\nFN: John Doe\nREV: 20250920T120000Z\n---\nSome content`;

      mockApp.vault.read = vi.fn().mockResolvedValue(existingContent);
      mockApp.vault.modify = vi.fn();

      await updateFrontMatterValue(mockFile, 'REV', '20250923T231928Z', mockApp);

      expect(mockApp.vault.modify).toHaveBeenCalledWith(
        mockFile,
        expect.stringContaining('REV: 20250923T231928Z')
      );
      
      // Should not contain duplicate REV fields or recursive updates
      const modifyCall = (mockApp.vault.modify as any).mock.calls[0][1];
      const revCount = (modifyCall.match(/REV:/g) || []).length;
      expect(revCount).toBe(1);
    });

    it('should skip REV update when skipRevUpdate is true', async () => {
      const mockFile = { path: 'test.md' } as TFile;
      const existingContent = `---\nFN: John Doe\nEMAIL: old@example.com\n---\nSome content`;

      mockApp.vault.read = vi.fn().mockResolvedValue(existingContent);
      mockApp.vault.modify = vi.fn();

      await updateFrontMatterValue(mockFile, 'EMAIL', 'new@example.com', mockApp, true);

      expect(mockApp.vault.modify).toHaveBeenCalledWith(
        mockFile,
        expect.stringContaining('EMAIL: new@example.com')
      );
      expect(mockApp.vault.modify).toHaveBeenCalledWith(
        mockFile,
        expect.not.stringContaining('REV:')
      );
    });
  });

  describe('updateMultipleFrontMatterValues', () => {
    it('should update multiple fields with single REV update', async () => {
      const mockFile = { path: 'test.md' } as TFile;
      const existingContent = `---\nFN: John Doe\nEMAIL: old@example.com\nTEL: +1234567890\n---\nSome content`;

      const mockDate = new Date('2025-09-23T23:19:28.000Z');
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate);

      mockApp.vault.read = vi.fn().mockResolvedValue(existingContent);
      mockApp.vault.modify = vi.fn();

      await updateMultipleFrontMatterValues(mockFile, {
        'EMAIL': 'new@example.com',
        'TEL': '+9876543210',
        'ORG': 'New Company'
      }, mockApp);

      expect(mockApp.vault.modify).toHaveBeenCalledTimes(1);
      
      const modifiedContent = (mockApp.vault.modify as any).mock.calls[0][1];
      expect(modifiedContent).toContain('EMAIL: new@example.com');
      expect(modifiedContent).toContain('TEL: +9876543210');
      expect(modifiedContent).toContain('ORG: New Company');
      expect(modifiedContent).toContain('REV: 20250923T231928Z');
      
      // Should only have one REV field
      const revCount = (modifiedContent.match(/REV:/g) || []).length;
      expect(revCount).toBe(1);
    });

    it('should not update file when no values changed', async () => {
      const mockFile = { path: 'test.md' } as TFile;
      const existingContent = `---\nFN: John Doe\nEMAIL: same@example.com\nTEL: +1234567890\n---\nSome content`;

      mockApp.vault.read = vi.fn().mockResolvedValue(existingContent);
      mockApp.vault.modify = vi.fn();

      await updateMultipleFrontMatterValues(mockFile, {
        'EMAIL': 'same@example.com',
        'TEL': '+1234567890'
      }, mockApp);

      expect(mockApp.vault.modify).not.toHaveBeenCalled();
    });

    it('should update only changed values', async () => {
      const mockFile = { path: 'test.md' } as TFile;
      const existingContent = `---\nFN: John Doe\nEMAIL: same@example.com\nTEL: +1234567890\n---\nSome content`;

      const mockDate = new Date('2025-09-23T23:19:28.000Z');
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate);

      mockApp.vault.read = vi.fn().mockResolvedValue(existingContent);
      mockApp.vault.modify = vi.fn();

      await updateMultipleFrontMatterValues(mockFile, {
        'EMAIL': 'same@example.com', // unchanged
        'TEL': '+9876543210'         // changed
      }, mockApp);

      expect(mockApp.vault.modify).toHaveBeenCalledTimes(1);
      
      const modifiedContent = (mockApp.vault.modify as any).mock.calls[0][1];
      expect(modifiedContent).toContain('EMAIL: same@example.com');
      expect(modifiedContent).toContain('TEL: +9876543210');
      expect(modifiedContent).toContain('REV: 20250923T231928Z');
    });
  });
});