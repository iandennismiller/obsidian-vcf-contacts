# Plugin API

## Extending the Plugin

The plugin provides extension points through the processor system:

### Custom Processors

Create custom curator processors:

```typescript
import { CuratorProcessor } from 'src/interfaces/CuratorProcessor';

export const MyCustomProcessor: CuratorProcessor = {
  name: "My Custom Processor",
  enabled: true,
  
  async process(contact: Contact): Promise<void> {
    // Your processing logic here
    // Access contact data via contact.file and contact.data
  }
};

// Register the processor
curatorManager.register(MyCustomProcessor);
```

### Relationship Operations

Work with relationships programmatically:

```typescript
import { ContactNote } from 'src/models/contactNote';

// Parse relationships from a contact
const contactNote = new ContactNote(app, settings, file);
const relationships = await contactNote.parseRelatedSection();

// Add a relationship
await contactNote.addRelationship('friend', 'John Doe');

// Sync relationships bidirectionally
await contactManager.syncContactFile(file);
```

### VCF Operations

Work with VCF files using the vcard4 library integration:

```typescript
import { VcardFile } from 'src/models/vcardFile';
import { parse } from 'vcard4';

// Parse a VCF file (uses vcard4 library internally)
const vcardFile = await VcardFile.fromFile(filePath);

// Iterate through parsed contacts
for await (const [slug, contact] of vcardFile.parse()) {
  console.log(`Contact: ${slug}`, contact);
}

// Generate VCF from Obsidian contact files (uses vcard4 library)
const result = await VcardFile.fromObsidianFiles([file], app);
console.log(result.vcards); // Valid vCard 4.0 string
console.log(result.errors);  // Any errors during generation

// Direct vcard4 library usage
const vcfContent = await readFile('contact.vcf');
const parsedCard = parse(vcfContent);
// Access parsed vCard properties
console.log(parsedCard.getProperty('FN'));
console.log(parsedCard.getProperty('EMAIL'));
```

**Note**: The plugin uses the [vcard4](https://www.npmjs.com/package/vcard4) library for all vCard parsing and generation. The library fully implements RFC 6350 (vCard 4.0) and handles all parsing edge cases, field validation, and structured field processing. Custom code focuses on mapping between vcard4's data structures and Obsidian's frontmatter format.
