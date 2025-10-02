import { App } from 'obsidian';

/**
 * Waits for the Obsidian metadata cache to be fully populated.
 * 
 * When Obsidian starts up, the metadata cache may not be ready immediately.
 * This function polls the cache until it detects that files are being indexed,
 * then waits a bit longer to ensure the cache is stable.
 * 
 * The polling strategy:
 * 1. Poll every 10ms to check if metadata cache is returning data
 * 2. Once we detect that the cache is populating (file count > 0), wait 250ms
 * 3. Return control to allow initialization to proceed
 * 
 * This runs asynchronously and doesn't block Obsidian from loading.
 * 
 * @param app - The Obsidian App instance
 * @returns Promise that resolves when the metadata cache is ready
 */
export async function waitForMetadataCache(app: App): Promise<void> {
  return new Promise((resolve) => {
    const pollInterval = 10; // ms
    const stabilizationDelay = 250; // ms
    
    let previousFileCount = 0;
    let stableCount = 0;
    const requiredStableChecks = 3; // Number of times file count must be stable
    
    const checkCache = () => {
      try {
        // Get all markdown files to see if the vault is accessible
        const allFiles = app.vault.getMarkdownFiles();
        const fileCount = allFiles ? allFiles.length : 0;
        
        if (fileCount > 0) {
          // We have files, check if the cache is stable
          if (fileCount === previousFileCount) {
            stableCount++;
            if (stableCount >= requiredStableChecks) {
              // Cache appears stable, wait a bit longer and then resolve
              console.debug(`[MetadataCacheWaiter] Metadata cache stable with ${fileCount} files, waiting ${stabilizationDelay}ms before proceeding`);
              setTimeout(() => {
                console.debug('[MetadataCacheWaiter] Metadata cache ready');
                resolve();
              }, stabilizationDelay);
              return;
            }
          } else {
            // File count changed, reset stability counter
            stableCount = 0;
          }
          previousFileCount = fileCount;
        }
        
        // Continue polling
        setTimeout(checkCache, pollInterval);
      } catch (error: any) {
        console.debug(`[MetadataCacheWaiter] Error checking metadata cache: ${error.message}`);
        // Continue polling even on error
        setTimeout(checkCache, pollInterval);
      }
    };
    
    // Start polling
    console.debug('[MetadataCacheWaiter] Waiting for metadata cache to be ready...');
    checkCache();
  });
}
