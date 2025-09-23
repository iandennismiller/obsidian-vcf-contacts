import { TFile, App } from 'obsidian';
import { RelationshipGraph, ContactNode, RelationshipEdge } from './relationshipGraph';
import { normalizeRelationshipKind, inferGenderFromRelationship, renderRelationshipKind, Gender } from './relationshipMapping';
import { 
  parseRelatedFromFrontMatter, 
  relationshipsToFrontMatter, 
  syncContactToFrontMatter, 
  syncFrontMatterToGraph,
  getContactIdentifier,
  createContactNodeFromFrontMatter
} from './frontMatterSync';
import { 
  parseRelatedSection, 
  updateRelatedSection, 
  cleanupRelatedHeadings,
  RelatedListItem
} from './markdownParser';
import { updateFrontMatterValue } from '../contacts/contactFrontmatter';
import { getApp } from '../context/sharedAppContext';

export class RelationshipService {
  private graph: RelationshipGraph;

  constructor() {
    this.graph = new RelationshipGraph();
  }

  /**
   * Initialize the relationship graph from existing contacts
   */
  async initializeFromContacts(contacts: Array<{ file: TFile; data: Record<string, any> }>): Promise<void> {
    this.graph.clear();

    // First pass: Add all contacts to the graph
    for (const { file, data } of contacts) {
      const nodeId = getContactIdentifier(data);
      const contactNode = createContactNodeFromFrontMatter(data, file);
      this.graph.addContact(nodeId, contactNode);
    }

    // Second pass: Add relationships
    for (const { data } of contacts) {
      const nodeId = getContactIdentifier(data);
      try {
        syncFrontMatterToGraph(this.graph, nodeId, data);
      } catch (error) {
        console.warn(`Failed to sync relationships for contact ${nodeId}:`, error);
      }
    }
  }

  /**
   * Update a contact in the graph
   */
  updateContact(file: TFile, frontMatter: Record<string, any>): void {
    const nodeId = getContactIdentifier(frontMatter);
    const contactNode = createContactNodeFromFrontMatter(frontMatter, file);
    
    this.graph.addContact(nodeId, contactNode);
    syncFrontMatterToGraph(this.graph, nodeId, frontMatter);
  }

  /**
   * Remove a contact from the graph
   */
  removeContact(frontMatter: Record<string, any>): void {
    const nodeId = getContactIdentifier(frontMatter);
    this.graph.removeContact(nodeId);
  }

  /**
   * Sync relationships from markdown content to front matter and graph
   */
  async syncFromMarkdown(file: TFile, app?: App): Promise<void> {
    const appInstance = app || getApp();
    const content = await appInstance.vault.read(file);
    const frontMatter = appInstance.metadataCache.getFileCache(file)?.frontmatter;
    
    if (!frontMatter) {
      return;
    }

    const nodeId = getContactIdentifier(frontMatter);
    
    // Parse Related section from markdown
    const { relatedItems } = parseRelatedSection(content);
    
    // Update graph with relationships from markdown
    this.updateRelationshipsFromMarkdown(nodeId, relatedItems, frontMatter);
    
    // Update front matter
    await this.updateContactFrontMatter(file, nodeId, app);
  }

  /**
   * Update relationships in the graph from markdown list items
   */
  private updateRelationshipsFromMarkdown(
    nodeId: string, 
    relatedItems: RelatedListItem[], 
    frontMatter: Record<string, any>
  ): void {
    // Remove existing relationships for this contact
    const existingRelationships = this.graph.getRelationshipsForContact(nodeId);
    for (const { target, relationship } of existingRelationships) {
      this.graph.removeRelationship(nodeId, target, relationship.kind);
    }

    // Add new relationships
    for (const { kind, target } of relatedItems) {
      const targetNodeId = this.graph.findContact(target);
      
      if (targetNodeId) {
        const genderlessKind = normalizeRelationshipKind(kind);
        const relationshipEdge: RelationshipEdge = {
          kind,
          genderless: genderlessKind
        };
        
        this.graph.addRelationship(nodeId, targetNodeId, relationshipEdge);
        
        // Infer gender if the relationship is gendered
        const inferredGender = inferGenderFromRelationship(kind);
        if (inferredGender) {
          // Update the target contact's gender if not already set
          const targetNode = this.graph.getAllContacts().get(targetNodeId);
          if (targetNode?.file) {
            this.updateContactGender(targetNode.file, inferredGender);
          }
        }
      }
    }
  }

  /**
   * Update a contact's front matter with current relationships
   */
  async updateContactFrontMatter(file: TFile, nodeId: string, app?: App): Promise<void> {
    const appInstance = app || getApp();
    const frontMatter = appInstance.metadataCache.getFileCache(file)?.frontmatter;
    
    if (!frontMatter) {
      return;
    }

    // Get current relationships from graph
    const relationships = this.graph.getRelationshipsForContact(nodeId);
    
    // Convert to front matter format
    const frontMatterRelationships = relationships.map(({ targetNode, relationship }) => ({
      kind: relationship.kind,
      target: targetNode.fullName
    }));
    
    const newRelatedFrontMatter = relationshipsToFrontMatter(frontMatterRelationships);
    
    // Remove existing RELATED fields
    const updatedFrontMatter = { ...frontMatter };
    for (const key of Object.keys(updatedFrontMatter)) {
      if (key.startsWith('RELATED[')) {
        delete updatedFrontMatter[key];
      }
    }
    
    // Add new RELATED fields
    Object.assign(updatedFrontMatter, newRelatedFrontMatter);
    
    // Update the file's front matter
    for (const [key, value] of Object.entries(newRelatedFrontMatter)) {
      await updateFrontMatterValue(file, key, value, appInstance);
    }
  }

  /**
   * Update a contact's Related section in markdown
   */
  async updateContactMarkdown(file: TFile, nodeId: string, app?: App): Promise<void> {
    const appInstance = app || getApp();
    const content = await appInstance.vault.read(file);
    const frontMatter = appInstance.metadataCache.getFileCache(file)?.frontmatter;
    
    if (!frontMatter) {
      return;
    }

    // Get current relationships from graph
    const relationships = this.graph.getRelationshipsForContact(nodeId);
    
    // Get target's gender for rendering relationships
    const relatedItems: RelatedListItem[] = relationships.map(({ targetNode, relationship }) => {
      const targetGender = this.getContactGender(targetNode);
      const renderedKind = renderRelationshipKind(relationship.genderless, targetGender);
      
      return {
        kind: renderedKind,
        target: targetNode.fullName
      };
    });
    
    // Clean up multiple Related headings
    let updatedContent = cleanupRelatedHeadings(content);
    
    // Update the Related section
    updatedContent = updateRelatedSection(updatedContent, relatedItems);
    
    // Write back to file
    await appInstance.vault.modify(file, updatedContent);
  }

  /**
   * Get a contact's gender from their front matter
   */
  private getContactGender(contactNode: ContactNode): Gender | undefined {
    if (!contactNode.file) {
      return undefined;
    }
    
    const frontMatter = getApp().metadataCache.getFileCache(contactNode.file)?.frontmatter;
    return frontMatter?.GENDER as Gender;
  }

  /**
   * Update a contact's gender in their front matter
   */
  private async updateContactGender(file: TFile, gender: string): Promise<void> {
    const frontMatter = getApp().metadataCache.getFileCache(file)?.frontmatter;
    
    if (frontMatter && !frontMatter.GENDER) {
      await updateFrontMatterValue(file, 'GENDER', gender);
    }
  }

  /**
   * Sync all affected contacts when a relationship changes
   */
  async syncAffectedContacts(changedContactFile: TFile, app?: App): Promise<void> {
    const appInstance = app || getApp();
    const frontMatter = appInstance.metadataCache.getFileCache(changedContactFile)?.frontmatter;
    
    if (!frontMatter) {
      return;
    }

    const changedNodeId = getContactIdentifier(frontMatter);
    
    // Get all contacts that have relationships with this contact
    const affectedContacts = new Set<string>();
    
    // Find incoming relationships
    const allContacts = this.graph.getAllContacts();
    for (const [nodeId] of allContacts) {
      const relationships = this.graph.getRelationshipsForContact(nodeId);
      for (const { target } of relationships) {
        if (target === changedNodeId) {
          affectedContacts.add(nodeId);
        }
      }
    }
    
    // Find outgoing relationships
    const outgoingRelationships = this.graph.getRelationshipsForContact(changedNodeId);
    for (const { target } of outgoingRelationships) {
      affectedContacts.add(target);
    }
    
    // Update all affected contacts
    for (const nodeId of affectedContacts) {
      const contactNode = allContacts.get(nodeId);
      if (contactNode?.file) {
        await this.updateContactFrontMatter(contactNode.file, nodeId, appInstance);
        await this.updateContactMarkdown(contactNode.file, nodeId, appInstance);
      }
    }
  }

  /**
   * Get the relationship graph
   */
  getGraph(): RelationshipGraph {
    return this.graph;
  }
}