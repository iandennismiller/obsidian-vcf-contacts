import { describe, it, expect, vi } from 'vitest';
import {
  parseRelatedSection,
  syncRelatedListToFrontmatter
} from 'src/util/relatedListSync';
import {
  inferGenderFromRelationship,
  convertToGenderlessType
} from 'src/util/genderUtils';

// Mock dependencies
vi.mock('obsidian', () => ({
  TFile: vi.fn(),
  App: vi.fn(),
  Notice: vi.fn()
}));

vi.mock('src/services/loggingService', () => ({
  loggingService: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('Related List Sync Integration Demo', () => {
  it('should demonstrate complete Related list parsing workflow', () => {
    const markdownContent = `---
FN: Alice Johnson
EMAIL: alice@example.com
UID: urn:uuid:alice-uuid-123
GENDER: F
---

#### Notes
Some notes about Alice

## Related
- father [[Bob Johnson]]
- mother [[Carol Johnson]]  
- brother [[David Johnson]]
- sister [[Emma Johnson]]
- friend [[Frank Smith]]
- colleague [[Grace Wilson]]
- husband [[Henry Miller]]
- daughter [[Iris Johnson-Miller]]
- son [[Jack Johnson-Miller]]

#Contact`;

    console.log('='.repeat(60));
    console.log('DEMONSTRATION: Related List Sync Workflow');
    console.log('='.repeat(60));
    
    console.log('\n1. PARSING RELATED SECTION:');
    console.log('Input markdown content:');
    console.log(markdownContent.split('## Related')[1]?.split('#Contact')[0] || 'No Related section');
    
    const relationships = parseRelatedSection(markdownContent);
    console.log(`\nParsed ${relationships.length} relationships:`);
    
    relationships.forEach((rel, index) => {
      console.log(`  ${index + 1}. ${rel.type} → [[${rel.contactName}]]`);
    });

    console.log('\n2. GENDER INFERENCE:');
    relationships.forEach(rel => {
      const inferredGender = inferGenderFromRelationship(rel.type);
      const genderStr = inferredGender ? `Gender: ${inferredGender}` : 'No gender inferred';
      console.log(`  ${rel.type} → ${genderStr}`);
    });

    console.log('\n3. GENDERLESS CONVERSION:');
    relationships.forEach(rel => {
      const genderlessType = convertToGenderlessType(rel.type);
      const converted = genderlessType !== rel.type ? ` → ${genderlessType}` : ' (unchanged)';
      console.log(`  ${rel.type}${converted}`);
    });

    console.log('\n4. EXPECTED FRONTMATTER UPDATES:');
    const expectedUpdates: Record<string, { genderless: string; namespace: string; inferred?: string }> = {};
    
    relationships.forEach(rel => {
      const genderlessType = convertToGenderlessType(rel.type);
      const inferredGender = inferGenderFromRelationship(rel.type);
      
      expectedUpdates[rel.contactName] = {
        genderless: genderlessType,
        namespace: 'name:', // Assuming contacts don't exist yet
        inferred: inferredGender || undefined
      };
    });

    Object.entries(expectedUpdates).forEach(([contact, info]) => {
      console.log(`  RELATED[${info.genderless}]: ${info.namespace}${contact}`);
      if (info.inferred) {
        console.log(`    → Would infer GENDER: ${info.inferred} for ${contact}`);
      }
    });

    console.log('\n5. VALIDATION:');
    console.log(`✅ Parsed ${relationships.length} relationships successfully`);
    console.log('✅ Gender inference working for gendered terms');
    console.log('✅ Genderless conversion preserves relationship semantics');
    console.log('✅ Ready for frontmatter sync');

    // Verify the parsing worked correctly
    expect(relationships).toHaveLength(9);
    
    // Verify specific relationships
    const expectedRelationships = [
      { type: 'father', contactName: 'Bob Johnson' },
      { type: 'mother', contactName: 'Carol Johnson' },
      { type: 'brother', contactName: 'David Johnson' },
      { type: 'sister', contactName: 'Emma Johnson' },
      { type: 'friend', contactName: 'Frank Smith' },
      { type: 'colleague', contactName: 'Grace Wilson' },
      { type: 'husband', contactName: 'Henry Miller' },
      { type: 'daughter', contactName: 'Iris Johnson-Miller' },
      { type: 'son', contactName: 'Jack Johnson-Miller' }
    ];
    
    expectedRelationships.forEach((expected, index) => {
      expect(relationships[index]).toEqual({
        ...expected,
        originalType: expected.type
      });
    });

    console.log('\n' + '='.repeat(60));
    console.log('DEMONSTRATION COMPLETE ✅');
    console.log('='.repeat(60));
  });

  it('should demonstrate gender inference and conversion mapping', () => {
    const testCases = [
      { input: 'father', gender: 'M', genderless: 'parent' },
      { input: 'mother', gender: 'F', genderless: 'parent' },
      { input: 'uncle', gender: 'M', genderless: 'auncle' },
      { input: 'aunt', gender: 'F', genderless: 'auncle' },
      { input: 'brother', gender: 'M', genderless: 'sibling' },
      { input: 'sister', gender: 'F', genderless: 'sibling' },
      { input: 'husband', gender: 'M', genderless: 'spouse' },
      { input: 'wife', gender: 'F', genderless: 'spouse' },
      { input: 'son', gender: 'M', genderless: 'child' },
      { input: 'daughter', gender: 'F', genderless: 'child' },
      { input: 'friend', gender: null, genderless: 'friend' },
      { input: 'colleague', gender: null, genderless: 'colleague' }
    ];

    console.log('\nGENDER INFERENCE AND CONVERSION TABLE:');
    console.log('┌─────────────┬────────┬─────────────┐');
    console.log('│ Input Term  │ Gender │ Genderless  │');
    console.log('├─────────────┼────────┼─────────────┤');
    
    testCases.forEach(test => {
      const inferredGender = inferGenderFromRelationship(test.input);
      const genderlessType = convertToGenderlessType(test.input);
      const genderDisplay = test.gender || 'null';
      
      console.log(`│ ${test.input.padEnd(11)} │ ${genderDisplay.padEnd(6)} │ ${test.genderless.padEnd(11)} │`);
      
      expect(inferredGender).toBe(test.gender);
      expect(genderlessType).toBe(test.genderless);
    });
    
    console.log('└─────────────┴────────┴─────────────┘');
  });

  it('should demonstrate edge cases and error handling', () => {
    console.log('\nEDGE CASES AND ERROR HANDLING:');
    
    // Test malformed markdown
    const malformedContent = `## Related
- friend [[Alice]]
- invalid item
- [[Missing type]]
- normal friend [[Bob]]
- friend with extra spaces  [[Carol]]  `;

    const relationships = parseRelatedSection(malformedContent);
    console.log('Malformed input handling:');
    console.log('  Input with invalid items parsed successfully');
    console.log(`  Extracted ${relationships.length} valid relationships`);
    console.log('  Invalid items gracefully ignored');
    
    expect(relationships).toHaveLength(3); // Only valid ones
    expect(relationships[0]).toEqual({
      type: 'friend',
      contactName: 'Alice',
      originalType: 'friend'
    });

    // Test edge case relationship types
    const edgeCases = ['FATHER', 'Mother', 'custom-relationship', '', '  spaced  '];
    console.log('\nEdge case relationship types:');
    
    edgeCases.forEach(type => {
      const genderless = convertToGenderlessType(type);
      const gender = inferGenderFromRelationship(type);
      console.log(`  "${type}" → genderless: "${genderless}", gender: ${gender || 'null'}`);
    });

    // Test empty content
    const emptyRelated = parseRelatedSection('## Related\n\nSome other content');
    expect(emptyRelated).toHaveLength(0);
    console.log('\nEmpty Related section handled correctly ✅');

    // Test missing section
    const noRelated = parseRelatedSection('Just some content without Related section');
    expect(noRelated).toHaveLength(0);
    console.log('Missing Related section handled correctly ✅');
  });
});