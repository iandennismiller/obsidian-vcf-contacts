# Quick Reference: Interface Reorganization

## TL;DR

Interface definitions have been reorganized:
- **Used definitions** → `/src/definitions/`
- **Unused interfaces** → `/docs/old/` (archived)
- **Backward compat** → `/src/interfaces/index.ts` (re-exports from definitions)

## For Developers

### Where to Import From

**Recommended (new code):**
```typescript
import { ContactsPluginSettings, RunType } from 'src/definitions';
```

**Still works (existing code):**
```typescript
import { ContactsPluginSettings } from 'src/interfaces/ContactsPluginSettings';
```

### Available Definitions in `/src/definitions/`

1. **ContactsPluginSettings** - Plugin configuration type
2. **RunType** - Curator run type enum (`"once"`, `"preview"`, `"normal"`)
3. **CuratorProcessor** - Interface for curator processors
4. **CuratorQueItem** - Type for curator queue items
5. **CuratorSettingProperties** - Type for curator settings

### What Happened to I*.ts Interfaces?

All interface files starting with `I` (like `IContactNote`, `IVCardManager`, etc.) have been moved to `/docs/old/` because:

1. They were never actually implemented by classes
2. They were not used as type annotations anywhere
3. They were only re-exported from model index files
4. The model classes themselves define their interface through TypeScript's structural typing

### When to Create New Definitions

Create a new definition in `/src/definitions/` when:
- ✅ It will be imported and used in multiple places
- ✅ It defines a configuration type or enum
- ✅ It's a shared interface that will be implemented by multiple classes

Don't create interface files for:
- ❌ Classes that define their own public API (use the class itself)
- ❌ Types that are only used within a single module (keep them local)
- ❌ Duplicating what TypeScript can infer structurally

### Model Class Pattern

Models now follow this pattern:

```typescript
// In src/models/contactNote/contactNote.ts
export class ContactNote {
  // Methods define the public API
  public method1() { }
  public method2() { }
}

// In src/models/contactNote/index.ts  
export { ContactNote } from './contactNote';
export type { Contact, Gender } from './types';

// NO MORE: export * from '../../interfaces/IContactNote';
```

### Migration Checklist

If you have code that imports from old interfaces:

- [x] Change `'src/interfaces/...'` to `'src/definitions/...'` for used definitions
- [x] Remove imports of I*.ts interfaces (they're in docs/old now)
- [x] Use the model classes directly instead of interface types
- [x] Update tests to use new import paths

## Questions?

See full documentation in `docs/interface-reorganization.md` or check the archived interfaces in `docs/old/README.md`.
