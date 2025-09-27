import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VcfSyncPreProcessor } from '../src/insights/processors/VcfSyncPreProcessor';
import { Contact } from '../src/contacts/contactNote';
import { RunType } from '../src/insights/insight.d';

// Mock the dependencies
vi.mock('../src/context/sharedAppContext', () => ({
  getApp: vi.fn(() => ({
    metadataCache: {
      getFileCache: vi.fn(() => ({ frontmatter: {} }))
    }
  }))
}));

vi.mock('../src/context/sharedSettingsContext', () => ({
  getSettings: vi.fn(() => ({
    vcfSyncPreProcessor: true,
    vcfWatchEnabled: true,
    vcfWatchFolder: '/test/vcf'
  }))
}));

vi.mock('../src/contacts/vcfManager', () => ({
  VCFManager: vi.fn().mockImplementation(() => ({
    watchFolderExists: vi.fn(() => Promise.resolve(true)),
    findVCFFileByUID: vi.fn(() => Promise.resolve(null)),
    shouldIgnoreFile: vi.fn(() => false),
    readAndParseVCF: vi.fn(() => Promise.resolve([]))
  }))
}));

vi.mock('../src/contacts/contactNote', () => ({
  ContactNote: vi.fn().mockImplementation(() => ({
    shouldUpdateFromVCF: vi.fn(() => Promise.resolve(false)),
    mdRender: vi.fn(() => '---\nN.GN: Test\n---\n'),
    getFrontmatter: vi.fn(() => Promise.resolve({})),
    updateMultipleFrontmatterValues: vi.fn(() => Promise.resolve())
  }))
}));

vi.mock('../src/services/loggingService', () => ({
  loggingService: {
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe('VcfSyncPreProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct processor properties', () => {
    expect(VcfSyncPreProcessor.name).toBe('VcfSyncPreProcessor');
    expect(VcfSyncPreProcessor.runType).toBe(RunType.IMMEDIATELY);
    expect(VcfSyncPreProcessor.settingPropertyName).toBe('vcfSyncPreProcessor');
    expect(VcfSyncPreProcessor.settingDefaultValue).toBe(true);
  });

  it('should return undefined when processor is disabled', async () => {
    // Mock settings to disable processor
    const mockContact: Contact = {
      data: { UID: 'test-uid' },
      file: { name: 'test.md' } as any
    };

    // Override settings mock for this test
    vi.doMock('../src/context/sharedSettingsContext', () => ({
      getSettings: vi.fn(() => ({
        vcfSyncPreProcessor: false,
        vcfWatchEnabled: true
      }))
    }));

    const result = await VcfSyncPreProcessor.process(mockContact);
    expect(result).toBeUndefined();
  });

  it('should return undefined when VCF watch is disabled', async () => {
    const mockContact: Contact = {
      data: { UID: 'test-uid' },
      file: { name: 'test.md' } as any
    };

    // Override settings mock for this test
    vi.doMock('../src/context/sharedSettingsContext', () => ({
      getSettings: vi.fn(() => ({
        vcfSyncPreProcessor: true,
        vcfWatchEnabled: false
      }))
    }));

    const result = await VcfSyncPreProcessor.process(mockContact);
    expect(result).toBeUndefined();
  });

  it('should return undefined when contact has no UID', async () => {
    const mockContact: Contact = {
      data: {},
      file: { name: 'test.md' } as any
    };

    const result = await VcfSyncPreProcessor.process(mockContact);
    expect(result).toBeUndefined();
  });
});