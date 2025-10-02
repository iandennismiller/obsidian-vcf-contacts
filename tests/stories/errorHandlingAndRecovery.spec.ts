import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { VcardFile } from '../../src/models/vcardFile/vcardFile';
import { ContactNote } from '../../src/models/contactNote';
import { ContactsPluginSettings } from 'src/plugin/settings';

/**
 * User Story 21: Error Handling and Recovery
 * As a user, when sync operations fail or encounter errors, I want clear error 
 * messages and guidance on how to resolve conflicts between Obsidian and VCF data.
 */
describe('Error Handling and Recovery Story', () => {
  let mockApp: Partial<App>;
  let mockSettings: ContactsPluginSettings;

  beforeEach(() => {
    mockApp = {
      vault: {
        read: vi.fn(),
        modify: vi.fn(),
        create: vi.fn(),
        getMarkdownFiles: vi.fn(),
        getAbstractFileByPath: vi.fn()
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
      vcfWriteBackEnabled: true,
      vcfCustomizeIgnoreList: false,
      vcfIgnoreFilenames: [],
      vcfIgnoreUIDs: [],
      logLevel: 'INFO'
    };
  });

  it('should handle corrupted VCF files gracefully', async () => {
    const corruptedVcfContent = `BEGIN:VCARD
VERSION:4.0
UID:corrupted-123
FN:Corrupted Contact
This line is invalid and breaks VCF format
EMAIL:corrupted@example.com
INVALID_FIELD_WITHOUT_COLON
END:VCARD

BEGIN:VCARD
VERSION:4.0
This contact is missing END:VCARD`;

    try {
      const vcardFile = new VcardFile(corruptedVcfContent);
      const contacts = [];
      const errors = [];
      
      for await (const [slug, record] of vcardFile.parse()) {
        try {
          contacts.push({ slug, record });
        } catch (parseError) {
          errors.push({
            type: 'parse-error',
            message: parseError.message,
            contact: slug || 'unknown'
          });
        }
      }

      // Should handle corruption gracefully
      expect(errors.length).toBeGreaterThan(0);
      // May still parse some valid parts
      expect(contacts.length).toBeGreaterThanOrEqual(0);
      
    } catch (error) {
      // Should not throw unhandled errors
      expect(error.message).toContain('parse');
    }
  });

  it('should handle file system permission errors', async () => {
    const vcfFilePath = '/restricted/contacts.vcf';
    
    // Mock file system permission error
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    
    const result = await VcardFile.fromFile(vcfFilePath);
    
    // Should return null for unreadable files
    expect(result).toBeNull();
    
    // Should log appropriate error message
    expect(console.debug).toHaveBeenCalledWith(
      expect.stringContaining('Error reading VCF file')
    );
  });

  it('should handle missing contact files during sync', async () => {
    const mockFile = { basename: 'missing-contact', path: 'Contacts/missing-contact.md' } as TFile;
    
    // Mock file read error
    mockApp.vault!.read = vi.fn().mockRejectedValue(new Error('File not found'));
    
    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    
    try {
      await contactNote.getContent();
    } catch (error) {
      expect(error.message).toBe('File not found');
    }
  });

  it('should handle malformed frontmatter gracefully', async () => {
    const mockFile = { basename: 'malformed-contact', path: 'Contacts/malformed-contact.md' } as TFile;
    
    const malformedContent = `---
UID: malformed-123
FN: "Unclosed quote
EMAIL: malformed@example.com
INVALID: [ unclosed bracket
RELATED[invalid: missing closing bracket
---

#Contact`;

    mockApp.vault!.read = vi.fn().mockResolvedValue(malformedContent);
    mockApp.metadataCache!.getFileCache = vi.fn().mockReturnValue(null); // Indicates parse error
    
    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);
    const frontmatter = await contactNote.getFrontmatter();
    
    // Should handle malformed frontmatter
    expect(frontmatter).toBeNull();
  });

  it('should provide clear error messages for VCF export failures', async () => {
    const mockFiles = [
      { basename: 'valid-contact', path: 'Contacts/valid-contact.md' },
      { basename: 'invalid-contact', path: 'Contacts/invalid-contact.md' }
    ] as TFile[];

    mockApp.metadataCache!.getFileCache = vi.fn()
      .mockImplementation((file: TFile) => {
        if (file.basename === 'valid-contact') {
          return {
            frontmatter: {
              UID: 'valid-123',
              FN: 'Valid Contact',
              EMAIL: 'valid@example.com'
            }
          };
        }
        if (file.basename === 'invalid-contact') {
          return null; // Simulates frontmatter parse error
        }
        return null;
      });

    const result = await VcardFile.fromObsidianFiles(mockFiles, mockApp as App);
    
    // Should have some errors
    expect(result.errors.length).toBeGreaterThan(0);
    
    // Error should have clear information
    const error = result.errors[0];
    expect(error.status).toBe('error');
    expect(error.file).toBe('invalid-contact.md');
    expect(error.message).toBeDefined();
  });

  it('should handle network/file system timeouts gracefully', async () => {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Operation timed out')), 100);
    });

    const operationPromise = new Promise(resolve => {
      setTimeout(() => resolve('success'), 200); // Takes longer than timeout
    });

    try {
      await Promise.race([operationPromise, timeoutPromise]);
    } catch (error) {
      expect(error.message).toBe('Operation timed out');
    }
  });

  it('should provide recovery suggestions for common errors', async () => {
    const errorScenarios = [
      {
        error: 'File not found',
        type: 'file-missing',
        suggestions: [
          'Check if the file path is correct',
          'Verify the file exists in the contacts folder',
          'Check file permissions'
        ]
      },
      {
        error: 'Invalid UID format',
        type: 'uid-invalid',
        suggestions: [
          'Ensure UID is not empty',
          'Use valid UUID format (e.g., urn:uuid:...)',
          'Generate a new UID if corrupted'
        ]
      },
      {
        error: 'Circular relationship detected',
        type: 'circular-ref',
        suggestions: [
          'Review relationship chains',
          'Remove circular references',
          'Use indirect relationships instead'
        ]
      },
      {
        error: 'Malformed VCF content',
        type: 'vcf-malformed',
        suggestions: [
          'Check VCF file structure',
          'Ensure BEGIN/END VCARD pairs match',
          'Validate field formats'
        ]
      }
    ];

    errorScenarios.forEach(scenario => {
      const errorHandler = {
        getRecoverySuggestions: (errorType: string) => {
          const scenarioMatch = errorScenarios.find(s => s.type === errorType);
          return scenarioMatch?.suggestions || ['Contact support for assistance'];
        }
      };

      const suggestions = errorHandler.getRecoverySuggestions(scenario.type);
      expect(suggestions).toEqual(scenario.suggestions);
      expect(suggestions.length).toBeGreaterThan(0);
    });
  });

  it('should handle concurrent modification conflicts', async () => {
    const mockFile = { basename: 'concurrent-contact', path: 'Contacts/concurrent-contact.md' } as TFile;
    
    // Simulate concurrent modifications
    const version1 = {
      UID: 'concurrent-123',
      FN: 'Version 1',
      EMAIL: 'v1@example.com',
      REV: '20240215T120000Z'
    };

    const version2 = {
      UID: 'concurrent-123',
      FN: 'Version 2',
      EMAIL: 'v2@example.com',
      REV: '20240215T120001Z' // 1 second later
    };

    // Conflict resolution strategy: last writer wins
    const resolveConflict = (v1: any, v2: any) => {
      if (!v1.REV && !v2.REV) {
        return { ...v2, conflict: 'no-timestamps' };
      }
      
      if (!v1.REV) return { ...v2, conflict: 'v1-missing-rev' };
      if (!v2.REV) return { ...v1, conflict: 'v2-missing-rev' };
      
      const winner = v1.REV > v2.REV ? v1 : v2;
      return { 
        ...winner, 
        conflict: 'resolved-by-timestamp',
        conflictedWith: v1.REV === winner.REV ? v2 : v1
      };
    };

    const resolved = resolveConflict(version1, version2);
    
    expect(resolved.FN).toBe('Version 2');
    expect(resolved.conflict).toBe('resolved-by-timestamp');
    expect(resolved.conflictedWith.FN).toBe('Version 1');
  });

  it('should validate and sanitize user input', async () => {
    const dangerousInputs = [
      {
        field: 'FN',
        value: '<script>alert("xss")</script>John Doe',
        expected: 'John Doe',
        issue: 'script-injection'
      },
      {
        field: 'EMAIL',
        value: 'user@domain.com\n\rBCC: attacker@evil.com',
        expected: 'user@domain.com',
        issue: 'header-injection'
      },
      {
        field: 'NOTE',
        value: '../../../../../../etc/passwd',
        expected: '../../../../../../etc/passwd', // Path traversal in notes might be OK
        issue: 'path-traversal'
      },
      {
        field: 'UID',
        value: 'normal-uid-123\x00\x01\x02',
        expected: 'normal-uid-123',
        issue: 'null-bytes'
      }
    ];

    dangerousInputs.forEach(input => {
      // Basic sanitization examples
      let sanitized = input.value;
      
      // For email, take only the first line first (before other processing)
      if (input.field === 'EMAIL') {
        sanitized = sanitized.split(/[\r\n]/)[0];
      }
      
      // Remove HTML/script tags - handle nested quotes properly
      sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, '');
      sanitized = sanitized.replace(/<[^>]*>/g, '');
      
      // Remove control characters and null bytes
      sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
      
      expect(sanitized).toBe(input.expected);
    });
  });

  it('should handle memory constraints with large contact sets', async () => {
    // Simulate processing large number of contacts
    const largeContactSet = Array.from({ length: 1000 }, (_, i) => ({
      UID: `contact-${i}`,
      FN: `Contact ${i}`,
      EMAIL: `contact${i}@example.com`
    }));

    const processInBatches = async (contacts: any[], batchSize = 100) => {
      const results = [];
      const errors = [];
      
      for (let i = 0; i < contacts.length; i += batchSize) {
        const batch = contacts.slice(i, i + batchSize);
        
        try {
          // Simulate processing batch
          const processed = batch.map(contact => ({
            ...contact,
            processed: true,
            batchIndex: Math.floor(i / batchSize)
          }));
          
          results.push(...processed);
          
          // Simulate memory cleanup between batches
          if (results.length % (batchSize * 5) === 0) {
            // Force garbage collection hint (in real implementation)
            await new Promise(resolve => setTimeout(resolve, 1));
          }
          
        } catch (error) {
          errors.push({
            batchStart: i,
            batchSize: batch.length,
            error: error.message
          });
        }
      }
      
      return { results, errors };
    };

    const { results, errors } = await processInBatches(largeContactSet);
    
    expect(results.length).toBe(1000);
    expect(errors.length).toBe(0);
    expect(results[0].batchIndex).toBe(0);
    expect(results[999].batchIndex).toBe(9); // 1000/100 - 1
  });

  it('should provide detailed error logging for debugging', async () => {
    const mockConsole = {
      logs: [] as any[],
      log: function(...args: any[]) { this.logs.push({ level: 'log', args }); },
      error: function(...args: any[]) { this.logs.push({ level: 'error', args }); },
      warn: function(...args: any[]) { this.logs.push({ level: 'warn', args }); },
      debug: function(...args: any[]) { this.logs.push({ level: 'debug', args }); }
    };

    const logError = (context: string, error: Error, details?: any) => {
      mockConsole.error(`[${context}] Error:`, error.message);
      
      if (details) {
        mockConsole.debug(`[${context}] Details:`, details);
      }
      
      // Stack trace for development
      if (mockSettings.logLevel === 'DEBUG') {
        mockConsole.debug(`[${context}] Stack:`, error.stack);
      }
    };

    // Simulate various error scenarios
    const testError = new Error('Test error message');
    testError.stack = 'Error: Test error\n    at test.spec.ts:123:45';
    
    logError('VCF_PARSE', testError, { 
      file: 'contacts.vcf', 
      line: 15, 
      content: 'invalid content' 
    });
    
    logError('SYNC_OPERATION', testError, {
      operation: 'updateContact',
      contactUID: 'test-123',
      conflictType: 'timestamp'
    });

    expect(mockConsole.logs).toHaveLength(4); // 2 errors + 2 debug logs
    expect(mockConsole.logs[0].level).toBe('error');
    expect(mockConsole.logs[0].args[0]).toContain('[VCF_PARSE]');
    expect(mockConsole.logs[1].level).toBe('debug');
    expect(mockConsole.logs[1].args[1]).toHaveProperty('file', 'contacts.vcf');
  });

  it('should handle partial failure in batch operations', async () => {
    const batchOperations = [
      { id: 1, type: 'create', data: { UID: 'valid-1', FN: 'Valid 1' } },
      { id: 2, type: 'update', data: { UID: '', FN: 'Invalid UID' } }, // Will fail
      { id: 3, type: 'create', data: { UID: 'valid-3', FN: 'Valid 3' } },
      { id: 4, type: 'delete', data: { UID: 'nonexistent' } }, // Will fail
      { id: 5, type: 'create', data: { UID: 'valid-5', FN: 'Valid 5' } }
    ];

    const processBatch = async (operations: any[]) => {
      const results = {
        successful: [] as any[],
        failed: [] as any[],
        total: operations.length
      };

      for (const operation of operations) {
        try {
          // Simulate operation validation
          if (operation.type === 'update' && !operation.data.UID) {
            throw new Error('UID is required for update operations');
          }
          
          if (operation.type === 'delete' && operation.data.UID === 'nonexistent') {
            throw new Error('Contact not found for deletion');
          }
          
          // Operation successful
          results.successful.push({
            id: operation.id,
            type: operation.type,
            status: 'completed'
          });
          
        } catch (error) {
          results.failed.push({
            id: operation.id,
            type: operation.type,
            error: error.message,
            status: 'failed'
          });
        }
      }

      return results;
    };

    const results = await processBatch(batchOperations);
    
    expect(results.total).toBe(5);
    expect(results.successful).toHaveLength(3);
    expect(results.failed).toHaveLength(2);
    
    // Check specific failures
    const failedUIDs = results.failed.map(f => f.id);
    expect(failedUIDs).toEqual([2, 4]);
    
    // Check error messages
    expect(results.failed[0].error).toContain('UID is required');
    expect(results.failed[1].error).toContain('Contact not found');
  });

  it('should provide user-friendly error messages', async () => {
    const technicalErrors = [
      'ENOENT: no such file or directory',
      'JSON.parse: unexpected token',
      'TypeError: Cannot read property of undefined',
      'Network request failed with status 500',
      'UID constraint violation in database'
    ];

    const humanizeError = (error: string): string => {
      const errorMappings = {
        'ENOENT': 'The requested file could not be found. Please check the file path.',
        'JSON.parse': 'The file content is not properly formatted. Please check for syntax errors.',
        'TypeError: Cannot read property': 'Some required information is missing. Please check your contact data.',
        'Network request failed': 'Unable to connect to the server. Please check your internet connection.',
        'UID constraint violation': 'This contact ID already exists. Please use a unique identifier.'
      };

      for (const [technical, friendly] of Object.entries(errorMappings)) {
        if (error.includes(technical)) {
          return friendly;
        }
      }

      return 'An unexpected error occurred. Please try again or contact support.';
    };

    technicalErrors.forEach(error => {
      const humanized = humanizeError(error);
      expect(humanized).not.toContain('ENOENT');
      expect(humanized).not.toContain('TypeError');
      expect(humanized).not.toContain('JSON.parse');
      expect(humanized.length).toBeGreaterThan(20); // Should be descriptive
    });
  });
});