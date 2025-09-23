import { TFile } from 'obsidian';
import { RelationshipGraph, ContactNode, RelationshipEdge } from './relationshipGraph';
import { renderRelationshipKind, Gender } from './relationshipMapping';
import { createNamespaceValue, parseNamespaceValue, findContactByNamespace } from './namespaceUtils';

export interface RelationshipFrontMatterEntry {
  kind: string;
  target: string;
}

/**
 * Parse RELATED fields from front matter into relationship entries
 */
export function parseRelatedFromFrontMatter(frontMatter: Record<string, any>): RelationshipFrontMatterEntry[] {
  const relationships: RelationshipFrontMatterEntry[] = [];
  
  for (const [key, value] of Object.entries(frontMatter)) {
    // Match RELATED[kind] and RELATED[index:kind] patterns
    const match = key.match(/^RELATED\[(?:(\d+):)?([^\]]+)\]$/);
    if (match) {
      const [, index, kind] = match;
      relationships.push({
        kind: kind.trim(),
        target: value.toString().trim()
      });
    }
  }
  
  return relationships;
}

/**
 * Convert relationships to front matter format
 */
export function relationshipsToFrontMatter(relationships: Array<{ kind: string; target: string }>): Record<string, string> {
  const frontMatter: Record<string, string> = {};
  
  // Group relationships by kind
  const grouped = new Map<string, string[]>();
  for (const rel of relationships) {
    if (!grouped.has(rel.kind)) {
      grouped.set(rel.kind, []);
    }
    grouped.get(rel.kind)!.push(rel.target);
  }
  
  // Sort by kind and create front matter entries
  for (const [kind, targets] of Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b))) {
    const sortedTargets = targets.sort();
    
    if (sortedTargets.length === 1) {
      frontMatter[`RELATED[${kind}]`] = sortedTargets[0];
    } else {
      sortedTargets.forEach((target, index) => {
        const key = index === 0 ? `RELATED[${kind}]` : `RELATED[${index}:${kind}]`;
        frontMatter[key] = target;
      });
    }
  }
  
  return frontMatter;
}

/**
 * Sync a contact's relationships from the graph to its front matter
 */
export function syncContactToFrontMatter(
  graph: RelationshipGraph,
  contactNodeId: string,
  targetGender?: Gender
): Record<string, string> {
  const relationships = graph.getRelationshipsForContact(contactNodeId);
  
  const frontMatterRelationships = relationships.map(({ targetNode, relationship }) => {
    // Create namespace value based on target contact's UID and existence
    const namespaceValue = createNamespaceValue(
      targetNode.uid,
      targetNode.fullName,
      true // Contact exists since it's in the graph
    );
    
    return {
      kind: renderRelationshipKind(relationship.genderless, targetGender),
      target: namespaceValue
    };
  });
  
  return relationshipsToFrontMatter(frontMatterRelationships);
}

/**
 * Sync front matter relationships to the graph
 */
export function syncFrontMatterToGraph(
  graph: RelationshipGraph,
  contactNodeId: string,
  frontMatter: Record<string, any>
): void {
  // First, remove existing relationships for this contact
  const existingRelationships = graph.getRelationshipsForContact(contactNodeId);
  for (const { target, relationship } of existingRelationships) {
    graph.removeRelationship(contactNodeId, target, relationship.kind);
  }
  
  // Parse and add new relationships
  const relationships = parseRelatedFromFrontMatter(frontMatter);
  
  for (const { kind, target } of relationships) {
    // Find target contact in graph using namespace value
    const targetNodeId = findContactByNamespace(
      target,
      (uid: string) => graph.findContact(uid),
      (name: string) => graph.findContact(name)
    );
    
    if (targetNodeId) {
      const relationshipEdge: RelationshipEdge = {
        kind,
        genderless: kind // This will be normalized by the relationship mapping
      };
      
      graph.addRelationship(contactNodeId, targetNodeId, relationshipEdge);
    }
  }
}

/**
 * Get contact identifier for graph (prefer UID, fallback to fullName)
 */
export function getContactIdentifier(frontMatter: Record<string, any>): string {
  return frontMatter.UID || frontMatter.FN || frontMatter['N.GN'] + ' ' + frontMatter['N.FN'] || 'Unknown';
}

/**
 * Create a ContactNode from front matter and file
 */
export function createContactNodeFromFrontMatter(frontMatter: Record<string, any>, file: TFile): ContactNode {
  const fullName = frontMatter.FN || 
                   (frontMatter['N.GN'] && frontMatter['N.FN'] ? 
                    `${frontMatter['N.GN']} ${frontMatter['N.FN']}` : 
                    file.basename);
  
  return {
    uid: frontMatter.UID,
    fullName,
    file
  };
}