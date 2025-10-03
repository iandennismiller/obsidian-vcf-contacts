# Development Setup

## Prerequisites

- Node.js (v16 or later)
- npm or yarn
- TypeScript knowledge
- Familiarity with Obsidian plugin development

## Getting Started

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

## Project Structure

```
src/
├── models/
│   ├── contactManager/        # Contact collection management
│   │   ├── contactManager.ts
│   │   ├── contactManagerData.ts
│   │   ├── contactManagerUtils.ts
│   │   └── consistencyOperations.ts
│   ├── contactNote/           # Individual contact operations
│   │   ├── contactNote.ts
│   │   ├── contactData.ts
│   │   ├── relationshipOperations.ts
│   │   ├── syncOperations.ts
│   │   ├── markdownOperations.ts
│   │   └── types.ts
│   ├── vcardFile/             # VCF file operations
│   │   ├── vcardFile.ts
│   │   ├── parsing.ts
│   │   ├── generation.ts
│   │   ├── fileOperations.ts
│   │   └── types.ts
│   ├── vcardManager/          # VCF collection management
│   │   ├── vcardManager.ts
│   │   ├── vcardCollection.ts
│   │   ├── writeQueue.ts
│   │   └── fileOperations.ts
│   └── curatorManager/        # Processor coordination
│       └── curatorManager.ts
├── curators/                  # Data operation processors
│   ├── genderInferenceProcessor.ts
│   ├── genderRenderProcessor.ts
│   ├── relatedFrontMatterProcessor.ts
│   ├── relatedListProcessor.ts
│   ├── uidProcessor.ts
│   └── ...
├── plugin/                    # Plugin infrastructure
│   ├── services/
│   ├── settings/
│   └── ui/
├── interfaces/                # Type definitions
└── main.ts                    # Plugin entry point
```

## Key Concepts

### Relationship Management

The plugin provides comprehensive bidirectional relationship tracking:

```typescript
// Relationships are defined in markdown
## Related
- mother [[Jane Doe]]
- colleague [[John Smith]]

// And synchronized to frontmatter
RELATED[parent]: urn:uuid:jane-doe-uuid
RELATED[colleague]: urn:uuid:john-smith-uuid
```

Key features:
- **Bidirectional Sync**: Changes in one contact automatically update related contacts
- **Gender-Aware Terms**: Automatically converts relationship terms based on gender (e.g., parent → mother/father)
- **UID-Based References**: Uses unique identifiers to maintain relationships across name changes
- **Reciprocal Updates**: Adding "daughter [[Jane]]" to John automatically adds "father [[John]]" to Jane

### Curator Processors

The plugin uses a processor-based architecture for data operations:

```typescript
export interface CuratorProcessor {
  name: string;
  enabled: boolean;
  process(contact: Contact): Promise<void>;
}
```

Processors handle specific operations:
- Data validation and transformation
- Relationship synchronization
- Gender inference and rendering
- VCF format conversion
- UID management

### Contact Data Structure

```typescript
export type Contact = {
  file: TFile;
  data: Record<string, any>;
};
```

Contact data includes:
- Standard vCard fields (FN, N, EMAIL, TEL, etc.)
- Relationship references (RELATED fields)
- Metadata (UID, REV, VERSION)
- Custom fields
