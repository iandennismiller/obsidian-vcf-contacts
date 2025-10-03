/**
 * Base class for markdown section operations using the marked library
 * 
 * This class provides common functionality for extracting and updating
 * markdown sections using the marked library for standard markdown parsing.
 * 
 * Subclasses should extend this to add domain-specific parsing logic while
 * leveraging the standard markdown parsing capabilities of marked.
 */

import { marked, Tokens } from 'marked';
import { ContactData } from './contactData';
import { HEADING_LEVELS, SECTION_NAMES, FRONTMATTER } from './markdownConstants';

/**
 * Represents a markdown section with its content
 */
export interface MarkdownSection {
  name: string;
  level: number;
  content: string;
  tokens: Tokens.Generic[];
}

/**
 * Base class for markdown section operations
 */
export abstract class BaseMarkdownSectionOperations {
  protected contactData: ContactData;

  constructor(contactData: ContactData) {
    this.contactData = contactData;
  }

  // ========================================================================
  // Section Extraction Using Marked
  // ========================================================================

  /**
   * Extract a specific section from markdown content by name
   * Uses marked library for reliable markdown parsing
   * 
   * @param sectionName - Name of the section to extract (case-insensitive)
   * @returns Section content or null if not found
   */
  protected async extractSection(sectionName: string): Promise<string | null> {
    const content = await this.contactData.getContent();
    const sections = await this.extractAllSections(content);
    
    // Case-insensitive lookup
    const normalizedName = sectionName.toLowerCase();
    const section = sections.find(s => s.name.toLowerCase() === normalizedName);
    
    return section ? section.content : null;
  }

  /**
   * Extract all sections from markdown content
   * Uses marked library for parsing
   * 
   * @param content - Markdown content to parse
   * @returns Array of sections
   */
  protected async extractAllSections(content: string): Promise<MarkdownSection[]> {
    // Remove frontmatter before parsing
    const contentWithoutFrontmatter = this.removeFrontmatter(content);
    
    // Parse markdown into tokens
    const tokens = marked.lexer(contentWithoutFrontmatter);
    
    const sections: MarkdownSection[] = [];
    let currentSection: MarkdownSection | null = null;
    
    for (const token of tokens) {
      if (token.type === 'heading') {
        // Save previous section
        if (currentSection) {
          sections.push(currentSection);
        }
        
        // Start new section
        currentSection = {
          name: token.text,
          level: token.depth,
          content: '',
          tokens: []
        };
      } else if (currentSection) {
        // Add token to current section
        currentSection.tokens.push(token);
      }
    }
    
    // Save last section
    if (currentSection) {
      sections.push(currentSection);
    }
    
    // Convert tokens to content strings
    for (const section of sections) {
      section.content = this.tokensToMarkdown(section.tokens);
    }
    
    return sections;
  }

  /**
   * Extract a specific section and return it as a Map (for backward compatibility)
   */
  protected async extractMarkdownSections(): Promise<Map<string, string>> {
    const content = await this.contactData.getContent();
    const sections = await this.extractAllSections(content);
    
    const map = new Map<string, string>();
    for (const section of sections) {
      map.set(section.name, section.content);
    }
    
    return map;
  }

  // ========================================================================
  // Section Update Using Marked
  // ========================================================================

  /**
   * Update a specific section in the markdown content
   * Uses marked for parsing to ensure reliable section detection
   * 
   * @param sectionName - Name of the section to update
   * @param newContent - New content for the section
   */
  protected async updateSection(sectionName: string, newContent: string): Promise<void> {
    const content = await this.contactData.getContent();
    const sections = await this.extractAllSections(content);
    
    // Find the section to update
    const normalizedName = sectionName.toLowerCase();
    const sectionIndex = sections.findIndex(s => s.name.toLowerCase() === normalizedName);
    
    let updatedContent: string;
    
    if (sectionIndex >= 0) {
      // Replace existing section
      sections[sectionIndex].content = newContent;
      updatedContent = this.reconstructMarkdown(content, sections);
    } else {
      // Add new section
      updatedContent = this.addSection(content, sectionName, newContent);
    }
    
    await this.contactData.updateContent(updatedContent);
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  /**
   * Remove frontmatter from content
   */
  protected removeFrontmatter(content: string): string {
    const frontmatterRegex = /^---\n[\s\S]*?\n---\n/;
    return content.replace(frontmatterRegex, '');
  }

  /**
   * Extract frontmatter from content
   */
  protected extractFrontmatter(content: string): string | null {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
    const match = content.match(frontmatterRegex);
    return match ? match[0] : null;
  }

  /**
   * Convert tokens back to markdown string
   */
  protected tokensToMarkdown(tokens: Tokens.Generic[]): string {
    // Use marked parser to convert tokens back to markdown
    // This is a simplified version - for complex cases, we keep the original text
    let markdown = '';
    
    for (const token of tokens) {
      if (token.type === 'list') {
        const listToken = token as Tokens.List;
        for (const item of listToken.items) {
          markdown += `- ${item.text}\n`;
        }
      } else if (token.type === 'paragraph') {
        const paragraphToken = token as Tokens.Paragraph;
        const text = paragraphToken.text;
        
        // Skip paragraphs that are just hashtags (document-level tags)
        if (text.match(/^#\w+(\s+#\w+)*$/)) {
          continue;
        }
        
        markdown += `${text}\n\n`;
      } else if (token.type === 'space') {
        markdown += '\n';
      } else {
        // For other token types, we'll use marked's renderer
        // This is a fallback - in practice, most sections will be lists or paragraphs
        markdown += token.raw || '';
      }
    }
    
    return markdown.trim();
  }

  /**
   * Reconstruct markdown from sections
   */
  protected reconstructMarkdown(originalContent: string, sections: MarkdownSection[]): string {
    const frontmatter = this.extractFrontmatter(originalContent);
    let markdown = frontmatter ? frontmatter + '\n\n' : '';
    
    for (const section of sections) {
      const headingMarker = '#'.repeat(section.level);
      markdown += `${headingMarker} ${section.name}\n`;
      if (section.content.trim()) {
        markdown += section.content + '\n\n';
      }
    }
    
    // Extract trailing tags
    const tagMatch = originalContent.match(/\n(#\w.*?)$/);
    if (tagMatch) {
      markdown += '\n' + tagMatch[1];
    }
    
    return markdown;
  }

  /**
   * Add a new section to the markdown content
   */
  protected addSection(content: string, sectionName: string, sectionContent: string): string {
    // Determine heading level based on section name
    const level = this.getSectionLevel(sectionName);
    const headingMarker = '#'.repeat(level);
    const newSection = `${headingMarker} ${sectionName}\n${sectionContent}\n\n`;
    
    // Add section before trailing hashtags (handle trailing whitespace)
    const tagMatch = content.match(/\n(#\w[^\n]*)\s*$/);
    if (tagMatch) {
      const insertIndex = content.lastIndexOf(tagMatch[1]);
      return content.substring(0, insertIndex) + newSection + tagMatch[1] + '\n';
    } else {
      return content + '\n\n' + newSection;
    }
  }

  /**
   * Determine the heading level for a section name
   */
  protected getSectionLevel(sectionName: string): number {
    const normalized = sectionName.toLowerCase();
    
    // Subsections like Notes use level 4
    if (normalized === SECTION_NAMES.NOTES.toLowerCase()) {
      return 4;
    }
    
    // Main sections like Contact, Related use level 2
    return 2;
  }

  /**
   * Find a heading token by name (case-insensitive)
   */
  protected findHeadingByName(tokens: Tokens.Generic[], name: string): Tokens.Heading | null {
    const normalized = name.toLowerCase();
    
    for (const token of tokens) {
      if (token.type === 'heading') {
        const heading = token as Tokens.Heading;
        if (heading.text.toLowerCase() === normalized) {
          return heading;
        }
      }
    }
    
    return null;
  }

  /**
   * Find list tokens after a specific heading
   */
  protected findListAfterHeading(tokens: Tokens.Generic[], headingName: string): Tokens.List | null {
    const heading = this.findHeadingByName(tokens, headingName);
    if (!heading) {
      return null;
    }
    
    // Find the heading index
    const headingIndex = tokens.indexOf(heading);
    
    // Look for the first list after the heading
    for (let i = headingIndex + 1; i < tokens.length; i++) {
      const token = tokens[i];
      
      // Stop if we hit another heading
      if (token.type === 'heading') {
        break;
      }
      
      // Return the first list we find
      if (token.type === 'list') {
        return token as Tokens.List;
      }
    }
    
    return null;
  }
}
