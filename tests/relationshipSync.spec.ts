import { describe, it, expect, beforeEach } from 'vitest';
import { RelationshipSync } from '../src/services/relationshipSync';
import { RelationshipGraph } from '../src/services/relationshipGraph';

describe('RelationshipSync', () => {
  let graph: RelationshipGraph;
  let sync: RelationshipSync;

  beforeEach(() => {
    graph = new RelationshipGraph();
    sync = new RelationshipSync(graph);
  });

  describe('Front Matter Parsing', () => {
    it('should parse simple RELATED field', () => {
      const frontMatter = {
        'RELATED[friend]': 'urn:uuid:550e8400-e29b-41d4-a716-446655440000',
        'RELATED[colleague]': 'name:John Doe'
      };

      const relatedFields = sync.parseRelatedFieldsFromFrontMatter(frontMatter);
      
      expect(relatedFields).toHaveLength(2);
      expect(relatedFields[0]).toMatchObject({
        kind: 'colleague',
        namespace: 'name',
        name: 'John Doe'
      });
      expect(relatedFields[1]).toMatchObject({
        kind: 'friend',
        namespace: 'urn:uuid',
        uid: '550e8400-e29b-41d4-a716-446655440000'
      });
    });

    it('should parse indexed RELATED fields', () => {
      const frontMatter = {
        'RELATED[friend]': 'name:Alice Smith',
        'RELATED[1:friend]': 'name:Bob Johnson',
        'RELATED[2:friend]': 'uid:custom-uid-123'
      };

      const relatedFields = sync.parseRelatedFieldsFromFrontMatter(frontMatter);
      
      expect(relatedFields).toHaveLength(3);
      expect(relatedFields.every(field => field.kind === 'friend')).toBe(true);
    });

    it('should handle invalid RELATED fields gracefully', () => {
      const frontMatter = {
        'RELATED[friend]': 'invalid-format',
        'RELATED-invalid': 'name:John Doe',
        'RELATED[]': 'name:Empty Kind'
      };

      const relatedFields = sync.parseRelatedFieldsFromFrontMatter(frontMatter);
      
      expect(relatedFields).toHaveLength(0);
    });
  });

  describe('Graph to Front Matter Conversion', () => {
    it('should convert relationships to front matter format', () => {
      // Add contacts and relationships to graph
      graph.addContact('uid1', 'John Doe');
      graph.addContact('uid2', 'Alice Smith');
      graph.addContact('uid3', 'Bob Johnson');
      
      graph.addRelationship('uid1', 'John Doe', 'uid2', 'Alice Smith', 'friend');
      graph.addRelationship('uid1', 'John Doe', 'uid3', 'Bob Johnson', 'colleague');
      
      const frontMatterFields = sync.convertRelationshipsToFrontMatter('uid1', 'John Doe');
      
      expect(frontMatterFields).toHaveProperty('RELATED[colleague]');
      expect(frontMatterFields).toHaveProperty('RELATED[friend]');
    });

    it('should handle multiple relationships of same kind', () => {
      graph.addContact('uid1', 'John Doe');
      graph.addContact('uid2', 'Alice Smith');
      graph.addContact('uid3', 'Bob Johnson');
      
      graph.addRelationship('uid1', 'John Doe', 'uid2', 'Alice Smith', 'friend');
      graph.addRelationship('uid1', 'John Doe', 'uid3', 'Bob Johnson', 'friend');
      
      const frontMatterFields = sync.convertRelationshipsToFrontMatter('uid1', 'John Doe');
      
      expect(frontMatterFields).toHaveProperty('RELATED[friend]');
      expect(frontMatterFields).toHaveProperty('RELATED[1:friend]');
    });
  });

  describe('Reference Parsing and Formatting', () => {
    it('should parse urn:uuid references', () => {
      const frontMatter = {
        'RELATED[friend]': 'urn:uuid:550e8400-e29b-41d4-a716-446655440000'
      };

      const fields = sync.parseRelatedFieldsFromFrontMatter(frontMatter);
      
      expect(fields[0]).toMatchObject({
        namespace: 'urn:uuid',
        uid: '550e8400-e29b-41d4-a716-446655440000'
      });
    });

    it('should parse uid references', () => {
      const frontMatter = {
        'RELATED[friend]': 'uid:custom-uid-123'
      };

      const fields = sync.parseRelatedFieldsFromFrontMatter(frontMatter);
      
      expect(fields[0]).toMatchObject({
        namespace: 'uid',
        uid: 'custom-uid-123'
      });
    });

    it('should parse name references', () => {
      const frontMatter = {
        'RELATED[friend]': 'name:John Doe'
      };

      const fields = sync.parseRelatedFieldsFromFrontMatter(frontMatter);
      
      expect(fields[0]).toMatchObject({
        namespace: 'name',
        name: 'John Doe'
      });
    });
  });
});