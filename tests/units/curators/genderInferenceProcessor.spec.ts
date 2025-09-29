import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GenderInferenceProcessor } from "../../../src/curators/genderInference";
import { RunType } from "../../../src/interfaces";
import { setupCuratorMocks, cleanupCuratorMocks, createMockContact, createMockContactNote } from '../../setup/curatorMocks';
import { sampleContacts, relationshipMappings } from '../../fixtures/curatorTestData';
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

describe('GenderInferenceProcessor', () => {
  let mockContactNote: ReturnType<typeof createMockContactNote>;
  let mockApp: any;
  let mockSettings: any;

  beforeEach(() => {
    const mocks = setupCuratorMocks();
    mockContactNote = mocks.mockContactNote;
    mockApp = mocks.mockApp;
    mockSettings = mocks.mockSettings;

    // Setup the mocks for each test
    const { getApp } = require('../../../src/context/sharedAppContext');
    const { getSettings } = require('../../../src/context/sharedSettingsContext');
    const { ContactNote } = require('../../../src/models');
    
    vi.mocked(getApp).mockReturnValue(mockApp);
    vi.mocked(getSettings).mockReturnValue(mockSettings);
    vi.mocked(ContactNote).mockImplementation(() => mockContactNote);
  });

  afterEach(() => {
    cleanupCuratorMocks();
  });

  describe('processor properties', () => {
    it('should have correct processor properties', () => {
      expect(GenderInferenceProcessor.name).toBe('GenderInferenceProcessor');
      expect(GenderInferenceProcessor.runType).toBe(RunType.INPROVEMENT);
      expect(GenderInferenceProcessor.settingPropertyName).toBe('genderInferenceProcessor');
      expect(GenderInferenceProcessor.settingDescription).toContain('Automatically infers gender');
      expect(GenderInferenceProcessor.settingDefaultValue).toBe(true);
    });

    it('should have a process function', () => {
      expect(typeof GenderInferenceProcessor.process).toBe('function');
      expect(GenderInferenceProcessor.process).toBeDefined();
    });
  });

  describe('process function', () => {
    it('should return undefined when processor is disabled', async () => {
      mockSettings.genderInferenceProcessor = false;
      const contact = createMockContact();

      const result = await GenderInferenceProcessor.process(contact);

      expect(result).toBeUndefined();
    });

    it('should return undefined when contact has no related section relationships', async () => {
      mockSettings.genderInferenceProcessor = true;
      mockContactNote.parseRelatedSection.mockResolvedValue([]);
      const contact = createMockContact();

      const result = await GenderInferenceProcessor.process(contact);

      expect(result).toBeUndefined();
      expect(mockContactNote.parseRelatedSection).toHaveBeenCalled();
    });

    it('should infer gender from wife relationship type', async () => {
      mockSettings.genderInferenceProcessor = true;
      mockContactNote.parseRelatedSection.mockResolvedValue([
        { type: 'wife', contactName: 'Jane Doe', originalType: 'wife' }
      ]);
      mockContactNote.inferGenderFromRelationship.mockReturnValue('female');
      mockContactNote.getGender.mockResolvedValue(null); // Target contact has no gender yet
      
      const contact = createMockContact();
      const result = await GenderInferenceProcessor.process(contact);

      expect(result).toBeDefined();
      expect(result?.message).toContain('Inferred gender for 1 contact');
      expect(mockContactNote.resolveContact).toHaveBeenCalledWith('Jane Doe');
      expect(mockContactNote.updateGender).toHaveBeenCalledWith('female');
    });

    it('should infer gender from husband relationship type', async () => {
      mockSettings.genderInferenceProcessor = true;
      mockContactNote.parseRelatedSection.mockResolvedValue([
        { type: 'husband', contactName: 'Bob Smith', originalType: 'husband' }
      ]);
      mockContactNote.inferGenderFromRelationship.mockReturnValue('male');
      mockContactNote.getGender.mockResolvedValue(null);
      
      const contact = createMockContact();
      const result = await GenderInferenceProcessor.process(contact);

      expect(result).toBeDefined();
      expect(result?.message).toContain('Inferred gender for 1 contact');
      expect(mockContactNote.updateGender).toHaveBeenCalledWith('male');
    });

    it('should handle multiple relationships with gender inference', async () => {
      mockSettings.genderInferenceProcessor = true;
      mockContactNote.parseRelatedSection.mockResolvedValue([
        { type: 'wife', contactName: 'Jane Doe', originalType: 'wife' },
        { type: 'daughter', contactName: 'Alice Doe', originalType: 'daughter' },
        { type: 'son', contactName: 'Bob Doe', originalType: 'son' }
      ]);
      
      // Mock different gender inferences for different relationship types
      mockContactNote.inferGenderFromRelationship
        .mockReturnValueOnce('female') // wife
        .mockReturnValueOnce('female') // daughter  
        .mockReturnValueOnce('male');   // son
      
      mockContactNote.getGender.mockResolvedValue(null); // All targets have no gender
      
      const contact = createMockContact();
      const result = await GenderInferenceProcessor.process(contact);

      expect(result).toBeDefined();
      expect(result?.message).toContain('Inferred gender for 3 contacts');
      expect(mockContactNote.updateGender).toHaveBeenCalledTimes(3);
      expect(mockContactNote.updateGender).toHaveBeenNthCalledWith(1, 'female');
      expect(mockContactNote.updateGender).toHaveBeenNthCalledWith(2, 'female');
      expect(mockContactNote.updateGender).toHaveBeenNthCalledWith(3, 'male');
    });

    it('should skip contacts that already have gender set', async () => {
      mockSettings.genderInferenceProcessor = true;
      mockContactNote.parseRelatedSection.mockResolvedValue([
        { type: 'wife', contactName: 'Jane Doe', originalType: 'wife' }
      ]);
      mockContactNote.inferGenderFromRelationship.mockReturnValue('female');
      mockContactNote.getGender.mockResolvedValue('female'); // Already has gender
      
      const contact = createMockContact();
      const result = await GenderInferenceProcessor.process(contact);

      expect(result).toBeUndefined();
      expect(mockContactNote.updateGender).not.toHaveBeenCalled();
    });

    it('should skip relationships that do not imply gender', async () => {
      mockSettings.genderInferenceProcessor = true;
      mockContactNote.parseRelatedSection.mockResolvedValue([
        { type: 'friend', contactName: 'Alex Taylor', originalType: 'friend' }
      ]);
      mockContactNote.inferGenderFromRelationship.mockReturnValue(null); // No gender inference
      
      const contact = createMockContact();
      const result = await GenderInferenceProcessor.process(contact);

      expect(result).toBeUndefined();
      expect(mockContactNote.resolveContact).not.toHaveBeenCalled();
      expect(mockContactNote.updateGender).not.toHaveBeenCalled();
    });

    it('should handle unresolvable contacts gracefully', async () => {
      mockSettings.genderInferenceProcessor = true;
      mockContactNote.parseRelatedSection.mockResolvedValue([
        { type: 'wife', contactName: 'Unknown Person', originalType: 'wife' }
      ]);
      mockContactNote.inferGenderFromRelationship.mockReturnValue('female');
      mockContactNote.resolveContact.mockResolvedValue(null); // Cannot resolve contact
      
      const contact = createMockContact();
      const result = await GenderInferenceProcessor.process(contact);

      expect(result).toBeUndefined();
      expect(mockContactNote.updateGender).not.toHaveBeenCalled();
    });

    it('should handle errors in relationship processing gracefully', async () => {
      mockSettings.genderInferenceProcessor = true;
      mockContactNote.parseRelatedSection.mockResolvedValue([
        { type: 'wife', contactName: 'Jane Doe', originalType: 'wife' }
      ]);
      mockContactNote.inferGenderFromRelationship.mockReturnValue('female');
      mockContactNote.resolveContact.mockRejectedValue(new Error('Network error'));
      
      const contact = createMockContact();
      const result = await GenderInferenceProcessor.process(contact);

      expect(result).toBeUndefined(); // Should not crash, just return undefined
    });

    it('should handle processing errors gracefully', async () => {
      mockSettings.genderInferenceProcessor = true;
      mockContactNote.parseRelatedSection.mockRejectedValue(new Error('Parse error'));
      
      const contact = createMockContact();
      const result = await GenderInferenceProcessor.process(contact);

      expect(result).toBeUndefined(); // Should not crash
    });
  });

  describe('gender inference logic', () => {
    it.each(relationshipMappings.genderInferring)(
      'should correctly infer gender for relationship type: $type',
      async ({ type, expectedGender }) => {
        mockSettings.genderInferenceProcessor = true;
        mockContactNote.parseRelatedSection.mockResolvedValue([
          { type, contactName: 'Test Contact', originalType: type }
        ]);
        mockContactNote.inferGenderFromRelationship.mockReturnValue(expectedGender);
        mockContactNote.getGender.mockResolvedValue(null);
        
        const contact = createMockContact();
        const result = await GenderInferenceProcessor.process(contact);

        expect(result).toBeDefined();
        expect(mockContactNote.updateGender).toHaveBeenCalledWith(expectedGender);
      }
    );

    it.each(relationshipMappings.nonGenderInferring)(
      'should not infer gender for relationship type: $type',
      async ({ type }) => {
        mockSettings.genderInferenceProcessor = true;
        mockContactNote.parseRelatedSection.mockResolvedValue([
          { type, contactName: 'Test Contact', originalType: type }
        ]);
        mockContactNote.inferGenderFromRelationship.mockReturnValue(null);
        
        const contact = createMockContact();
        const result = await GenderInferenceProcessor.process(contact);

        expect(result).toBeUndefined();
        expect(mockContactNote.updateGender).not.toHaveBeenCalled();
      }
    );
  });

  describe('result formatting', () => {
    it('should return proper CuratorQueItem structure', async () => {
      mockSettings.genderInferenceProcessor = true;
      mockContactNote.parseRelatedSection.mockResolvedValue([
        { type: 'wife', contactName: 'Jane Doe', originalType: 'wife' }
      ]);
      mockContactNote.inferGenderFromRelationship.mockReturnValue('female');
      mockContactNote.getGender.mockResolvedValue(null);
      
      const contact = createMockContact();
      const result = await GenderInferenceProcessor.process(contact);

      expect(result).toMatchObject({
        name: 'GenderInferenceProcessor',
        runType: RunType.INPROVEMENT,
        file: contact.file,
        message: expect.stringContaining('Inferred gender'),
        render: expect.any(Function),
        renderGroup: expect.any(Function)
      });
    });

    it('should use singular form for single contact', async () => {
      mockSettings.genderInferenceProcessor = true;
      mockContactNote.parseRelatedSection.mockResolvedValue([
        { type: 'wife', contactName: 'Jane Doe', originalType: 'wife' }
      ]);
      mockContactNote.inferGenderFromRelationship.mockReturnValue('female');
      mockContactNote.getGender.mockResolvedValue(null);
      
      const contact = createMockContact();
      const result = await GenderInferenceProcessor.process(contact);

      expect(result?.message).toContain('Inferred gender for 1 contact based');
      expect(result?.message).not.toContain('contacts'); // Should be singular
    });

    it('should use plural form for multiple contacts', async () => {
      mockSettings.genderInferenceProcessor = true;
      mockContactNote.parseRelatedSection.mockResolvedValue([
        { type: 'wife', contactName: 'Jane Doe', originalType: 'wife' },
        { type: 'son', contactName: 'Bob Doe', originalType: 'son' }
      ]);
      mockContactNote.inferGenderFromRelationship
        .mockReturnValueOnce('female')
        .mockReturnValueOnce('male');
      mockContactNote.getGender.mockResolvedValue(null);
      
      const contact = createMockContact();
      const result = await GenderInferenceProcessor.process(contact);

      expect(result?.message).toContain('Inferred gender for 2 contacts based');
    });
  });
});