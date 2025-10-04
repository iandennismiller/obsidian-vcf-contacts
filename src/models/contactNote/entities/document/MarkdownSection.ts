/**
 * Abstract base class for markdown sections in contact notes
 * 
 * All sections have a heading name, level (depth), and content.
 * Subclasses implement parsing and validation logic specific to their section type.
 */

/**
 * Validation result for markdown sections
 */
export interface SectionValidationResult {
  isValid: boolean;
  issues: string[];
}

/**
 * Abstract base class for markdown sections
 */
export abstract class MarkdownSection {
  protected readonly name: string;
  protected readonly level: number;
  protected readonly content: string;

  /**
   * Create a markdown section
   * @param name - Section heading name (without # prefix)
   * @param level - Heading level (1-6 for #, ##, etc.)
   * @param content - Section content (text after heading)
   */
  constructor(name: string, level: number, content: string) {
    this.name = name;
    this.level = Math.max(1, Math.min(6, level)); // Clamp to 1-6
    this.content = content;
  }

  // === Abstract Methods (must be implemented by subclasses) ===

  /**
   * Parse section content into structured data
   * Implementation varies by section type
   */
  abstract parse(): any;

  /**
   * Validate section structure and content
   * Implementation varies by section type
   */
  abstract validate(): SectionValidationResult;

  // === Concrete Methods ===

  /**
   * Get section name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Get heading level
   */
  getLevel(): number {
    return this.level;
  }

  /**
   * Get section content
   */
  getContent(): string {
    return this.content;
  }

  /**
   * Check if section is empty (no content after heading)
   */
  isEmpty(): boolean {
    return this.content.trim().length === 0;
  }

  /**
   * Convert section to markdown string
   */
  toMarkdown(): string {
    const heading = '#'.repeat(this.level) + ' ' + this.name;
    if (this.isEmpty()) {
      return heading + '\n';
    }
    return heading + '\n' + this.content;
  }

  /**
   * String representation for debugging
   */
  toString(): string {
    return `${this.constructor.name}(${this.name}, level=${this.level}, ${this.content.length} chars)`;
  }

  /**
   * Check equality with another section
   */
  equals(other: MarkdownSection): boolean {
    return (
      this.name === other.name &&
      this.level === other.level &&
      this.content === other.content
    );
  }

  // === Static Factory for Testing ===

  /**
   * Create a section for testing (uses a concrete test implementation)
   * @param name - Section name
   * @param level - Heading level
   * @param content - Section content
   */
  static create(name: string, level: number, content: string): MarkdownSection {
    return new TestMarkdownSection(name, level, content);
  }
}

/**
 * Concrete implementation for testing purposes
 * @internal
 */
class TestMarkdownSection extends MarkdownSection {
  parse(): any {
    return { raw: this.content };
  }

  validate(): SectionValidationResult {
    return { isValid: true, issues: [] };
  }
}
