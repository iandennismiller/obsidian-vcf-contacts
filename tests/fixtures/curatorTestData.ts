/**
 * @fileoverview Test fixture data for curator processor tests
 * 
 * This module provides consistent test data for curator processor testing,
 * including sample contacts, relationships, and various edge cases.
 * 
 * @module CuratorTestData
 */

import { expect } from 'vitest';
import type { Contact } from '../../src/models/contactNote/types';
import { createMockTFile } from '../setup/curatorMocks';

/**
 * Sample contact data for testing various curator scenarios
 */
export const sampleContacts = {
  // Basic contact with minimal data
  basic: {
    data: {
      FN: 'John Doe',
      UID: 'john-doe-123',
      EMAIL: 'john@example.com'
    },
    file: createMockTFile('John Doe.md')
  } as Contact,

  // Contact with relationships in Related section
  withRelationships: {
    data: {
      FN: 'Bob Smith',
      UID: 'bob-smith-456',
      EMAIL: 'bob@example.com',
      'RELATED[SPOUSE]': 'Alice Smith'
    },
    file: createMockTFile('Bob Smith.md')
  } as Contact,

  // Contact without UID (for UID processor testing)
  withoutUID: {
    data: {
      FN: 'Jane Wilson',
      EMAIL: 'jane@example.com',
      TEL: '+1234567890'
    },
    file: createMockTFile('Jane Wilson.md')
  } as Contact,

  // Contact with gender already set
  withGender: {
    data: {
      FN: 'Alice Johnson',
      UID: 'alice-johnson-789',
      EMAIL: 'alice@example.com',
      GENDER: 'female'
    },
    file: createMockTFile('Alice Johnson.md')
  } as Contact,

  // Contact with old namespace relationships (for upgrade processor)
  withOldNamespace: {
    data: {
      FN: 'Charlie Brown',
      UID: 'charlie-brown-101',
      EMAIL: 'charlie@example.com',
      'spouse': 'Lucy Brown',  // Old format
      'child.1': 'Rerun Brown'  // Old format
    },
    file: createMockTFile('Charlie Brown.md')
  } as Contact,

  // Contact with inconsistent relationships (list vs frontmatter)
  withInconsistentRelationships: {
    data: {
      FN: 'David Lee',
      UID: 'david-lee-202',
      EMAIL: 'david@example.com',
      'RELATED[SPOUSE]': 'Sarah Lee'  // In frontmatter but not in Related section
    },
    file: createMockTFile('David Lee.md')
  } as Contact
};

/**
 * Sample file content strings for testing
 */
export const sampleFileContent = {
  // Contact with Related section
  withRelatedSection: `---
FN: John Doe
UID: john-doe-123
EMAIL: john@example.com  
REV: 20240314T120000Z
---

# John Doe

## Related
- spouse [[Jane Doe]]
- child [[Tommy Doe]]
- parent [[Mary Doe]]

Some additional notes about John.`,

  // Contact without Related section
  withoutRelatedSection: `---
FN: John Doe
UID: john-doe-123
EMAIL: john@example.com
REV: 20240314T120000Z
---

# John Doe

Some notes about John.`,

  // Contact with empty Related section
  withEmptyRelatedSection: `---
FN: John Doe
UID: john-doe-123
EMAIL: john@example.com
REV: 20240314T120000Z
---

# John Doe

## Related

Some additional notes about John.`,

  // Contact with complex relationships
  withComplexRelationships: `---
FN: Bob Smith
UID: bob-smith-456
EMAIL: bob@example.com
RELATED[SPOUSE]: Alice Smith
RELATED[CHILD]: Tommy Smith
RELATED[CHILD]: Sally Smith
REV: 20240314T120000Z
---

# Bob Smith

## Related
- spouse [[Alice Smith]]
- child [[Tommy Smith]]
- child [[Sally Smith]]
- parent [[Robert Smith Sr.]]

Family man with three children.`,

  // Contact with old namespace format
  withOldNamespaceFormat: `---
FN: Charlie Brown
UID: charlie-brown-101
EMAIL: charlie@example.com
spouse: Lucy Brown
child.1: Rerun Brown
child.2: Sally Brown
REV: 20240314T120000Z
---

# Charlie Brown

## Related
- spouse [[Lucy Brown]]
- child [[Rerun Brown]]
- child [[Sally Brown]]

Good grief!`
};

/**
 * Expected outcomes for various curator operations
 */
export const expectedOutcomes = {
  // Expected result after UID processor
  afterUidProcessor: {
    FN: 'Jane Wilson',
    UID: 'jane-wilson-auto-generated',
    EMAIL: 'jane@example.com',
    TEL: '+1234567890',
    REV: expect.stringMatching(/^\d{8}T\d{6}Z$/)
  },

  // Expected result after gender inference
  afterGenderInference: {
    FN: 'Alice Johnson', 
    UID: 'alice-johnson-789',
    EMAIL: 'alice@example.com',
    GENDER: 'female',
    REV: expect.stringMatching(/^\d{8}T\d{6}Z$/)
  },

  // Expected result after namespace upgrade
  afterNamespaceUpgrade: {
    FN: 'Charlie Brown',
    UID: 'charlie-brown-101',
    EMAIL: 'charlie@example.com',
    'RELATED[SPOUSE]': 'Lucy Brown',
    'RELATED[CHILD,1]': 'Rerun Brown',
    'RELATED[CHILD,2]': 'Sally Brown',  
    REV: expect.stringMatching(/^\d{8}T\d{6}Z$/)
  },

  // Expected result after relationship sync
  afterRelationshipSync: {
    FN: 'David Lee',
    UID: 'david-lee-202',
    EMAIL: 'david@example.com',
    'RELATED[SPOUSE]': 'Sarah Lee',
    'RELATED[PARENT]': 'Robert Lee',
    REV: expect.stringMatching(/^\d{8}T\d{6}Z$/)
  }
};

/**
 * Error scenarios for testing error handling
 */
export const errorTestScenarios = {
  // Malformed frontmatter
  malformedFrontmatter: `---
FN: John Doe
UID: john-doe-123
EMAIL: john@example.com
INVALID_YAML: [unclosed array
REV: 20240314T120000Z
---

Content`,

  // Missing frontmatter
  missingFrontmatter: `# John Doe

No frontmatter in this file.`,

  // Contact that causes processing errors
  processingError: {
    data: {
      FN: 'Error Contact',
      UID: 'error-contact-999'
    },
    file: createMockTFile('Error Contact.md')
  } as Contact
};

/**
 * Test cases for relationship type mappings
 */
export const relationshipMappings = {
  // Gender-inferring relationships  
  genderInferring: [
    { type: 'wife', expectedGender: 'female' },
    { type: 'husband', expectedGender: 'male' },
    { type: 'daughter', expectedGender: 'female' },
    { type: 'son', expectedGender: 'male' },
    { type: 'mother', expectedGender: 'female' },
    { type: 'father', expectedGender: 'male' },
    { type: 'sister', expectedGender: 'female' },
    { type: 'brother', expectedGender: 'male' },
    { type: 'girlfriend', expectedGender: 'female' },
    { type: 'boyfriend', expectedGender: 'male' }
  ],

  // Non-gender-inferring relationships
  nonGenderInferring: [
    { type: 'friend' },
    { type: 'colleague' },
    { type: 'neighbor' },
    { type: 'spouse' },  // Generic, could be either gender
    { type: 'child' },   // Generic, could be either gender
    { type: 'parent' },  // Generic, could be either gender
    { type: 'sibling' }  // Generic, could be either gender
  ],

  // Old namespace to new namespace mappings
  namespaceUpgrades: [
    { old: 'spouse', new: 'RELATED[SPOUSE]' },
    { old: 'child.1', new: 'RELATED[CHILD]' },
    { old: 'child.2', new: 'RELATED[CHILD]' },
    { old: 'parent.1', new: 'RELATED[PARENT]' },
    { old: 'parent.2', new: 'RELATED[PARENT]' },
    { old: 'sibling.1', new: 'RELATED[SIBLING]' },
    { old: 'friend.1', new: 'RELATED[FRIEND]' }
  ]
};

/**
 * Performance test data with larger datasets
 */
export const performanceTestData = {
  // Large contact with many relationships
  largeContact: {
    data: {
      FN: 'Large Family Patriarch',
      UID: 'large-family-001',
      EMAIL: 'patriarch@largefamily.com',
      ...Array.from({ length: 50 }, (_, i) => ({ [`RELATED[CHILD]`]: `Child ${i + 1}` })).reduce((acc, curr) => ({ ...acc, ...curr }), {}),
      ...Array.from({ length: 20 }, (_, i) => ({ [`RELATED[GRANDCHILD]`]: `Grandchild ${i + 1}` })).reduce((acc, curr) => ({ ...acc, ...curr }), {}),
    },
    file: createMockTFile('Large Family Patriarch.md')
  } as Contact,

  // Many contacts for batch processing tests
  manyContacts: Array.from({ length: 100 }, (_, i) => ({
    data: {
      FN: `Contact ${i + 1}`,
      UID: `contact-${i + 1}`,
      EMAIL: `contact${i + 1}@example.com`
    },
    file: createMockTFile(`Contact ${i + 1}.md`)
  })) as Contact[]
};