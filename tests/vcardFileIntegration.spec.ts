import { describe, expect, it, vi, beforeEach } from 'vitest';
import { VcardFile } from 'src/contacts/vcardFile';

// Mock the app context dependency
vi.mock('src/context/sharedAppContext', () => ({
  getApp: vi.fn(() => ({
    metadataCache: {
      getFileCache: vi.fn(() => ({
        frontmatter: {}
      }))
    }
  }))
}));

vi.mock('src/contacts/vcard/shared/ensureHasName', () => ({
  ensureHasName: vi.fn((obj) => Promise.resolve({ ...obj, 'FN': 'Test Name' }))
}));

vi.mock('src/util/nameUtils', () => ({
  createNameSlug: vi.fn(() => 'test-contact')
}));

describe('VcardFile Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('should provide VcardFile class functionality', async () => {
    // Test that the VcardFile class provides all needed functionality
    
    // Test creating empty vcard
    const emptyVcard = await VcardFile.createEmpty();
    expect(emptyVcard).toBeInstanceOf(VcardFile);
    expect(emptyVcard.toString()).toContain('BEGIN:VCARD');
    expect(emptyVcard.toString()).toContain('END:VCARD');
    expect(emptyVcard.toString()).toContain('VERSION:4.0');
    
    // Test string output
    expect(typeof emptyVcard.toString()).toBe('string');
  });

  it('should provide unified interface for parsing and generation', async () => {
    const sampleVcf = `BEGIN:VCARD
VERSION:4.0
FN:Test Contact
EMAIL:test@example.com
END:VCARD`;

    // Create VcardFile instance
    const vcardFile = new VcardFile(sampleVcf);
    
    // Test parsing
    const results = [];
    for await (const result of vcardFile.parse()) {
      results.push(result);
    }
    
    expect(results).toHaveLength(1);
    expect(results[0][1]).toHaveProperty('FN', 'Test Contact');
    expect(results[0][1]).toHaveProperty('EMAIL', 'test@example.com');
    
    // Test string output
    expect(vcardFile.toString()).toBe(sampleVcf);
  });

  it('should provide complete file operation capabilities', () => {
    // Test static methods are available
    expect(typeof VcardFile.listVCFFiles).toBe('function');
    expect(typeof VcardFile.getFileStats).toBe('function');
    expect(typeof VcardFile.folderExists).toBe('function');
    expect(typeof VcardFile.containsUID).toBe('function');
    expect(typeof VcardFile.generateVCFFilename).toBe('function');
    
    // Test utility methods
    const filename = VcardFile.generateVCFFilename('Test Contact');
    expect(filename).toBe('Test_Contact.vcf');
    
    const hasUID = VcardFile.containsUID('UID:test123\nFN:Name', 'test123');
    expect(hasUID).toBe(true);
    
    const noUID = VcardFile.containsUID('FN:Name', 'test123');
    expect(noUID).toBe(false);
  });

  it('should demonstrate the new unified workflow', async () => {
    // Complete workflow using new VcardFile class:
    // 1. Create empty vcard
    // 2. Parse some VCF data
    // 3. Generate filename
    // 4. Check for UID
    
    // Step 1: Create empty vcard template
    const emptyVcard = await VcardFile.createEmpty();
    expect(emptyVcard.toString()).toContain('VERSION:4.0');
    
    // Step 2: Create and parse VCF data
    const vcfContent = `BEGIN:VCARD
VERSION:4.0
FN:John Smith
UID:john-smith-123
EMAIL:john@smith.com
TEL:+1-555-0123
END:VCARD`;
    
    const vcardFile = new VcardFile(vcfContent);
    const contacts = [];
    for await (const [slug, contact] of vcardFile.parse()) {
      contacts.push({ slug, contact });
    }
    
    expect(contacts).toHaveLength(1);
    expect(contacts[0].contact.FN).toBe('John Smith');
    expect(contacts[0].contact.UID).toBe('john-smith-123');
    
    // Step 3: Generate appropriate filename
    const filename = VcardFile.generateVCFFilename(contacts[0].contact.FN);
    expect(filename).toBe('John_Smith.vcf');
    
    // Step 4: Check if VCF contains specific UID
    const hasUID = VcardFile.containsUID(vcfContent, 'john-smith-123');
    expect(hasUID).toBe(true);
    
    console.log('✅ Complete VcardFile workflow tested successfully');
    console.log(`   - Created empty vcard template`);
    console.log(`   - Parsed contact: ${contacts[0].contact.FN}`);
    console.log(`   - Generated filename: ${filename}`);
    console.log(`   - Verified UID presence: ${hasUID}`);
  });
});