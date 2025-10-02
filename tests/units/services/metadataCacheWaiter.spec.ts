import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitForMetadataCache } from '../../../src/plugin/services/metadataCacheWaiter';

describe('metadataCacheWaiter', () => {
  let mockApp: any;
  let getMarkdownFilesMock: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    getMarkdownFilesMock = vi.fn();
    mockApp = {
      vault: {
        getMarkdownFiles: getMarkdownFilesMock
      }
    };
  });

  describe('waitForMetadataCache', () => {
    it('should wait until files are detected in the vault', async () => {
      // Simulate vault being empty initially, then populated
      let callCount = 0;
      getMarkdownFilesMock.mockImplementation(() => {
        callCount++;
        if (callCount < 5) {
          return []; // Empty vault initially
        }
        // After a few calls, return files
        return [
          { path: 'file1.md' },
          { path: 'file2.md' },
          { path: 'file3.md' }
        ];
      });

      const startTime = Date.now();
      await waitForMetadataCache(mockApp);
      const elapsed = Date.now() - startTime;

      // Should have polled multiple times
      expect(getMarkdownFilesMock).toHaveBeenCalled();
      expect(callCount).toBeGreaterThan(3);
      
      // Should have waited at least the stabilization delay (250ms)
      expect(elapsed).toBeGreaterThanOrEqual(250);
    });

    it('should wait for file count to stabilize before resolving', async () => {
      // Simulate vault where file count keeps changing
      let callCount = 0;
      getMarkdownFilesMock.mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return [{ path: 'file1.md' }];
        } else if (callCount < 6) {
          return [{ path: 'file1.md' }, { path: 'file2.md' }];
        } else if (callCount < 9) {
          return [{ path: 'file1.md' }, { path: 'file2.md' }, { path: 'file3.md' }];
        }
        // Stabilized at 3 files
        return [
          { path: 'file1.md' },
          { path: 'file2.md' },
          { path: 'file3.md' }
        ];
      });

      const startTime = Date.now();
      await waitForMetadataCache(mockApp);
      const elapsed = Date.now() - startTime;

      // Should have polled many times to detect stability
      expect(getMarkdownFilesMock).toHaveBeenCalled();
      expect(callCount).toBeGreaterThanOrEqual(9);
      
      // Should have waited at least the stabilization delay
      expect(elapsed).toBeGreaterThanOrEqual(250);
    });

    it('should handle vault with files immediately available', async () => {
      // Simulate vault that's already populated
      getMarkdownFilesMock.mockReturnValue([
        { path: 'file1.md' },
        { path: 'file2.md' },
        { path: 'file3.md' }
      ]);

      const startTime = Date.now();
      await waitForMetadataCache(mockApp);
      const elapsed = Date.now() - startTime;

      // Should still wait for stability checks + stabilization delay
      expect(getMarkdownFilesMock).toHaveBeenCalled();
      expect(elapsed).toBeGreaterThanOrEqual(250);
    });

    it('should handle errors gracefully and continue polling', async () => {
      let callCount = 0;
      getMarkdownFilesMock.mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Vault not ready');
        }
        // After errors, return files
        return [
          { path: 'file1.md' },
          { path: 'file2.md' }
        ];
      });

      await waitForMetadataCache(mockApp);

      // Should have recovered from errors and completed
      expect(getMarkdownFilesMock).toHaveBeenCalled();
      expect(callCount).toBeGreaterThan(3);
    });

    it('should handle vault returning null', async () => {
      let callCount = 0;
      getMarkdownFilesMock.mockImplementation(() => {
        callCount++;
        if (callCount < 5) {
          return null; // Vault not ready
        }
        return [{ path: 'file1.md' }];
      });

      await waitForMetadataCache(mockApp);

      expect(getMarkdownFilesMock).toHaveBeenCalled();
      expect(callCount).toBeGreaterThan(5);
    });

    it('should handle vault returning undefined', async () => {
      let callCount = 0;
      getMarkdownFilesMock.mockImplementation(() => {
        callCount++;
        if (callCount < 5) {
          return undefined; // Vault not ready
        }
        return [{ path: 'file1.md' }];
      });

      await waitForMetadataCache(mockApp);

      expect(getMarkdownFilesMock).toHaveBeenCalled();
      expect(callCount).toBeGreaterThan(5);
    });
  });
});
