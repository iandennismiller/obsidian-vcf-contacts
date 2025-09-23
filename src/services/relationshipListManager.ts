import { TFile, App } from 'obsidian';
import { RelationshipManager, RelationshipListItem } from './relationshipManager';
import { getApp } from '../context/sharedAppContext';
import { loggingService } from './loggingService';

/**
 * Manages the "## Related" section in contact notes
 * Handles bidirectional sync between markdown lists and front matter
 */
export class RelationshipListManager {
  private app: App;
  private relationshipManager: RelationshipManager;
  private processingFiles: Set<string> = new Set();

  constructor(relationshipManager: RelationshipManager, app?: App) {
    this.app = app || getApp();
    this.relationshipManager = relationshipManager;
  }

  /**
   * Parse relationship list from markdown content
   * Expected format: "- friend [[Contact Name]]"
   */
  parseRelationshipList(content: string): RelationshipListItem[] {
    const relationships: RelationshipListItem[] = [];
    
    const relatedSectionMatch = this.findRelatedSection(content);
    if (!relatedSectionMatch) return relationships;

    const listContent = relatedSectionMatch.sectionContent;
    const lines = listContent.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ')) {
        const parsed = this.parseRelationshipListItem(trimmed);
        if (parsed) {
          relationships.push(parsed);
        }
      }
    }

    return relationships;
  }

  /**
   * Find the Related section in markdown content
   */
  private findRelatedSection(content: string): { sectionContent: string; startIndex: number; endIndex: number } | null {
    const lines = content.split('\n');
    let relatedHeaderIndex = -1;
    let relatedHeaderLevel = 0;

    // Find the Related heading (case insensitive, any level)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const headerMatch = line.match(/^(#{1,6})\s+related\s*$/i);
      if (headerMatch) {
        relatedHeaderIndex = i;
        relatedHeaderLevel = headerMatch[1].length;
        break;
      }
    }

    if (relatedHeaderIndex === -1) return null;

    // Find the end of the Related section (next header of same or higher level, or end of file)
    let endIndex = lines.length;
    for (let i = relatedHeaderIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();
      const headerMatch = line.match(/^(#{1,6})\s+/);
      if (headerMatch && headerMatch[1].length <= relatedHeaderLevel) {
        endIndex = i;
        break;
      }
    }

    // Extract content between header and next section
    const sectionLines = lines.slice(relatedHeaderIndex + 1, endIndex);
    const sectionContent = sectionLines.join('\n');

    return {
      sectionContent,
      startIndex: relatedHeaderIndex,
      endIndex
    };
  }

  /**
   * Parse a single relationship list item
   * Format: "- friend [[Contact Name]]"
   */
  private parseRelationshipListItem(line: string): RelationshipListItem | null {
    // Remove "- " prefix
    const itemContent = line.substring(2).trim();
    
    // Parse format: "relationshipType [[Contact Name]]"
    const match = itemContent.match(/^(\w+)\s+\[\[([^\]]+)\]\]/);
    if (!match) return null;

    const relationshipType = match[1];
    const contactName = match[2];

    return {
      relationshipType,
      contactName
    };
  }

  /**
   * Generate markdown relationship list from front matter
   */
  async generateRelationshipList(file: TFile): Promise<string> {
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
    if (!frontmatter) return '';

    const relationships: RelationshipListItem[] = [];
    
    // Extract RELATED fields and resolve contact names
    for (const [key, value] of Object.entries(frontmatter)) {
      if (key.startsWith('RELATED[') && typeof value === 'string') {
        const typeMatch = key.match(/RELATED\[(?:\d+:)?([^\]]+)\]/);
        if (typeMatch) {
          const relationshipType = typeMatch[1];
          const contactName = await this.resolveContactName(value);
          
          if (contactName) {
            relationships.push({
              relationshipType,
              contactName
            });
          }
        }
      }
    }

    // Group by relationship type and sort
    const groupedRelationships: Record<string, string[]> = {};
    relationships.forEach(rel => {
      if (!groupedRelationships[rel.relationshipType]) {
        groupedRelationships[rel.relationshipType] = [];
      }
      groupedRelationships[rel.relationshipType].push(rel.contactName);
    });

    // Generate markdown list
    const listItems: string[] = [];
    const sortedRelationshipTypes = Object.keys(groupedRelationships).sort();
    
    for (const relType of sortedRelationshipTypes) {
      const contacts = groupedRelationships[relType];
      contacts.sort().forEach(contact => {
        listItems.push(`- ${relType} [[${contact}]]`);
      });
    }

    return listItems.join('\n');
  }

  /**
   * Resolve contact reference to display name
   */
  private async resolveContactName(reference: string): Promise<string | null> {
    const namespaceMatch = reference.match(/^(urn:uuid|name|uid):(.+)$/);
    if (!namespaceMatch) return null;

    const namespace = namespaceMatch[1];
    const contactId = namespaceMatch[2];

    if (namespace === 'name') {
      return contactId; // Already a name
    }

    // Find contact by UID
    const contactFiles = this.app.vault.getMarkdownFiles().filter(file => 
      file.path.startsWith('Contacts/') || this.isContactFile(file)
    );

    for (const file of contactFiles) {
      const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (frontmatter?.UID === contactId) {
        return frontmatter.FN || 
               (frontmatter['N.GN'] && frontmatter['N.FN'] ? 
                `${frontmatter['N.GN']} ${frontmatter['N.FN']}` : 
                file.basename);
      }
    }

    return null;
  }

  /**
   * Update or create Related section in a contact note
   */
  async updateRelatedSection(file: TFile): Promise<void> {
    if (this.processingFiles.has(file.path)) {
      return; // Avoid recursive updates
    }

    this.processingFiles.add(file.path);

    try {
      const content = await this.app.vault.read(file);
      const relationshipList = await this.generateRelationshipList(file);
      
      const updatedContent = this.injectRelatedSection(content, relationshipList);
      
      // Only modify the file if the content actually changed
      if (updatedContent !== content) {
        await this.app.vault.modify(file, updatedContent);
      }
    } finally {
      this.processingFiles.delete(file.path);
    }
  }

  /**
   * Inject or update the Related section in markdown content
   */
  private injectRelatedSection(content: string, relationshipList: string): string {
    const lines = content.split('\n');
    const relatedSection = this.findRelatedSection(content);

    if (relatedSection) {
      // Update existing section
      const beforeSection = lines.slice(0, relatedSection.startIndex + 1);
      const afterSection = lines.slice(relatedSection.endIndex);
      
      // Clean up the header line (fix capitalization, remove extra spaces)
      const headerLine = lines[relatedSection.startIndex];
      const headerMatch = headerLine.match(/^(#{1,6})\s+related\s*$/i);
      if (headerMatch) {
        beforeSection[beforeSection.length - 1] = `${headerMatch[1]} Related`;
      }

      const newContent = [
        ...beforeSection,
        '',
        relationshipList,
        '',
        ...afterSection
      ].join('\n');

      return newContent;
    } else {
      // Add new Related section
      if (relationshipList.trim()) {
        const newSection = [
          '',
          '## Related',
          '',
          relationshipList,
          ''
        ];
        
        return content + '\n' + newSection.join('\n');
      }
    }

    return content;
  }

  /**
   * Sync relationship list changes to front matter
   */
  async syncListToFrontmatter(file: TFile): Promise<void> {
    if (this.processingFiles.has(file.path)) {
      return; // Avoid recursive updates
    }

    // Mark as processing to prevent cascading updates
    this.processingFiles.add(file.path);

    try {
      const content = await this.app.vault.read(file);
      const currentRelationships = this.parseRelationshipList(content);
      
      // Convert to front matter relationships
      const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
      const sourceUid = frontmatter?.UID;
      
      if (!sourceUid) return;

      // Get current graph relationships for this contact
      const graph = this.relationshipManager.getGraph();
      const existingGraphRelationships = graph.getAllContacts().includes(sourceUid) 
        ? graph.getContactRelationships(sourceUid) 
        : [];

      // Convert current relationships to resolved UIDs for comparison
      const currentRelationshipsByUid: Array<{relationshipType: string, targetUid: string}> = [];
      for (const rel of currentRelationships) {
        const targetFile = await this.findContactByName(rel.contactName);
        if (targetFile) {
          const targetFrontmatter = this.app.metadataCache.getFileCache(targetFile)?.frontmatter;
          const targetUid = targetFrontmatter?.UID;
          if (targetUid) {
            currentRelationshipsByUid.push({
              relationshipType: rel.relationshipType,
              targetUid: targetUid
            });
          }
        }
      }

      // Check if relationships have actually changed
      if (!this.areGraphRelationshipsEqual(existingGraphRelationships, currentRelationshipsByUid)) {
        // Clear existing relationships from graph for this contact
        if (graph.getAllContacts().includes(sourceUid)) {
          const currentGraphRels = graph.getContactRelationships(sourceUid);
          for (const rel of currentGraphRels) {
            graph.removeRelationship(rel.sourceContact, rel.targetContact, rel.relationshipType);
          }
        }

        // Add new relationships to graph
        for (const rel of currentRelationshipsByUid) {
          graph.addRelationship(sourceUid, rel.targetUid, rel.relationshipType);
        }

        // Now sync this contact's front matter (this will only update REV if changes are detected)
        await this.relationshipManager.syncGraphToFrontmatter(file);
      }
    } finally {
      this.processingFiles.delete(file.path);
    }
  }

  /**
   * Compare graph relationships with current relationship list
   */
  private areGraphRelationshipsEqual(
    graphRels: Array<{relationshipType: string, sourceContact: string, targetContact: string}>, 
    currentRels: Array<{relationshipType: string, targetUid: string}>
  ): boolean {
    if (graphRels.length !== currentRels.length) {
      return false;
    }

    // Sort both lists for comparison
    const sortedGraph = [...graphRels].sort((a, b) => 
      a.relationshipType.localeCompare(b.relationshipType) || a.targetContact.localeCompare(b.targetContact)
    );
    const sortedCurrent = [...currentRels].sort((a, b) => 
      a.relationshipType.localeCompare(b.relationshipType) || a.targetUid.localeCompare(b.targetUid)
    );

    // Compare each relationship
    for (let i = 0; i < sortedGraph.length; i++) {
      if (sortedGraph[i].relationshipType !== sortedCurrent[i].relationshipType ||
          sortedGraph[i].targetContact !== sortedCurrent[i].targetUid) {
        return false;
      }
    }

    return true;
  }

  /**
   * Find contact file by display name
   */
  private async findContactByName(name: string): Promise<TFile | null> {
    const contactFiles = this.app.vault.getMarkdownFiles().filter(file => 
      file.path.startsWith('Contacts/') || this.isContactFile(file)
    );

    for (const file of contactFiles) {
      const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
      
      if (frontmatter?.FN === name || 
          (frontmatter?.['N.GN'] && frontmatter?.['N.FN'] && 
           `${frontmatter['N.GN']} ${frontmatter['N.FN']}` === name) ||
          file.basename === name) {
        return file;
      }
    }
    
    return null;
  }

  /**
   * Check if a file is a contact file
   */
  private isContactFile(file: TFile): boolean {
    const cache = this.app.metadataCache.getFileCache(file);
    const frontmatter = cache?.frontmatter;
    return !!(frontmatter?.UID || frontmatter?.FN || (frontmatter?.['N.GN'] && frontmatter?.['N.FN']));
  }
}