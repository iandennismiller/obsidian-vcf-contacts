import { parseYaml, stringifyYaml, TFile, App } from "obsidian";
import { getApp } from "src/context/sharedAppContext";
import { RelationshipGraph, RelationshipReference } from "./relationshipGraph";

export interface RelatedField {
  kind: string;
  reference: string;
  namespace: 'urn:uuid' | 'name' | 'uid';
  uid?: string;
  name?: string;
}

/**
 * Handles bidirectional synchronization between front matter RELATED fields and the relationship graph.
 */
export class RelationshipSync {
  private graph: RelationshipGraph;

  constructor(graph: RelationshipGraph) {
    this.graph = graph;
  }

  /**
   * Parse RELATED fields from front matter into structured data
   */
  parseRelatedFieldsFromFrontMatter(frontMatter: Record<string, any>): RelatedField[] {
    const relatedFields: RelatedField[] = [];
    
    Object.entries(frontMatter).forEach(([key, value]) => {
      if (key.startsWith('RELATED')) {
        const parsedRelation = this.parseRelatedKey(key, value as string);
        if (parsedRelation) {
          relatedFields.push(parsedRelation);
        }
      }
    });

    // Sort by kind then by reference for consistent ordering
    return relatedFields.sort((a, b) => {
      const kindCompare = a.kind.localeCompare(b.kind);
      return kindCompare !== 0 ? kindCompare : a.reference.localeCompare(b.reference);
    });
  }

  /**
   * Convert relationship graph data to front matter RELATED fields
   */
  convertRelationshipsToFrontMatter(contactUid: string, contactName: string): Record<string, string> {
    const relationships = this.graph.getContactRelationships(contactUid, contactName);
    const frontMatterFields: Record<string, string> = {};
    const kindCounts = new Map<string, number>();

    relationships.forEach((relationship) => {
      const kind = relationship.relationshipKind;
      const reference = this.formatRelationshipReference(relationship.reference);
      
      // Determine the front matter key
      let key: string;
      const existingCount = kindCounts.get(kind) || 0;
      
      if (existingCount === 0) {
        key = `RELATED[${kind}]`;
      } else {
        key = `RELATED[${existingCount}:${kind}]`;
      }
      
      frontMatterFields[key] = reference;
      kindCounts.set(kind, existingCount + 1);
    });

    return frontMatterFields;
  }

  /**
   * Update front matter RELATED fields for a contact file
   */
  async updateContactRelatedFields(file: TFile, contactUid: string, contactName: string, app?: App): Promise<void> {
    const appInstance = app || getApp();
    const content = await appInstance.vault.read(file);
    
    // Parse existing front matter
    const match = content.match(/^---\n([\s\S]*?)\n---\n?/);
    let yamlObj: any = {};
    let body = content;

    if (match) {
      yamlObj = parseYaml(match[1]) || {};
      body = content.slice(match[0].length);
    }

    // Remove existing RELATED fields
    Object.keys(yamlObj).forEach(key => {
      if (key.startsWith('RELATED')) {
        delete yamlObj[key];
      }
    });

    // Add new RELATED fields from graph
    const newRelatedFields = this.convertRelationshipsToFrontMatter(contactUid, contactName);
    Object.assign(yamlObj, newRelatedFields);

    // Write back to file
    const newFrontMatter = '---\n' + stringifyYaml(yamlObj) + '---\n';
    const newContent = newFrontMatter + body;

    await appInstance.vault.modify(file, newContent);
  }

  /**
   * Load relationships from front matter into the graph
   */
  loadRelationshipsFromFrontMatter(contactUid: string, contactName: string, frontMatter: Record<string, any>): void {
    const relatedFields = this.parseRelatedFieldsFromFrontMatter(frontMatter);
    
    relatedFields.forEach(field => {
      let targetUid = '';
      let targetName = '';
      
      if (field.namespace === 'urn:uuid' && field.uid) {
        targetUid = field.uid;
        targetName = field.name || '';
      } else if (field.namespace === 'uid' && field.uid) {
        targetUid = field.uid;
        targetName = field.name || '';
      } else if (field.namespace === 'name' && field.name) {
        targetName = field.name;
      }
      
      if (targetUid || targetName) {
        this.graph.addRelationship(contactUid, contactName, targetUid, targetName, field.kind);
      }
    });
  }

  /**
   * Sync relationships from graph to all contact files
   */
  async syncGraphToFrontMatter(contactFiles: TFile[], app?: App): Promise<void> {
    const appInstance = app || getApp();
    
    for (const file of contactFiles) {
      const cache = appInstance.metadataCache.getFileCache(file);
      const frontMatter = cache?.frontmatter;
      
      if (frontMatter && frontMatter.UID) {
        const uid = frontMatter.UID;
        const name = frontMatter.FN || file.basename;
        
        await this.updateContactRelatedFields(file, uid, name, appInstance);
      }
    }
  }

  /**
   * Parse a RELATED key from front matter
   */
  private parseRelatedKey(key: string, value: string): RelatedField | null {
    // Extract kind from key like "RELATED[friend]" or "RELATED[1:friend]"
    const kindMatch = key.match(/RELATED\[(?:\d+:)?([^\]]+)\]/);
    if (!kindMatch) {
      return null;
    }
    
    const kind = kindMatch[1];
    const reference = this.parseRelationshipReference(value);
    
    if (reference) {
      return {
        kind,
        reference: value,
        namespace: reference.namespace,
        uid: reference.uid,
        name: reference.name
      };
    }
    
    return null;
  }

  /**
   * Parse relationship reference from front matter value
   */
  private parseRelationshipReference(value: string): RelationshipReference | null {
    // Parse urn:uuid:UUID format
    const uuidMatch = value.match(/^urn:uuid:(.+)$/);
    if (uuidMatch) {
      return {
        uid: uuidMatch[1],
        namespace: 'urn:uuid'
      };
    }
    
    // Parse uid:UID format
    const uidMatch = value.match(/^uid:(.+)$/);
    if (uidMatch) {
      return {
        uid: uidMatch[1],
        namespace: 'uid'
      };
    }
    
    // Parse name:Name format
    const nameMatch = value.match(/^name:(.+)$/);
    if (nameMatch) {
      return {
        name: nameMatch[1],
        namespace: 'name'
      };
    }
    
    return null;
  }

  /**
   * Format relationship reference for front matter
   */
  private formatRelationshipReference(reference: RelationshipReference): string {
    switch (reference.namespace) {
      case 'urn:uuid':
        return `urn:uuid:${reference.uid}`;
      case 'uid':
        return `uid:${reference.uid}`;
      case 'name':
        return `name:${reference.name}`;
      default:
        throw new Error(`Unknown namespace: ${reference.namespace}`);
    }
  }
}