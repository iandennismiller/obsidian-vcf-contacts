/**
 * @fileoverview Demonstration of VCard 4.0 RELATED field functionality
 * 
 * This demonstrates the complete workflow from VCard parsing to relationship 
 * management and markdown generation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RelationshipGraphService } from '../src/relationships/relationshipGraph';
import { vcard } from '../src/contacts/vcard';

describe('VCard RELATED field workflow demonstration', () => {
  let relationshipService: RelationshipGraphService;

  beforeEach(() => {
    relationshipService = new RelationshipGraphService();
  });

  it('should demonstrate complete relationship workflow', async () => {
    // 1. PARSING: Parse VCard with RELATED fields
    const johnVCard = `BEGIN:VCARD
VERSION:4.0
UID:urn:uuid:12345678-1234-1234-1234-123456789abc
FN:John Doe
N:Doe;John;;;
GENDER:M
RELATED;TYPE=friend:urn:uuid:87654321-4321-4321-4321-cba987654321
RELATED;TYPE=parent:urn:uuid:11111111-1111-1111-1111-111111111111
RELATED;TYPE=spouse:name:Jane Doe
END:VCARD`;

    // Parse the VCard
    const results = [];
    for await (const [slug, record] of vcard.parse(johnVCard)) {
      results.push({ slug, record });
    }

    const johnRecord = results[0].record;
    console.log('📄 Parsed John\'s VCard:', johnRecord);

    // 2. GRAPH MANAGEMENT: Build relationship graph from parsed data
    const johnUID = johnRecord.UID;
    relationshipService.addContact({
      uid: johnUID,
      name: johnRecord.FN,
      gender: johnRecord.GENDER
    });

    // Load relationships into graph
    relationshipService.frontMatterToGraph(johnUID, johnRecord);

    // 3. RELATIONSHIP QUERIES: Get relationships for John
    const johnRelationships = relationshipService.getRelationships(johnUID);
    console.log('🔗 John\'s relationships:', johnRelationships);

    expect(johnRelationships).toHaveLength(3);
    expect(johnRelationships.some(r => r.kind === 'friend')).toBe(true);
    expect(johnRelationships.some(r => r.kind === 'parent')).toBe(true);
    expect(johnRelationships.some(r => r.kind === 'spouse')).toBe(true);

    // 4. GENDER INFERENCE: Demonstrate gender-aware relationship parsing
    const genderedRelationships = [
      { term: 'mother', expected: 'parent', gender: 'female' },
      { term: 'father', expected: 'parent', gender: 'male' },
      { term: 'sister', expected: 'sibling', gender: 'female' },
      { term: 'friend', expected: 'friend', gender: undefined }
    ];

    genderedRelationships.forEach(({ term, expected, gender }) => {
      const parsed = relationshipService.parseRelationshipTerm(term);
      expect(parsed.kind).toBe(expected);
      expect(parsed.inferredGender).toBe(gender);
    });

    console.log('👫 Gender inference working correctly');

    // 5. FRONT MATTER GENERATION: Convert relationships back to front matter format
    const frontMatterEntries = relationshipService.relationshipsToFrontMatter(johnUID);
    console.log('📋 Generated front matter entries:', frontMatterEntries);

    // Should generate proper Obsidian array format
    const keys = frontMatterEntries.map(([key]) => key);
    expect(keys.some(k => k === 'RELATED[friend]' || k.includes('friend'))).toBe(true);
    expect(keys.some(k => k === 'RELATED[parent]' || k.includes('parent'))).toBe(true);

    // 6. CONSISTENCY CHECKING: Demonstrate missing reciprocal detection
    const missingReciprocals = relationshipService.checkConsistency();
    console.log('🔍 Missing reciprocal relationships:', missingReciprocals);

    // Should find missing reciprocals (since we only added John's relationships)
    expect(missingReciprocals.length).toBeGreaterThan(0);

    // 7. DEMONSTRATE MARKDOWN GENERATION: Show how mdRender would work
    // (This would normally be integrated with actual mdRender function)
    const mockRelatedSection = johnRelationships
      .map(rel => {
        const targetName = rel.targetUID.startsWith('name:') 
          ? rel.targetUID.substring(5)
          : `[UID: ${rel.targetUID.substring(0, 8)}...]`;
        return `- ${rel.kind} [[${targetName}]]`;
      })
      .sort()
      .join('\n');

    console.log('📝 Generated Related section:\n## Related\n' + mockRelatedSection);

    expect(mockRelatedSection).toContain('- friend');
    expect(mockRelatedSection).toContain('- parent');
    expect(mockRelatedSection).toContain('- spouse [[Jane Doe]]');

    console.log('✅ Complete VCard RELATED field workflow demonstrated successfully!');
  });

  it('should demonstrate bidirectional relationship management', () => {
    // Add two contacts
    const johnUID = 'urn:uuid:12345678-1234-1234-1234-123456789abc';
    const janeUID = 'urn:uuid:87654321-4321-4321-4321-cba987654321';

    relationshipService.addContact({ uid: johnUID, name: 'John Doe' });
    relationshipService.addContact({ uid: janeUID, name: 'Jane Doe' });

    // Add relationship: John is married to Jane
    relationshipService.addRelationship(johnUID, janeUID, 'spouse');

    // Check that the relationship exists
    const johnRels = relationshipService.getRelationships(johnUID);
    expect(johnRels.some(r => r.kind === 'spouse' && r.targetUID === janeUID)).toBe(true);

    // Add reciprocal: Jane is married to John
    relationshipService.addRelationship(janeUID, johnUID, 'spouse');

    // Both should now have spouse relationships
    const janeRels = relationshipService.getRelationships(janeUID);
    expect(janeRels.some(r => r.kind === 'spouse' && r.targetUID === johnUID)).toBe(true);

    // Consistency check should now be clean
    const missingReciprocals = relationshipService.checkConsistency();
    expect(missingReciprocals.some(r => 
      (r.sourceUID === johnUID && r.targetUID === janeUID) ||
      (r.sourceUID === janeUID && r.targetUID === johnUID)
    )).toBe(false);

    console.log('💑 Bidirectional relationship management working correctly');
  });
});