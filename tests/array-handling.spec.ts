/**
 * Tests for YAML array handling functionality
 */

import { describe, it, expect } from 'vitest';
import { 
  extractRelationshipsFromYAML, 
  relationshipsToYAML,
  RelationshipData
} from '../src/contacts/yamlMarkdownMapper';

describe('YAML Array Handling', () => {
  it('should handle single relationship without indexing', () => {
    const frontmatter = {
      'RELATED[friend]': 'urn:uuid:123-456-789'
    };
    
    const relationships = extractRelationshipsFromYAML(frontmatter);
    expect(relationships).toHaveLength(1);
    expect(relationships[0]).toEqual({
      contactName: '',
      relationshipType: 'friend',
      uid: 'urn:uuid:123-456-789',
      isNameBased: false
    });
  });

  it('should handle multiple relationships with indexing', () => {
    const frontmatter = {
      'RELATED[1:friend]': 'urn:uuid:123-456-789',
      'RELATED[2:friend]': 'urn:uuid:987-654-321'
    };
    
    const relationships = extractRelationshipsFromYAML(frontmatter);
    expect(relationships).toHaveLength(2);
    expect(relationships[0].relationshipType).toBe('friend');
    expect(relationships[1].relationshipType).toBe('friend');
    expect(relationships[0].uid).toBe('urn:uuid:123-456-789');
    expect(relationships[1].uid).toBe('urn:uuid:987-654-321');
  });

  it('should generate proper indexing for multiple relationships of same type', () => {
    const relationships: RelationshipData[] = [
      {
        contactName: 'John Smith',
        relationshipType: 'friend',
        uid: 'urn:uuid:123-456-789',
        isNameBased: false
      },
      {
        contactName: 'Jane Doe',
        relationshipType: 'friend',
        uid: 'urn:uuid:987-654-321',
        isNameBased: false
      }
    ];
    
    const yamlData = relationshipsToYAML(relationships);
    
    expect(yamlData).toEqual({
      'RELATED[1:friend]': 'urn:uuid:123-456-789',
      'RELATED[2:friend]': 'urn:uuid:987-654-321'
    });
  });

  it('should handle single relationship without index when alone', () => {
    const relationships: RelationshipData[] = [
      {
        contactName: 'John Smith',
        relationshipType: 'friend',
        uid: 'urn:uuid:123-456-789',
        isNameBased: false
      }
    ];
    
    const yamlData = relationshipsToYAML(relationships);
    
    expect(yamlData).toEqual({
      'RELATED[friend]': 'urn:uuid:123-456-789'
    });
  });

  it('should handle mixed relationship types correctly', () => {
    const relationships: RelationshipData[] = [
      {
        contactName: 'John Smith',
        relationshipType: 'friend',
        uid: 'urn:uuid:123-456-789',
        isNameBased: false
      },
      {
        contactName: 'Jane Doe',
        relationshipType: 'friend',
        uid: 'urn:uuid:987-654-321',
        isNameBased: false
      },
      {
        contactName: 'Mary Johnson',
        relationshipType: 'spouse',
        uid: 'urn:uuid:555-666-777',
        isNameBased: false
      }
    ];
    
    const yamlData = relationshipsToYAML(relationships);
    
    expect(yamlData).toEqual({
      'RELATED[1:friend]': 'urn:uuid:123-456-789',
      'RELATED[2:friend]': 'urn:uuid:987-654-321',
      'RELATED[spouse]': 'urn:uuid:555-666-777'
    });
  });

  it('should handle name-based relationships in arrays', () => {
    const relationships: RelationshipData[] = [
      {
        contactName: 'John Smith',
        relationshipType: 'friend',
        isNameBased: true
      },
      {
        contactName: 'Jane Doe',
        relationshipType: 'friend',
        uid: 'urn:uuid:987-654-321',
        isNameBased: false
      }
    ];
    
    const yamlData = relationshipsToYAML(relationships);
    
    expect(yamlData).toEqual({
      'RELATED[1:friend]': 'name:John Smith',
      'RELATED[2:friend]': 'urn:uuid:987-654-321'
    });
  });

  it('should skip invalid relationships during YAML generation', () => {
    const relationships: RelationshipData[] = [
      {
        contactName: 'John Smith',
        relationshipType: 'friend',
        uid: 'urn:uuid:123-456-789',
        isNameBased: false
      },
      {
        contactName: '',
        relationshipType: '',
        isNameBased: false
      }, // Invalid relationship
      {
        contactName: 'Jane Doe',
        relationshipType: 'spouse',
        uid: 'urn:uuid:987-654-321',
        isNameBased: false
      }
    ];
    
    const yamlData = relationshipsToYAML(relationships);
    
    expect(yamlData).toEqual({
      'RELATED[friend]': 'urn:uuid:123-456-789',
      'RELATED[spouse]': 'urn:uuid:987-654-321'
    });
  });

  it('should handle legacy non-indexed format mixed with indexed format', () => {
    const frontmatter = {
      'RELATED[friend]': 'urn:uuid:123-456-789',
      'RELATED[1:friend]': 'urn:uuid:987-654-321',
      'RELATED[2:friend]': 'name:Bob Wilson'
    };
    
    const relationships = extractRelationshipsFromYAML(frontmatter);
    expect(relationships).toHaveLength(3);
    
    // All should be recognized as friend relationships
    expect(relationships.every(r => r.relationshipType === 'friend')).toBe(true);
    
    // Check specific values
    const uids = relationships.map(r => r.uid || `name:${r.contactName}`);
    expect(uids).toContain('urn:uuid:123-456-789');
    expect(uids).toContain('urn:uuid:987-654-321');
    expect(uids).toContain('name:Bob Wilson');
  });
});