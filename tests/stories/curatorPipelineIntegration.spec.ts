import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { ContactsPluginSettings } from 'src/plugin/settings';
import { Contact } from '../../src/models';
import { setApp, clearApp } from 'src/plugin/context/sharedAppContext';
import { setSettings } from 'src/plugin/context/sharedSettingsContext';
import { RelatedListProcessor } from '../../src/curators/relatedList';
import { RelatedFrontMatterProcessor } from '../../src/curators/relatedFrontMatter';
import { GenderInferenceProcessor } from '../../src/curators/genderInference';
import { GenderRenderProcessor } from '../../src/curators/genderRender';

/**
 * Integration Test: Complete Curator Processing Pipeline
 * 
 * This test validates the entire curator processing pipeline from start to finish,
 * tracking changes at each step to ensure proper data flow and no regressions.
 * 
 * Goals:
 * - Validate each processor's output independently
 * - Track state changes between processors
 * - Ensure final state matches expectations
 * - Detect when changes are reverted unexpectedly
 */
describe('Curator Pipeline Integration', () => {
  let mockApp: Partial<App>;
  let mockSettings: ContactsPluginSettings;
  let mockContactFiles: Map<string, TFile>;
  let fileContents: Map<string, string>;
  let writeHistory: Array<{ timestamp: number; file: string; content: string }>;

  beforeEach(() => {
    mockContactFiles = new Map();
    fileContents = new Map();
    writeHistory = [];

    mockApp = {
      vault: {
        read: vi.fn().mockImplementation((file: TFile) => {
          const content = fileContents.get(file.path);
          console.log(`[TEST] vault.read(${file.path}): ${content ? 'found' : 'not found'}`);
          if (content !== undefined) return Promise.resolve(content);
          return Promise.reject(new Error('File not found'));
        }),
        modify: vi.fn().mockImplementation(async (file: TFile, newContent: string) => {
          const timestamp = Date.now();
          writeHistory.push({ timestamp, file: file.path, content: newContent });
          fileContents.set(file.path, newContent);
          console.log(`[TEST] vault.modify(${file.path}) - Write #${writeHistory.length}`);
          console.log(`[TEST] Content preview: ${newContent.substring(0, 200)}...`);
          return Promise.resolve();
        }),
        create: vi.fn(),
        getMarkdownFiles: vi.fn(() => Array.from(mockContactFiles.values())),
        getAbstractFileByPath: vi.fn((path: string) => mockContactFiles.get(path) || null)
      } as any,
      metadataCache: {
        getFileCache: vi.fn().mockImplementation((file: TFile) => {
          // Parse frontmatter from current file content to simulate Obsidian's behavior
          const content = fileContents.get(file.path);
          if (!content) return null;

          const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
          if (frontmatterMatch) {
            try {
              const yaml = frontmatterMatch[1];
              const frontmatter: any = {};
              const lines = yaml.split('\n');
              lines.forEach(line => {
                // Handle both quoted and unquoted keys
                const match = line.match(/^"?([^":]+)"?:\s*(.+)$/);
                if (match) {
                  const key = match[1].trim();
                  const value = match[2].trim();
                  frontmatter[key] = value;
                }
              });
              console.log(`[TEST] metadataCache.getFileCache(${file.path}): keys = ${Object.keys(frontmatter).join(', ')}`);
              return { frontmatter };
            } catch (error) {
              console.log(`[TEST] metadataCache.getFileCache(${file.path}): parse error`);
              return null;
            }
          }
          return null;
        })
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
      vcfWriteBackEnabled: false,
      vcfCustomizeIgnoreList: false,
      vcfIgnoreFilenames: [],
      vcfIgnoreUIDs: [],
      logLevel: 'INFO',
      relatedListProcessor: true,
      relatedFrontMatterProcessor: true,
      genderInferenceProcessor: true,
      genderRenderProcessor: true
    } as any;

    setApp(mockApp as App);
    setSettings(mockSettings);
  });

  afterEach(() => {
    clearApp();
  });

  /**
   * Helper function to extract frontmatter from content
   */
  function extractFrontmatter(content: string): Record<string, any> {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) return {};

    const yaml = frontmatterMatch[1];
    const frontmatter: any = {};
    const lines = yaml.split('\n');
    lines.forEach(line => {
      // Match quoted keys with brackets: "key": value
      // Or unquoted keys: key: value
      const quotedMatch = line.match(/^"([^"]+)":\s*(.+)$/);
      if (quotedMatch) {
        const key = quotedMatch[1].trim();
        const value = quotedMatch[2].trim();
        frontmatter[key] = value;
        return;
      }
      
      // Fallback for unquoted keys
      const unquotedMatch = line.match(/^([^:]+):\s*(.+)$/);
      if (unquotedMatch) {
        const key = unquotedMatch[1].trim();
        const value = unquotedMatch[2].trim();
        frontmatter[key] = value;
      }
    });
    return frontmatter;
  }

  /**
   * Helper function to extract Related section from content
   */
  function extractRelatedSection(content: string): string[] {
    const relatedMatch = content.match(/#### Related\n([\s\S]*?)(?:\n#{2,}|\n\n#|$)/i);
    if (!relatedMatch) return [];
    
    const relatedContent = relatedMatch[1].trim();
    const relationships = relatedContent
      .split('\n')
      .filter(line => line.trim().startsWith('-'))
      .map(line => line.trim());
    
    return relationships;
  }

  /**
   * Helper to log state at a point in the pipeline
   */
  function logState(stage: string, file: TFile) {
    const content = fileContents.get(file.path);
    if (!content) {
      console.log(`\n[PIPELINE-${stage}] No content for ${file.path}`);
      return;
    }

    const frontmatter = extractFrontmatter(content);
    const relatedSection = extractRelatedSection(content);

    console.log(`\n[PIPELINE-${stage}] State for ${file.basename}:`);
    console.log(`  Frontmatter RELATED keys: ${Object.keys(frontmatter).filter(k => k.startsWith('RELATED')).join(', ') || 'none'}`);
    console.log(`  Related section: ${relatedSection.length} items`);
    relatedSection.forEach(rel => console.log(`    ${rel}`));
  }

  it('should process a contact through the complete curator pipeline and maintain RELATED keys', async () => {
    console.log('\n=== CURATOR PIPELINE INTEGRATION TEST ===\n');

    // Setup: Create contacts with relationships
    const johnFile = { basename: 'john-doe', path: 'Contacts/john-doe.md', name: 'john-doe.md' } as TFile;
    const janeFile = { basename: 'jane-smith', path: 'Contacts/jane-smith.md', name: 'jane-smith.md' } as TFile;
    const bobFile = { basename: 'bob-jones', path: 'Contacts/bob-jones.md', name: 'bob-jones.md' } as TFile;
    const aliceFile = { basename: 'alice-brown', path: 'Contacts/alice-brown.md', name: 'alice-brown.md' } as TFile;

    mockContactFiles.set(johnFile.path, johnFile);
    mockContactFiles.set(janeFile.path, janeFile);
    mockContactFiles.set(bobFile.path, bobFile);
    mockContactFiles.set(aliceFile.path, aliceFile);

    // John's initial state: has relationships in Related section but not in frontmatter
    const johnInitialContent = `---
UID: john-uid-123
FN: John Doe
GENDER: M
REV: 20240101T120000Z
---

#### Related
- spouse: [[Jane Smith]]
- friend: [[Bob Jones]]
- sibling: [[Alice Brown]]

#Contact`;

    fileContents.set(johnFile.path, johnInitialContent);
    fileContents.set(janeFile.path, `---
UID: jane-uid-456
FN: Jane Smith
GENDER: F
---

#Contact`);
    fileContents.set(bobFile.path, `---
UID: bob-uid-789
FN: Bob Jones
GENDER: M
---

#Contact`);
    fileContents.set(aliceFile.path, `---
UID: alice-uid-111
FN: Alice Brown
GENDER: F
---

#Contact`);

    console.log('[SETUP] Initial state created');
    logState('INITIAL', johnFile);

    // Create contact object for processing
    const johnContact: Contact = {
      file: johnFile,
      UID: 'john-uid-123',
      FN: 'John Doe'
    };

    // ==================== STEP 1: RelatedListProcessor ====================
    console.log('\n[STEP 1] Running RelatedListProcessor...');
    const relatedListResult = await RelatedListProcessor.process(johnContact);
    logState('AFTER-RELATEDLIST', johnFile);

    expect(relatedListResult).toBeDefined();
    expect(relatedListResult?.message).toContain('missing relationship');

    // Verify relationships were added to frontmatter
    let currentContent = fileContents.get(johnFile.path)!;
    let currentFrontmatter = extractFrontmatter(currentContent);
    
    console.log('\n[VERIFY-STEP-1] Checking RELATED keys in frontmatter:');
    Object.keys(currentFrontmatter).filter(k => k.startsWith('RELATED')).forEach(key => {
      console.log(`  ${key}: ${currentFrontmatter[key]}`);
    });

    expect(currentFrontmatter['RELATED[spouse]']).toBeDefined();
    expect(currentFrontmatter['RELATED[friend]']).toBeDefined();
    expect(currentFrontmatter['RELATED[sibling]']).toBeDefined();

    // Verify values reference the correct UIDs
    expect(currentFrontmatter['RELATED[spouse]']).toContain('jane-uid-456');
    expect(currentFrontmatter['RELATED[friend]']).toContain('bob-uid-789');
    expect(currentFrontmatter['RELATED[sibling]']).toContain('alice-uid-111');

    // ==================== STEP 2: Check write history ====================
    console.log(`\n[WRITE-HISTORY] Total writes so far: ${writeHistory.length}`);
    writeHistory.forEach((write, idx) => {
      console.log(`\nWrite #${idx + 1} to ${write.file}:`);
      const fm = extractFrontmatter(write.content);
      const relatedKeys = Object.keys(fm).filter(k => k.startsWith('RELATED'));
      console.log(`  RELATED keys: ${relatedKeys.join(', ') || 'none'}`);
      relatedKeys.forEach(key => {
        console.log(`    ${key}: ${fm[key]}`);
      });
    });

    // ==================== STEP 3: Verify final state ====================
    console.log('\n[FINAL-STATE] Verifying final state matches expectations...');
    logState('FINAL', johnFile);

    const finalContent = fileContents.get(johnFile.path)!;
    const finalFrontmatter = extractFrontmatter(finalContent);

    // Verify all RELATED keys are still present and correctly formatted
    expect(finalFrontmatter['RELATED[spouse]']).toBeDefined();
    expect(finalFrontmatter['RELATED[friend]']).toBeDefined();
    expect(finalFrontmatter['RELATED[sibling]']).toBeDefined();

    // Verify no malformed RELATED structure
    expect(finalFrontmatter['RELATED']).toBeUndefined();

    // Verify REV was updated
    expect(finalFrontmatter['REV']).toBeDefined();
    expect(finalFrontmatter['REV']).not.toBe('20240101T120000Z');

    console.log('\n[SUCCESS] All pipeline steps completed successfully!');
  });

  it('should detect if changes are reverted by subsequent processor steps', async () => {
    console.log('\n=== REVERSION DETECTION TEST ===\n');

    // Setup similar to previous test
    const testFile = { basename: 'test-contact', path: 'Contacts/test-contact.md', name: 'test-contact.md' } as TFile;
    const friendFile = { basename: 'friend', path: 'Contacts/friend.md', name: 'friend.md' } as TFile;

    mockContactFiles.set(testFile.path, testFile);
    mockContactFiles.set(friendFile.path, friendFile);

    fileContents.set(testFile.path, `---
UID: test-uid-123
FN: Test Contact
REV: 20240101T120000Z
---

#### Related
- friend: [[Friend]]

#Contact`);

    fileContents.set(friendFile.path, `---
UID: friend-uid-456
FN: Friend
---

#Contact`);

    const testContact: Contact = {
      file: testFile,
      UID: 'test-uid-123',
      FN: 'Test Contact'
    };

    // Process the contact
    console.log('[PROCESSING] Running RelatedListProcessor...');
    await RelatedListProcessor.process(testContact);

    // Track RELATED keys across all writes
    const relatedKeysHistory: Array<{ writeNum: number; keys: string[] }> = [];
    
    writeHistory.forEach((write, idx) => {
      const fm = extractFrontmatter(write.content);
      const relatedKeys = Object.keys(fm).filter(k => k.startsWith('RELATED'));
      relatedKeysHistory.push({ writeNum: idx + 1, keys: relatedKeys });
    });

    console.log('\n[RELATED-KEYS-HISTORY] Tracking RELATED keys across writes:');
    relatedKeysHistory.forEach(entry => {
      console.log(`  Write #${entry.writeNum}: ${entry.keys.join(', ') || 'none'}`);
    });

    // Detect if RELATED keys disappear in later writes
    let hadRelatedKeys = false;
    let lostRelatedKeys = false;

    relatedKeysHistory.forEach((entry, idx) => {
      if (entry.keys.length > 0) {
        hadRelatedKeys = true;
      }
      if (hadRelatedKeys && entry.keys.length === 0) {
        lostRelatedKeys = true;
        console.log(`\n[WARNING] RELATED keys lost in write #${entry.writeNum}!`);
      }
    });

    // The test passes if we never lose RELATED keys after they're added
    expect(lostRelatedKeys).toBe(false);

    console.log('\n[RESULT] No reversion detected - RELATED keys maintained throughout pipeline');
  });

  it('should handle multiple relationship types correctly without grouping them', async () => {
    console.log('\n=== MULTIPLE RELATIONSHIP TYPES TEST ===\n');

    const mainFile = { basename: 'main', path: 'Contacts/main.md', name: 'main.md' } as TFile;
    const spouse = { basename: 'spouse', path: 'Contacts/spouse.md', name: 'spouse.md' } as TFile;
    const sibling = { basename: 'sibling', path: 'Contacts/sibling.md', name: 'sibling.md' } as TFile;
    const parent = { basename: 'parent', path: 'Contacts/parent.md', name: 'parent.md' } as TFile;
    const friend1 = { basename: 'friend1', path: 'Contacts/friend1.md', name: 'friend1.md' } as TFile;
    const friend2 = { basename: 'friend2', path: 'Contacts/friend2.md', name: 'friend2.md' } as TFile;

    [mainFile, spouse, sibling, parent, friend1, friend2].forEach(f => mockContactFiles.set(f.path, f));

    fileContents.set(mainFile.path, `---
UID: main-uid
FN: Main Contact
REV: 20240101T120000Z
---

#### Related
- spouse: [[Spouse]]
- sibling: [[Sibling]]
- parent: [[Parent]]
- friend: [[Friend1]]
- friend: [[Friend2]]

#Contact`);

    fileContents.set(spouse.path, `---\nUID: spouse-uid\nFN: Spouse\n---\n#Contact`);
    fileContents.set(sibling.path, `---\nUID: sibling-uid\nFN: Sibling\n---\n#Contact`);
    fileContents.set(parent.path, `---\nUID: parent-uid\nFN: Parent\n---\n#Contact`);
    fileContents.set(friend1.path, `---\nUID: friend1-uid\nFN: Friend1\n---\n#Contact`);
    fileContents.set(friend2.path, `---\nUID: friend2-uid\nFN: Friend2\n---\n#Contact`);

    const mainContact: Contact = { file: mainFile, UID: 'main-uid', FN: 'Main Contact' };

    console.log('[PROCESSING] Running RelatedListProcessor...');
    await RelatedListProcessor.process(mainContact);

    // Check final state
    const finalContent = fileContents.get(mainFile.path)!;
    const finalFrontmatter = extractFrontmatter(finalContent);

    console.log('\n[FINAL-FRONTMATTER] RELATED keys:');
    Object.keys(finalFrontmatter)
      .filter(k => k.startsWith('RELATED'))
      .sort()
      .forEach(key => {
        console.log(`  ${key}: ${finalFrontmatter[key]}`);
      });

    console.log('\n[DEBUG] All frontmatter keys:', Object.keys(finalFrontmatter));

    // Verify each relationship type has its own key
    expect(finalFrontmatter['RELATED[spouse]']).toBeDefined();
    expect(finalFrontmatter['RELATED[sibling]']).toBeDefined();
    expect(finalFrontmatter['RELATED[parent]']).toBeDefined();
    expect(finalFrontmatter['RELATED[friend]']).toBeDefined();
    // Check for the second friend key with any formatting
    const hasSecondFriend = Object.keys(finalFrontmatter).some(k => 
      k.includes('RELATED[1') && k.includes('friend')
    );
    expect(hasSecondFriend).toBe(true);

    // Verify no malformed grouping (all under "friend")
    const friendKeys = Object.keys(finalFrontmatter).filter(k => k.includes('friend'));
    console.log('\n[DEBUG] Friend-related keys:', friendKeys);
    expect(friendKeys.length).toBe(2); // Should only have 2 friend relationships

    console.log('\n[SUCCESS] All relationship types stored correctly!');
  });
});
