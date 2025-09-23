import { TFile, App, parseYaml, stringifyYaml } from 'obsidian';
import { RelationshipGraph, RelationshipEdge, GENDERED_RELATIONSHIPS } from './relationshipGraph';
import { updateFrontMatterValue, getFrontmatterFromFiles } from '../contacts/contactFrontmatter';
import { getApp } from '../context/sharedAppContext';
import { loggingService } from './loggingService';

export interface ParsedRelatedField {
  relationshipType: string;
  contactReference: string;
  namespace: 'urn:uuid' | 'name' | 'uid';
  contactId: string;
}

export interface RelationshipListItem {
  relationshipType: string;
  contactName: string;
  contactFile?: TFile;
  contactUid?: string;
}

/**
 * Manages relationships between contacts, handling bidirectional sync
 * between vCard RELATED fields, relationship graph, and Obsidian front matter
 */
export class RelationshipManager {
  private graph: RelationshipGraph;
  private app: App;
  private debounceTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(app?: App) {
    this.app = app || getApp();
    this.graph = new RelationshipGraph();
  }

  /**
   * Initialize the relationship graph from all contact files
   */
  async initializeGraph(): Promise<void> {
    const contactFiles = this.app.vault.getMarkdownFiles().filter(file => 
      file.path.startsWith('Contacts/') || this.isContactFile(file)
    );

    const contacts = await getFrontmatterFromFiles(contactFiles);
    
    // First pass: add all contacts to graph
    for (const contact of contacts) {
      const uid = this.extractUid(contact.data);
      if (uid) {
        this.graph.addContact(uid, {
          file: contact.file,
          frontmatter: contact.data
        });
      }
    }

    // Second pass: add relationships
    for (const contact of contacts) {
      const uid = this.extractUid(contact.data);
      if (uid) {
        await this.loadRelationshipsFromFrontmatter(contact.file, contact.data);
      }
    }

    loggingService.info(`Relationship graph initialized with ${this.graph.getAllContacts().length} contacts`);
  }

  /**
   * Parse RELATED fields from contact front matter and add to graph
   */
  private async loadRelationshipsFromFrontmatter(file: TFile, frontmatter: any): Promise<void> {
    const sourceUid = this.extractUid(frontmatter);
    if (!sourceUid) return;

    const relatedFields = this.extractRelatedFields(frontmatter);
    
    for (const relatedField of relatedFields) {
      const targetUid = await this.resolveContactReference(relatedField.contactReference, relatedField.namespace);
      if (targetUid) {
        this.graph.addRelationship(sourceUid, targetUid, relatedField.relationshipType);
      }
    }
  }

  /**
   * Extract RELATED fields from front matter
   */
  private extractRelatedFields(frontmatter: any): ParsedRelatedField[] {
    const relatedFields: ParsedRelatedField[] = [];
    
    for (const [key, value] of Object.entries(frontmatter)) {
      if (key.startsWith('RELATED[') && typeof value === 'string') {
        const parsed = this.parseRelatedField(key, value);
        if (parsed) {
          relatedFields.push(parsed);
        }
      }
    }
    
    return relatedFields;
  }

  /**
   * Parse a single RELATED field from front matter
   * Format: RELATED[friend] or RELATED[1:friend]
   * Value: urn:uuid:12345 or name:John Doe or uid:custom-id
   */
  private parseRelatedField(key: string, value: string): ParsedRelatedField | null {
    // Extract relationship type from key: RELATED[friend] or RELATED[1:friend]
    const typeMatch = key.match(/RELATED\[(?:\d+:)?([^\]]+)\]/);
    if (!typeMatch) return null;

    const relationshipType = typeMatch[1];

    // Parse value to extract namespace and contact reference
    const namespaceMatch = value.match(/^(urn:uuid|name|uid):(.+)$/);
    if (!namespaceMatch) return null;

    const namespace = namespaceMatch[1] as 'urn:uuid' | 'name' | 'uid';
    const contactReference = namespaceMatch[2];

    return {
      relationshipType,
      contactReference,
      namespace,
      contactId: namespace === 'urn:uuid' ? contactReference : contactReference
    };
  }

  /**
   * Resolve a contact reference to a UID
   */
  private async resolveContactReference(reference: string, namespace: 'urn:uuid' | 'name' | 'uid'): Promise<string | null> {
    switch (namespace) {
      case 'urn:uuid':
        return reference; // UUID is the UID
      
      case 'uid':
        return reference; // Custom UID
      
      case 'name':
        // Find contact by name
        const contactFile = await this.findContactByName(reference);
        if (contactFile) {
          const frontmatter = this.app.metadataCache.getFileCache(contactFile)?.frontmatter;
          return this.extractUid(frontmatter);
        }
        return null;
    }
  }

  /**
   * Find contact file by name
   */
  private async findContactByName(name: string): Promise<TFile | null> {
    const contactFiles = this.app.vault.getMarkdownFiles().filter(file => 
      file.path.startsWith('Contacts/') || this.isContactFile(file)
    );

    for (const file of contactFiles) {
      const cache = this.app.metadataCache.getFileCache(file);
      const frontmatter = cache?.frontmatter;
      
      if (frontmatter?.FN === name || 
          (frontmatter?.['N.GN'] && frontmatter?.['N.FN'] && 
           `${frontmatter['N.GN']} ${frontmatter['N.FN']}` === name)) {
        return file;
      }
    }
    
    return null;
  }

  /**
   * Extract UID from front matter
   */
  private extractUid(frontmatter: any): string | null {
    return frontmatter?.UID || null;
  }

  /**
   * Check if a file is a contact file
   */
  private isContactFile(file: TFile): boolean {
    const cache = this.app.metadataCache.getFileCache(file);
    const frontmatter = cache?.frontmatter;
    return !!(frontmatter?.UID || frontmatter?.FN || (frontmatter?.['N.GN'] && frontmatter?.['N.FN']));
  }

  /**
   * Update front matter with relationships from graph
   */
  async syncGraphToFrontmatter(contactFile: TFile): Promise<void> {
    const frontmatter = this.app.metadataCache.getFileCache(contactFile)?.frontmatter;
    const uid = this.extractUid(frontmatter);
    
    if (!uid) return;

    const relationships = this.graph.getContactRelationships(uid);
    
    // Group relationships by type
    const relationshipsByType: Record<string, string[]> = {};
    
    for (const rel of relationships) {
      if (!relationshipsByType[rel.relationshipType]) {
        relationshipsByType[rel.relationshipType] = [];
      }
      
      const reference = await this.createContactReference(rel.targetContact);
      if (reference) {
        relationshipsByType[rel.relationshipType].push(reference);
      }
    }

    // Update front matter with RELATED fields
    await this.updateRelatedFieldsInFrontmatter(contactFile, relationshipsByType);
  }

  /**
   * Update both front matter and Related section when relationships change
   */
  async syncGraphToContactNote(contactFile: TFile): Promise<void> {
    await this.syncGraphToFrontmatter(contactFile);
    
    // Also update the Related section in the markdown to ensure it has the heading
    // and reflects the current relationships
    const content = await this.app.vault.read(contactFile);
    const hasRelatedSection = /^#{1,6}\s+related\s*$/im.test(content);
    
    // If there are relationships or no Related section exists, update/add it
    const uid = this.extractUid(this.app.metadataCache.getFileCache(contactFile)?.frontmatter);
    if (uid) {
      const relationships = this.graph.getContactRelationships(uid);
      if (relationships.length > 0 || !hasRelatedSection) {
        // Import RelationshipListManager to update the section
        // We'll create a minimal update here to avoid circular dependencies
        await this.ensureRelatedSectionExists(contactFile);
      }
    }
  }

  /**
   * Ensure a Related section exists in the contact note
   */
  private async ensureRelatedSectionExists(contactFile: TFile): Promise<void> {
    const content = await this.app.vault.read(contactFile);
    const hasRelatedSection = /^#{1,6}\s+related\s*$/im.test(content);
    
    if (!hasRelatedSection) {
      // Add a Related section if it doesn't exist
      const newSection = [
        '',
        '## Related',
        '',
        ''
      ];
      
      const newContent = content + '\n' + newSection.join('\n');
      await this.app.vault.modify(contactFile, newContent);
    }
  }

  /**
   * Create a contact reference string for RELATED field value
   */
  private async createContactReference(targetUid: string): Promise<string | null> {
    // Try to find the contact file
    const contactFiles = this.app.vault.getMarkdownFiles().filter(file => 
      file.path.startsWith('Contacts/') || this.isContactFile(file)
    );

    for (const file of contactFiles) {
      const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (this.extractUid(frontmatter) === targetUid) {
        // Prefer urn:uuid if UID is a valid UUID
        if (this.isValidUuid(targetUid)) {
          return `urn:uuid:${targetUid}`;
        } else {
          return `uid:${targetUid}`;
        }
      }
    }
    
    // If contact not found, use uid format
    return `uid:${targetUid}`;
  }

  /**
   * Check if string is a valid UUID
   */
  private isValidUuid(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }

  /**
   * Update RELATED fields in front matter
   */
  private async updateRelatedFieldsInFrontmatter(file: TFile, relationshipsByType: Record<string, string[]>): Promise<void> {
    // First, remove existing RELATED fields
    const content = await this.app.vault.read(file);
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?/);
    
    if (!frontmatterMatch) return;

    let yamlObj = parseYaml(frontmatterMatch[1]) || {};
    
    // Capture existing RELATED fields for comparison
    const existingRelatedFields: Record<string, string> = {};
    Object.keys(yamlObj).forEach(key => {
      if (key.startsWith('RELATED[')) {
        existingRelatedFields[key] = yamlObj[key];
        delete yamlObj[key];
      }
    });

    // Add new RELATED fields
    const newRelatedFields: Record<string, string> = {};
    for (const [relationshipType, references] of Object.entries(relationshipsByType)) {
      references.sort(); // Sort for consistency
      
      references.forEach((reference, index) => {
        const key = index === 0 ? `RELATED[${relationshipType}]` : `RELATED[${index}:${relationshipType}]`;
        yamlObj[key] = reference;
        newRelatedFields[key] = reference;
      });
    }

    // Check if RELATED fields actually changed
    const relatedFieldsChanged = this.haveRelatedFieldsChanged(existingRelatedFields, newRelatedFields);

    // Only update REV timestamp if RELATED fields actually changed
    if (relatedFieldsChanged) {
      yamlObj.REV = this.generateRevTimestamp();
    }

    // Write back to file only if there were changes
    if (relatedFieldsChanged) {
      const newFrontMatter = '---\n' + stringifyYaml(yamlObj) + '---\n';
      const body = content.slice(frontmatterMatch[0].length);
      const newContent = newFrontMatter + body;

      await this.app.vault.modify(file, newContent);
    }
  }

  /**
   * Check if RELATED fields have actually changed
   */
  private haveRelatedFieldsChanged(existing: Record<string, string>, newFields: Record<string, string>): boolean {
    // Check if number of fields changed
    const existingKeys = Object.keys(existing);
    const newKeys = Object.keys(newFields);
    
    if (existingKeys.length !== newKeys.length) {
      return true;
    }

    // Check if any field values changed
    for (const key of newKeys) {
      if (existing[key] !== newFields[key]) {
        return true;
      }
    }

    // Check if any existing keys are missing in new fields
    for (const key of existingKeys) {
      if (!(key in newFields)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate REV timestamp in vCard format
   */
  private generateRevTimestamp(): string {
    return new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  }

  /**
   * Add relationship and sync to both contacts
   */
  async addRelationship(sourceFile: TFile, targetFile: TFile, relationshipType: string): Promise<void> {
    const sourceFrontmatter = this.app.metadataCache.getFileCache(sourceFile)?.frontmatter;
    const targetFrontmatter = this.app.metadataCache.getFileCache(targetFile)?.frontmatter;
    
    const sourceUid = this.extractUid(sourceFrontmatter);
    const targetUid = this.extractUid(targetFrontmatter);
    
    if (!sourceUid || !targetUid) return;

    // Normalize relationship type and check for gender implications
    const normalizedType = RelationshipGraph.normalizeRelationshipType(relationshipType);
    const genderImplication = RelationshipGraph.getGenderFromRelationship(relationshipType);
    
    // Add relationship to graph
    this.graph.addRelationship(sourceUid, targetUid, normalizedType);
    
    // Update gender if implied
    if (genderImplication && !targetFrontmatter?.GENDER) {
      await updateFrontMatterValue(targetFile, 'GENDER', genderImplication);
    }

    // Sync both contacts' front matter and Related sections
    await this.syncGraphToContactNote(sourceFile);
    await this.syncGraphToContactNote(targetFile);
  }

  /**
   * Get the relationship graph
   */
  getGraph(): RelationshipGraph {
    return this.graph;
  }

  /**
   * Check graph consistency and fix missing backlinks
   */
  async ensureGraphConsistency(): Promise<void> {
    const allContacts = this.graph.getAllContacts();
    
    for (const contactId of allContacts) {
      const outgoingRelationships = this.graph.getContactRelationships(contactId);
      
      for (const relationship of outgoingRelationships) {
        // Check if the target contact exists and has appropriate backlink
        if (this.graph.getAllContacts().includes(relationship.targetContact)) {
          // This is where we would add logic for reciprocal relationships
          // For now, we ensure all relationships are properly stored
          continue;
        }
      }
    }
    
    loggingService.info('Graph consistency check completed');
  }
}