import { describe, it, expect } from 'vitest';
import { 
  getReciprocalRelationshipType, 
  isSymmetricRelationship 
} from 'src/util/reciprocalRelationships';

describe('Reciprocal Relationships Demo', () => {
  it('should demonstrate reciprocal relationship type mapping', () => {
    console.log(`
============================================================
RECIPROCAL RELATIONSHIP MAPPING DEMONSTRATION
============================================================

1. ASYMMETRIC RELATIONSHIPS (A → B, B → A):
`);

    const asymmetricTests = [
      { input: 'parent', expected: 'child' },
      { input: 'child', expected: 'parent' },
      { input: 'grandparent', expected: 'grandchild' },
      { input: 'grandchild', expected: 'grandparent' },
      { input: 'auncle', expected: 'nibling' },
      { input: 'nibling', expected: 'auncle' }
    ];

    asymmetricTests.forEach(test => {
      const actual = getReciprocalRelationshipType(test.input);
      console.log(`  ${test.input.padEnd(12)} → ${actual}`);
      expect(actual).toBe(test.expected);
    });

    console.log(`
2. SYMMETRIC RELATIONSHIPS (A → B, B → A - same type):
`);

    const symmetricTests = [
      'sibling', 'spouse', 'partner', 'friend', 'colleague', 'relative', 'cousin'
    ];

    symmetricTests.forEach(type => {
      const reciprocal = getReciprocalRelationshipType(type);
      const isSymmetric = isSymmetricRelationship(type);
      console.log(`  ${type.padEnd(12)} → ${reciprocal} (symmetric: ${isSymmetric})`);
      expect(reciprocal).toBe(type);
      expect(isSymmetric).toBe(true);
    });

    console.log(`
3. NO RECIPROCAL RELATIONSHIPS:
`);

    const noReciprocalTests = ['boss', 'employee', 'teacher', 'student', 'unknown'];

    noReciprocalTests.forEach(type => {
      const reciprocal = getReciprocalRelationshipType(type);
      console.log(`  ${type.padEnd(12)} → ${reciprocal || 'null'}`);
      expect(reciprocal).toBeNull();
    });

    console.log(`
4. REAL-WORLD SCENARIO:
   John has a parent relationship with Jane.
   For reciprocal consistency, Jane should have a child relationship with John.
`);

    const johnToJane = 'parent';
    const janeToJohn = getReciprocalRelationshipType(johnToJane);
    console.log(`   John → parent → Jane`);
    console.log(`   Jane → ${janeToJohn} → John`);
    
    expect(janeToJohn).toBe('child');

    console.log(`
============================================================
DEMONSTRATION COMPLETE ✅
============================================================
`);
  });

  it('should demonstrate case sensitivity handling', () => {
    console.log(`
CASE SENSITIVITY TEST:
`);

    const caseTests = [
      { input: 'Parent', expected: 'child' },
      { input: 'CHILD', expected: 'parent' },
      { input: 'Friend', expected: 'friend' },
      { input: 'SPOUSE', expected: 'spouse' }
    ];

    caseTests.forEach(test => {
      const actual = getReciprocalRelationshipType(test.input);
      console.log(`  "${test.input}" → "${actual}"`);
      expect(actual).toBe(test.expected);
    });
  });
});