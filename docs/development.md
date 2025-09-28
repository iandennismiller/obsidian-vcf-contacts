# Development Documentation

## Architecture Overview

The VCF Contacts plugin follows a clean, modular architecture with clear separation of concerns:

### Core Components

- **ContactManager**: Handles collection-level operations (UID management, caching, file operations)
- **ContactNote**: Manages individual contact operations (CRUD operations, file I/O)
- **VcardManager**: Manages collections of VCard files with write queue system
- **VcardFile**: Handles single VCard file operations (parsing, writing)
- **FolderWatcher**: Monitors VCard folders and triggers processors
- **Insight Processors**: Specialized processors for different sync operations

### Key Design Principles

1. **Single Responsibility**: Each class has one clear purpose
2. **CRUD Architecture**: Clear separation between collection and individual operations  
3. **Event-Driven**: Uses Obsidian's event system for reactive updates
4. **Write Queue**: Controlled file operations to prevent conflicts
5. **Data Consistency**: Iterative processing ensures stable contact states

## Development Setup

### Prerequisites

- Node.js (v16 or later)
- npm or yarn
- TypeScript knowledge
- Familiarity with Obsidian plugin development

### Getting Started

1. **Clone the repository**:
   ```bash
   git clone https://github.com/iandennismiller/obsidian-vcf-contacts.git
   cd obsidian-vcf-contacts
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build the plugin**:
   ```bash
   npm run build
   ```

4. **Run tests**:
   ```bash
   npm test
   ```

5. **Development build** (watch mode):
   ```bash
   npm run dev
   ```

### Project Structure

```
src/
├── contactManager.ts          # Collection-level contact operations
├── contactNote.ts            # Individual contact CRUD operations
├── vcardManager.ts           # VCard file collection management
├── vcardFile.ts              # Single VCard file operations
├── index.ts                  # Main exports
├── main.ts                   # Plugin entry point
├── services/
│   └── folderWatcher.ts      # VCard folder monitoring
├── insights/
│   ├── insightService.ts     # Processor coordination
│   ├── insight.d.ts          # Type definitions
│   └── processors/           # Individual processors
├── ui/                       # User interface components
├── settings/                 # Plugin settings
└── context/                  # Shared context providers
```

## Key Concepts

### Insight Processors

The plugin uses a processor-based architecture for handling contact operations:

```typescript
export interface InsightProcessor {
  name: string;
  runType: RunType;
  settingPropertyName: string;
  settingDescription: string;
  settingDefaultValue: boolean;
  process(contact: Contact): Promise<InsightQueItem | undefined>;
}
```

Example processor:
```typescript
export const MyProcessor: InsightProcessor = {
  name: "My Custom Processor",
  runType: RunType.IMMEDIATELY,
  settingPropertyName: "myProcessor",
  settingDescription: "Does something useful",
  settingDefaultValue: true,
  
  async process(contact: Contact): Promise<InsightQueItem | undefined> {
    // Your processing logic here
    return undefined; // or return an InsightQueItem
  }
};
```

### Contact Data Structure

```typescript
export type Contact = {
  file: TFile;
  data: Record<string, any>;
};
```

### Write Queue System

The VcardManager includes a write queue to prevent file conflicts:

```typescript
// Queue a VCard write operation
await vcardManager.queueVcardWrite(uid, vcardData);

// Check queue status
const status = vcardManager.getWriteQueueStatus();
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Structure

Tests are organized by component:
- `tests/contactManager.spec.ts`
- `tests/contactNote.spec.ts`
- `tests/vcardManager.spec.ts`
- etc.

### Writing Tests

Example test structure:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContactManager } from '../src/contactManager';

describe('ContactManager', () => {
  let contactManager: ContactManager;

  beforeEach(() => {
    // Setup test fixtures
  });

  it('should perform expected behavior', () => {
    // Test implementation
  });
});
```

## Contributing

### Development Workflow

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/my-feature`
3. **Make** your changes following the coding standards
4. **Test** your changes: `npm test`
5. **Build** to ensure no errors: `npm run build`
6. **Commit** with clear messages: `git commit -m "Add feature X"`
7. **Push** to your fork: `git push origin feature/my-feature`
8. **Create** a Pull Request

### Coding Standards

- **TypeScript**: Use strict TypeScript with proper typing
- **ESLint**: Follow the configured ESLint rules
- **Formatting**: Use Prettier for consistent formatting
- **Comments**: Add JSDoc comments for public methods
- **Tests**: Include tests for new functionality

### Architecture Guidelines

1. **Single Responsibility**: Each class should have one clear purpose
2. **Interface Segregation**: Keep interfaces focused and minimal
3. **Dependency Injection**: Use dependency injection for testability
4. **Error Handling**: Implement proper error handling and logging
5. **Performance**: Consider performance implications of changes

## Plugin API

### Extending the Plugin

The plugin provides extension points for developers:

#### Custom Processors

Create custom insight processors:

```typescript
import { InsightProcessor, RunType } from 'src/insights/insight.d';

export const MyCustomProcessor: InsightProcessor = {
  // Implementation
};

// Register the processor
insightService.register(MyCustomProcessor);
```

#### Custom Contact Fields

Add support for custom vCard fields:

```typescript
// In ContactNote class
async updateCustomField(fieldName: string, value: string): Promise<void> {
  await this.updateFrontmatterValue(fieldName, value);
}
```

### Event Hooks

Listen to contact events:

```typescript
// Contact created
this.app.workspace.on('vcf-contacts:contact-created', (contact: Contact) => {
  // Handle contact creation
});

// Contact updated  
this.app.workspace.on('vcf-contacts:contact-updated', (contact: Contact) => {
  // Handle contact update
});
```

## Deployment

### Building for Release

1. **Update version** in `manifest.json` and `package.json`
2. **Run tests**: `npm test`
3. **Build**: `npm run build`
4. **Create release**: Tag and create GitHub release
5. **Publish**: Submit to Obsidian community plugins (if applicable)

### Release Checklist

- [ ] Version numbers updated
- [ ] Tests passing
- [ ] Build successful
- [ ] Documentation updated
- [ ] Changelog updated
- [ ] Breaking changes noted
- [ ] Migration guide provided (if needed)

## Troubleshooting

### Common Issues

1. **Build Errors**: Check TypeScript version and dependencies
2. **Test Failures**: Ensure test environment is properly configured
3. **Plugin Loading**: Verify manifest.json format
4. **Performance**: Use browser dev tools to profile

### Debugging

1. **Console Logging**: Use console.log() for basic debugging
2. **Obsidian Dev Tools**: Press Ctrl+Shift+I to open dev tools
3. **Breakpoints**: Set breakpoints in TypeScript source
4. **Plugin Reload**: Disable/enable plugin to reload changes

## Getting Help

- **Issues**: Report bugs on [GitHub Issues](https://github.com/iandennismiller/obsidian-vcf-contacts/issues)
- **Discussions**: Ask questions in [GitHub Discussions](https://github.com/iandennismiller/obsidian-vcf-contacts/discussions)
- **Contributing**: See [CONTRIBUTING.md](CONTRIBUTING.md)
- **Discord**: Join the Obsidian community Discord

This documentation provides the foundation for contributing to and extending the VCF Contacts plugin. The modular architecture makes it easy to add new features while maintaining code quality and performance.