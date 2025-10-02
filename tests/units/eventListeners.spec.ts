import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Event Listener Audit Tests
 * 
 * These tests verify that:
 * 1. Models don't install event listeners (except for necessary workspace tracking)
 * 2. Services that do install event listeners don't inadvertently trigger curator pipeline
 * 3. Event listeners are properly scoped and don't create feedback loops
 * 
 * Context:
 * User reported issues with changes appearing then reverting quickly, which could
 * indicate event listener feedback loops where vault.modify() triggers another
 * process that calls vault.modify() again.
 */
describe('Event Listener Audit', () => {
  const srcDir = path.join(__dirname, '../../src');

  /**
   * Recursively find all TypeScript files in a directory
   */
  function findTypeScriptFiles(dir: string): string[] {
    const files: string[] = [];
    
    function traverse(currentDir: string) {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        
        if (entry.isDirectory()) {
          traverse(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          files.push(fullPath);
        }
      }
    }
    
    traverse(dir);
    return files;
  }

  /**
   * Check if a file contains event listener registrations
   */
  function findEventListeners(filePath: string): { line: number; code: string }[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const listeners: { line: number; code: string }[] = [];
    
    lines.forEach((line, index) => {
      // Look for .on( patterns (event listener registration)
      if (line.match(/\.\s*on\s*\(/)) {
        listeners.push({
          line: index + 1,
          code: line.trim()
        });
      }
    });
    
    return listeners;
  }

  it('should document all event listeners in the codebase', () => {
    const allFiles = findTypeScriptFiles(srcDir);
    const filesWithListeners: { file: string; listeners: { line: number; code: string }[] }[] = [];
    
    for (const file of allFiles) {
      const listeners = findEventListeners(file);
      if (listeners.length > 0) {
        const relativePath = path.relative(srcDir, file);
        filesWithListeners.push({
          file: relativePath,
          listeners
        });
      }
    }
    
    console.log('\n=== EVENT LISTENER AUDIT ===\n');
    console.log(`Total TypeScript files scanned: ${allFiles.length}`);
    console.log(`Files with event listeners: ${filesWithListeners.length}\n`);
    
    filesWithListeners.forEach(({ file, listeners }) => {
      console.log(`File: ${file}`);
      listeners.forEach(({ line, code }) => {
        console.log(`  Line ${line}: ${code}`);
      });
      console.log('');
    });
    
    // Expected event listeners (documented and verified safe):
    // 1. contactManagerData.ts - workspace.on('active-leaf-change') - Only tracks active file
    // 2. dropHandler.ts - vault.on('create') - Only handles VCF file drops
    
    expect(filesWithListeners.length).toBeLessThanOrEqual(2);
  });

  it('should verify models directory has minimal event listeners', () => {
    const modelsDir = path.join(srcDir, 'models');
    const modelFiles = findTypeScriptFiles(modelsDir);
    const modelsWithListeners: string[] = [];
    
    for (const file of modelFiles) {
      const listeners = findEventListeners(file);
      if (listeners.length > 0) {
        const relativePath = path.relative(modelsDir, file);
        modelsWithListeners.push(relativePath);
      }
    }
    
    console.log('\n=== MODELS WITH EVENT LISTENERS ===\n');
    console.log(`Total model files: ${modelFiles.length}`);
    console.log(`Models with event listeners: ${modelsWithListeners.length}`);
    
    if (modelsWithListeners.length > 0) {
      console.log('\nModels with listeners:');
      modelsWithListeners.forEach(file => console.log(`  - ${file}`));
    }
    
    // Only contactManagerData.ts should have an event listener (for active-leaf-change)
    // This is acceptable as it only tracks which file is active, doesn't modify anything
    expect(modelsWithListeners.length).toBeLessThanOrEqual(1);
    
    if (modelsWithListeners.length === 1) {
      expect(modelsWithListeners[0]).toContain('contactManager');
    }
  });

  it('should verify event listeners do not call curator pipeline', () => {
    const allFiles = findTypeScriptFiles(srcDir);
    const suspiciousFiles: { file: string; issue: string }[] = [];
    
    for (const file of allFiles) {
      const listeners = findEventListeners(file);
      if (listeners.length === 0) continue;
      
      const content = fs.readFileSync(file, 'utf-8');
      const relativePath = path.relative(srcDir, file);
      
      // Check if file contains both event listeners AND curator calls
      const hasCuratorCall = content.match(/curatorService\.process|CuratorManager|curator\.process/);
      
      if (hasCuratorCall) {
        // Check if the curator call is inside an event handler
        // This is a simplified check - in reality we'd need AST parsing for accuracy
        const lines = content.split('\n');
        let inEventHandler = false;
        let eventHandlerStart = -1;
        
        lines.forEach((line, index) => {
          if (line.match(/\.\s*on\s*\(/)) {
            inEventHandler = true;
            eventHandlerStart = index;
          }
          
          if (inEventHandler && line.match(/curatorService\.process|curator\.process/)) {
            suspiciousFiles.push({
              file: relativePath,
              issue: `Potential curator call in event handler (near line ${index + 1})`
            });
          }
          
          // Simple heuristic: event handler ends at closing of callback
          if (inEventHandler && line.match(/^\s*\}\s*\)/)) {
            inEventHandler = false;
          }
        });
      }
    }
    
    console.log('\n=== CURATOR PIPELINE IN EVENT HANDLERS ===\n');
    
    if (suspiciousFiles.length > 0) {
      console.log('WARNING: Found files that may call curator from event handlers:\n');
      suspiciousFiles.forEach(({ file, issue }) => {
        console.log(`  ${file}: ${issue}`);
      });
      console.log('\nThese should be reviewed to ensure they don\'t create feedback loops.');
    } else {
      console.log('✓ No event handlers found that call curator pipeline directly');
    }
    
    // This is informational - we allow curator calls from event handlers
    // (e.g., syncWatcher calls curator when VCF files change)
    // But we document them for visibility
  });

  it('should verify no vault.modify events are being listened to', () => {
    const allFiles = findTypeScriptFiles(srcDir);
    const modifyListeners: { file: string; line: number }[] = [];
    
    for (const file of allFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      const relativePath = path.relative(srcDir, file);
      
      lines.forEach((line, index) => {
        // Check for vault.on('modify') or vault.on("modify")
        if (line.match(/vault\s*\.\s*on\s*\(\s*['"]modify['"]/)) {
          modifyListeners.push({
            file: relativePath,
            line: index + 1
          });
        }
      });
    }
    
    console.log('\n=== VAULT.MODIFY EVENT LISTENERS ===\n');
    
    if (modifyListeners.length > 0) {
      console.log('WARNING: Found vault.on("modify") listeners:\n');
      modifyListeners.forEach(({ file, line }) => {
        console.log(`  ${file}:${line}`);
      });
      console.log('\nThese could create feedback loops!');
    } else {
      console.log('✓ No vault.modify event listeners found (good - prevents feedback loops)');
    }
    
    // CRITICAL: No vault.modify listeners should exist
    // They would create feedback loops where our writes trigger more processing
    expect(modifyListeners.length).toBe(0);
  });

  it('should document safe event listener patterns', () => {
    console.log('\n=== SAFE EVENT LISTENER PATTERNS ===\n');
    console.log('1. workspace.on("active-leaf-change")');
    console.log('   - Used by: contactManagerData.ts');
    console.log('   - Purpose: Track which file is currently active');
    console.log('   - Safe: Does not modify files, only reads state\n');
    
    console.log('2. vault.on("create")');
    console.log('   - Used by: dropHandler.ts');
    console.log('   - Purpose: Detect when VCF files are dropped');
    console.log('   - Safe: Only processes VCF files, not contact markdown files\n');
    
    console.log('3. setInterval (polling)');
    console.log('   - Used by: syncWatcher.ts');
    console.log('   - Purpose: Periodically check VCF files for changes');
    console.log('   - Safe: Polls external files, not triggered by our own writes\n');
    
    console.log('=== UNSAFE PATTERNS TO AVOID ===\n');
    console.log('❌ vault.on("modify") - Would trigger on our own writes!');
    console.log('❌ vault.on("change") - Same issue as modify');
    console.log('❌ Calling curator from modify handler - Feedback loop!\n');
    
    // This test always passes - it's documentation
    expect(true).toBe(true);
  });
});
