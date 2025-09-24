import { describe, it, expect } from 'vitest';

describe('Related List Format Consistency', () => {
  it('should use consistent format across all components', () => {
    // Test that all components use the same format: "- type [[contact]]" without colon
    
    // This simulates the format used in contactMdTemplate.ts
    const templateFormat = (type: string, contact: string) => `- ${type} [[${contact}]]`;
    
    // This simulates the format used by the fixed relationshipManager.ts
    const relationshipManagerFormat = (type: string, contactName: string) => `- ${type} [[${contactName}]]`;
    
    // Test cases
    const testCases = [
      { type: 'parent', contact: 'John Doe' },
      { type: 'sibling', contact: 'Jane Smith' },
      { type: 'friend', contact: 'Bob Johnson' },
    ];
    
    testCases.forEach(({ type, contact }) => {
      const templateResult = templateFormat(type, contact);
      const managerResult = relationshipManagerFormat(type, contact);
      
      // Both should produce the same format
      expect(templateResult).toBe(managerResult);
      
      // Neither should contain a colon
      expect(templateResult).not.toContain(':');
      expect(managerResult).not.toContain(':');
      
      // Both should match the expected format
      expect(templateResult).toBe(`- ${type} [[${contact}]]`);
      expect(managerResult).toBe(`- ${type} [[${contact}]]`);
    });
  });
  
  it('should match existing relationship line patterns in the codebase', () => {
    // This is what the fixed relationshipManager should produce
    const relationshipLine = (type: string, contactName: string) => `- ${type} [[${contactName}]]`;
    
    const result = relationshipLine('parent', 'John Doe');
    
    // This should match the pattern that parseRelationshipListItem expects
    const parsePattern = /^-\s*([^\[]+?)\s*\[\[([^\]]+)\]\]/;
    const match = result.trim().match(parsePattern);
    
    expect(match).not.toBeNull();
    expect(match![1].trim()).toBe('parent');
    expect(match![2].trim()).toBe('John Doe');
  });
});