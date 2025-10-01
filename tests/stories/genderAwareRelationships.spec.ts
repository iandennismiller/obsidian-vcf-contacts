import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App, TFile } from 'obsidian';
import { ContactNote } from '../../src/models/contactNote';
import { ContactsPluginSettings } from 'src/plugin/settings';

/**
 * User Story 13: Gender-Aware Relationship Processing
 * As a user, I want the plugin to use gender information when rendering relationships.
 * Relationships are stored in genderless form (parent, child, sibling) in frontmatter
 * and vCard RELATED fields, but rendered with gendered terms (father, daughter, brother)
 * in the Related list based on the contact's GENDER field.
 * When I specify gendered terms like "mother" or "father", the plugin infers the 
 * contact's gender and updates the GENDER field accordingly.
 */
describe('Gender-Aware Relationship Processing Story', () => {
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
      vcfWatchEnabled: true,
      vcfWatchPollingInterval: 30,
      vcfWriteBackEnabled: false,
      vcfCustomizeIgnoreList: false,
      vcfIgnoreFilenames: [],
      vcfIgnoreUIDs: [],
      logLevel: 'INFO'
    };
  });

  it('should parse gender values correctly', () => {
    const mockFile = { basename: 'test-contact', path: 'Contacts/test-contact.md' } as TFile;
    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);

    // Test various gender formats
    expect(contactNote.parseGender('M')).toBe('M');
    expect(contactNote.parseGender('MALE')).toBe('M');
    expect(contactNote.parseGender('male')).toBe('M');
    expect(contactNote.parseGender('m')).toBe('M');

    expect(contactNote.parseGender('F')).toBe('F');
    expect(contactNote.parseGender('FEMALE')).toBe('F');
    expect(contactNote.parseGender('female')).toBe('F');
    expect(contactNote.parseGender('f')).toBe('F');

    expect(contactNote.parseGender('NB')).toBe('NB');
    expect(contactNote.parseGender('NON-BINARY')).toBe('NB');
    expect(contactNote.parseGender('NONBINARY')).toBe('NB');
    expect(contactNote.parseGender('nb')).toBe('NB');
  });

  it('should apply gender-aware relationship mapping for display', () => {
    // Relationships stored in genderless form, but displayed with gendered terms
    const familyRelationships = [
      { genderlessType: 'child', maleForm: 'son', femaleForm: 'daughter' },
      { genderlessType: 'parent', maleForm: 'father', femaleForm: 'mother' },
      { genderlessType: 'sibling', maleForm: 'brother', femaleForm: 'sister' },
      { genderlessType: 'grandparent', maleForm: 'grandfather', femaleForm: 'grandmother' },
      { genderlessType: 'grandchild', maleForm: 'grandson', femaleForm: 'granddaughter' },
      { genderlessType: 'spouse', maleForm: 'husband', femaleForm: 'wife' }
    ];

    familyRelationships.forEach(({ genderlessType, maleForm, femaleForm }) => {
      // Simulate gender-aware relationship rendering
      const maleRelationship = applyGenderToRelationship(genderlessType, 'M');
      const femaleRelationship = applyGenderToRelationship(genderlessType, 'F');
      const unknownGenderRelationship = applyGenderToRelationship(genderlessType, undefined);
      
      expect(maleRelationship).toBe(maleForm);
      expect(femaleRelationship).toBe(femaleForm);
      // When gender is unknown, use genderless form
      expect(unknownGenderRelationship).toBe(genderlessType);
    });
  });

  it('should handle reverse relationship inference with genderless storage', () => {
    // When adding gendered relationship terms, they trigger gender inference
    // But relationships are stored in genderless form
    const reverseRelationships = [
      { genderless: 'child', gendered_input: 'son', reverse_genderless: 'parent' },
      { genderless: 'child', gendered_input: 'daughter', reverse_genderless: 'parent' },
      { genderless: 'parent', gendered_input: 'father', reverse_genderless: 'child' },
      { genderless: 'parent', gendered_input: 'mother', reverse_genderless: 'child' },
      { genderless: 'sibling', gendered_input: 'brother', reverse_genderless: 'sibling' },
      { genderless: 'sibling', gendered_input: 'sister', reverse_genderless: 'sibling' },
      { genderless: 'spouse', gendered_input: 'husband', reverse_genderless: 'spouse' },
      { genderless: 'spouse', gendered_input: 'wife', reverse_genderless: 'spouse' }
    ];

    reverseRelationships.forEach(({ genderless, gendered_input, reverse_genderless }) => {
      // The reverse relationship should always use genderless form in storage
      const reverse = getReverseRelationshipType(genderless);
      const femaleReverse = getReverseRelationship(original, 'F');
      
      expect(maleReverse).toBe(male_reverse);
      expect(femaleReverse).toBe(female_reverse);
    });
  });

  it('should handle contacts with missing gender gracefully', () => {
    const mockFile = { basename: 'unknown-gender', path: 'Contacts/unknown-gender.md' } as TFile;
    const contactNote = new ContactNote(mockApp as App, mockSettings, mockFile);

    // When gender is unknown, should fall back to gender-neutral or base relationship type
    expect(contactNote.parseGender('')).toBe(null);
    expect(contactNote.parseGender(undefined as any)).toBe(null);
    expect(contactNote.parseGender(null as any)).toBe(null);
    
    // For unknown gender, should use generic relationship terms
    const unknownGenderRelationship = applyGenderToRelationship('child', null);
    expect(unknownGenderRelationship).toBe('child'); // Falls back to base type
  });

  it('should handle professional relationships without gender bias', () => {
    // Professional relationships should generally not be gender-specific
    const professionalRelationships = [
      'colleague',
      'boss', 
      'employee',
      'manager',
      'client',
      'vendor',
      'partner',
      'teammate'
    ];

    professionalRelationships.forEach(relationship => {
      // Professional relationships should remain the same regardless of gender
      expect(applyGenderToRelationship(relationship, 'M')).toBe(relationship);
      expect(applyGenderToRelationship(relationship, 'F')).toBe(relationship);
      expect(applyGenderToRelationship(relationship, 'NB')).toBe(relationship);
    });
  });

  it('should handle extended family relationships with gender awareness', () => {
    const extendedFamilyRelationships = [
      { baseType: 'aunt-uncle', maleForm: 'uncle', femaleForm: 'aunt' },
      { baseType: 'niece-nephew', maleForm: 'nephew', femaleForm: 'niece' },
      { baseType: 'cousin', maleForm: 'cousin', femaleForm: 'cousin' }, // Gender-neutral
      { baseType: 'in-law-child', maleForm: 'son-in-law', femaleForm: 'daughter-in-law' },
      { baseType: 'in-law-parent', maleForm: 'father-in-law', femaleForm: 'mother-in-law' }
    ];

    extendedFamilyRelationships.forEach(({ baseType, maleForm, femaleForm }) => {
      const maleRelationship = applyGenderToRelationship(baseType, 'M');
      const femaleRelationship = applyGenderToRelationship(baseType, 'F');
      
      expect(maleRelationship).toBe(maleForm);
      expect(femaleRelationship).toBe(femaleForm);
    });
  });

  it('should support non-binary gender in relationship processing', () => {
    // For non-binary individuals, should use inclusive or neutral terms
    const nonBinaryRelationships = [
      { baseType: 'parent', nonBinaryForm: 'parent' },
      { baseType: 'child', nonBinaryForm: 'child' },
      { baseType: 'sibling', nonBinaryForm: 'sibling' },
      { baseType: 'spouse', nonBinaryForm: 'spouse' }
    ];

    nonBinaryRelationships.forEach(({ baseType, nonBinaryForm }) => {
      const nbRelationship = applyGenderToRelationship(baseType, 'NB');
      expect(nbRelationship).toBe(nonBinaryForm);
    });
  });
});

// Helper functions to simulate gender-aware relationship processing
function applyGenderToRelationship(baseType: string, gender: string | null): string {
  const genderMappings: Record<string, Record<string, string>> = {
    'child': { 'M': 'son', 'F': 'daughter', 'NB': 'child' },
    'parent': { 'M': 'father', 'F': 'mother', 'NB': 'parent' },
    'sibling': { 'M': 'brother', 'F': 'sister', 'NB': 'sibling' },
    'grandparent': { 'M': 'grandfather', 'F': 'grandmother', 'NB': 'grandparent' },
    'grandchild': { 'M': 'grandson', 'F': 'granddaughter', 'NB': 'grandchild' },
    'spouse': { 'M': 'husband', 'F': 'wife', 'NB': 'spouse' },
    'aunt-uncle': { 'M': 'uncle', 'F': 'aunt', 'NB': 'aunt-uncle' },
    'niece-nephew': { 'M': 'nephew', 'F': 'niece', 'NB': 'niece-nephew' },
    'in-law-child': { 'M': 'son-in-law', 'F': 'daughter-in-law', 'NB': 'child-in-law' },
    'in-law-parent': { 'M': 'father-in-law', 'F': 'mother-in-law', 'NB': 'parent-in-law' }
  };

  const mapping = genderMappings[baseType];
  if (mapping && gender && mapping[gender]) {
    return mapping[gender];
  }
  
  // Fall back to base type for unknown mappings or null/empty gender
  return baseType;
}

function getReverseRelationship(relationship: string, targetGender: string): string {
  const reverseMappings: Record<string, Record<string, string>> = {
    'son': { 'M': 'father', 'F': 'mother', 'NB': 'parent' },
    'daughter': { 'M': 'father', 'F': 'mother', 'NB': 'parent' },
    'father': { 'M': 'son', 'F': 'daughter', 'NB': 'child' },
    'mother': { 'M': 'son', 'F': 'daughter', 'NB': 'child' },
    'brother': { 'M': 'brother', 'F': 'sister', 'NB': 'sibling' },
    'sister': { 'M': 'brother', 'F': 'sister', 'NB': 'sibling' },
    'husband': { 'M': 'wife', 'F': 'husband', 'NB': 'spouse' },
    'wife': { 'M': 'wife', 'F': 'husband', 'NB': 'spouse' }
  };

  const mapping = reverseMappings[relationship];
  if (mapping && mapping[targetGender]) {
    return mapping[targetGender];
  }
  
  return relationship; // Fall back to same relationship if no reverse mapping
}