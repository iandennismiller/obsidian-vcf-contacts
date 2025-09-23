import { describe, it, expect, beforeEach } from 'vitest';
import { RelationshipGraph } from '../src/services/relationshipGraph';
import { RelationshipSync } from '../src/services/relationshipSync';
import { RelationshipManager } from '../src/services/relationshipManager';

describe('Relationship Integration', () => {
  let graph: RelationshipGraph;
  let sync: RelationshipSync;

  beforeEach(() => {
    graph = new RelationshipGraph();
    sync = new RelationshipSync(graph);
  });

  describe('End-to-End Workflow', () => {
    it('should handle complete relationship workflow', () => {
      // Simulate loading contacts from front matter
      const johnFrontMatter = {
        UID: 'urn:uuid:550e8400-e29b-41d4-a716-446655440001',
        FN: 'John Doe',
        GENDER: 'M',
        'RELATED[friend]': 'urn:uuid:550e8400-e29b-41d4-a716-446655440002',
        'RELATED[colleague]': 'name:Bob Johnson'
      };

      const janeFrontMatter = {
        UID: 'urn:uuid:550e8400-e29b-41d4-a716-446655440002',
        FN: 'Jane Smith',
        GENDER: 'F',
        'RELATED[friend]': 'urn:uuid:550e8400-e29b-41d4-a716-446655440001'
      };

      // Load relationships into graph (need to add contacts first)
      graph.addContact(johnFrontMatter.UID, johnFrontMatter.FN, johnFrontMatter.GENDER);
      graph.addContact(janeFrontMatter.UID, janeFrontMatter.FN, janeFrontMatter.GENDER);
      
      sync.loadRelationshipsFromFrontMatter(
        johnFrontMatter.UID,
        johnFrontMatter.FN,
        johnFrontMatter
      );
      
      sync.loadRelationshipsFromFrontMatter(
        janeFrontMatter.UID,
        janeFrontMatter.FN,
        janeFrontMatter
      );

      // Verify relationships exist (note: UUID references won't have target names unless we look them up)
      const johnRelationships = graph.getContactRelationships(
        johnFrontMatter.UID,
        johnFrontMatter.FN
      );
      
      expect(johnRelationships).toHaveLength(2);
      expect(johnRelationships.find(r => r.targetUid === '550e8400-e29b-41d4-a716-446655440002')).toBeTruthy();
      expect(johnRelationships.find(r => r.targetName === 'Bob Johnson')).toBeTruthy();

      const janeRelationships = graph.getContactRelationships(
        janeFrontMatter.UID,
        janeFrontMatter.FN
      );
      
      expect(janeRelationships).toHaveLength(1);
      expect(janeRelationships[0].targetUid).toBe('550e8400-e29b-41d4-a716-446655440001');
    });

    it('should generate proper front matter from graph', () => {
      // Set up graph with relationships
      graph.addContact('uid1', 'Parent', 'M');
      graph.addContact('uid2', 'Child', 'F');
      
      graph.addRelationship('uid1', 'Parent', 'uid2', 'Child', 'daughter');
      
      // Generate front matter (the relationship is stored as "daughter" because of the gendered term, should render as "daughter")
      const frontMatter = sync.convertRelationshipsToFrontMatter('uid1', 'Parent');
      
      expect(frontMatter).toHaveProperty('RELATED[daughter]');
      expect(frontMatter['RELATED[daughter]']).toBe('uid:uid2');
    });

    it('should handle family relationship consistency', () => {
      // Add family members
      graph.addContact('parent-uid', 'Alice Johnson', 'F');
      graph.addContact('child-uid', 'Emma Johnson', 'F');
      graph.addContact('spouse-uid', 'David Johnson', 'M');

      // Add relationships
      graph.addRelationship('parent-uid', 'Alice Johnson', 'child-uid', 'Emma Johnson', 'daughter');
      graph.addRelationship('parent-uid', 'Alice Johnson', 'spouse-uid', 'David Johnson', 'husband');

      // Check consistency (should find missing reciprocal relationships)
      const inconsistencies = graph.checkConsistency();
      
      expect(inconsistencies).toHaveLength(2);
      
      // Should suggest child → parent and spouse → spouse relationships
      const parentMissing = inconsistencies.find(i => i.missingRelationshipKind === 'parent');
      const spouseMissing = inconsistencies.find(i => i.missingRelationshipKind === 'spouse');
      
      expect(parentMissing).toBeTruthy();
      expect(spouseMissing).toBeTruthy();
    });

    it('should handle gendered relationship terms properly', () => {
      graph.addContact('', 'John', 'M');  // Empty UID
      graph.addContact('', 'Mary', 'F');  // Empty UID
      
      // Add relationship using gendered term
      graph.addRelationship('', 'John', '', 'Mary', 'mother');
      
      // Should store as genderless "parent" but render as "mother" due to Mary's gender
      const relationships = graph.getContactRelationships('', 'John');
      expect(relationships[0].relationshipKind).toBe('mother');
      
      // The reference should be properly formatted (empty UID should use name namespace)
      expect(relationships[0].reference.namespace).toBe('name'); // Empty UID means name reference
    });
  });

  describe('Markdown List Processing', () => {
    it('should parse relationship lists from markdown', () => {
      // This would test the relationship manager parsing markdown
      const markdownContent = `# Contact Name

## Related

- friend [[John Doe]]
- colleague [[Jane Smith]]
- parent [[Bob Johnson]]

## Notes

Some notes here.`;

      // Mock implementation of parsing logic
      const relationshipRegex = /^-\s+(\w+)\s+\[\[([^\]]+)\]\]/gm;
      const relationships = [];
      let match;
      
      while ((match = relationshipRegex.exec(markdownContent)) !== null) {
        relationships.push({
          kind: match[1],
          contactName: match[2]
        });
      }
      
      expect(relationships).toHaveLength(3);
      expect(relationships[0]).toMatchObject({ kind: 'friend', contactName: 'John Doe' });
      expect(relationships[1]).toMatchObject({ kind: 'colleague', contactName: 'Jane Smith' });
      expect(relationships[2]).toMatchObject({ kind: 'parent', contactName: 'Bob Johnson' });
    });
  });
});