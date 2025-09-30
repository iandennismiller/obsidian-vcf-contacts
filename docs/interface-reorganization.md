# Interface Reorganization Summary

This document summarizes the reorganization of interface definitions in the codebase.

## Problem

The `/src/interfaces/` directory contained many TypeScript interface definitions that were:
1. Never actually implemented by classes (no `implements` keyword usage)
2. Not used as type annotations anywhere in the code
3. Only re-exported from model `index.ts` files but never actually referenced
4. Causing confusion and potential for drift between interfaces and implementations

## Solution

We reorganized the interfaces into two categories:

### 1. Actively Used Definitions → `/src/definitions/`

These are type definitions and interfaces that are actively used throughout the codebase:

- **ContactsPluginSettings.ts** - Plugin settings configuration (used extensively)
- **RunType.ts** - Enum for curator run types (used in curator system)
- **CuratorProcessor.ts** - Interface for curator processors (actively implemented)
- **CuratorQueItem.ts** - Type for curator queue items (used in curator manager)
- **CuratorSettingProperties.ts** - Type for curator settings (used in settings)

These files are imported and used as types in multiple places throughout the codebase.

### 2. Unused Interface Definitions → `/docs/old/`

These are interface definitions that were only re-exported but never actually used:

- IConsistencyOperations.ts
- IContactData.ts
- IContactManager.ts (has duplicate definition in contactManager.ts)
- IContactManagerData.ts
- IContactManagerUtils.ts
- IContactNote.ts
- IMarkdownOperations.ts
- IRelationshipOperations.ts
- ISyncOperations.ts
- IVCardCollection.ts
- IVCardFile.ts
- IVCardFileOperations.ts
- IVCardGenerator.ts
- IVCardManager.ts
- IVCardManagerFileOperations.ts
- IVCardParser.ts
- IVCardWriteQueue.ts

These files are kept for historical reference but are excluded from compilation via `tsconfig.json`.

## Changes Made

1. **Created `/src/definitions/`** directory with an `index.ts` for centralized exports
2. **Created `/docs/old/`** directory with a README explaining the archived interfaces
3. **Updated all imports** in:
   - Source files (`src/models/`, `src/plugin/`, `src/curators/`, `src/main.ts`)
   - Test files (`tests/`)
   - Changed from `src/interfaces/` to `src/definitions/`
4. **Removed interface re-exports** from model index files:
   - `src/models/contactNote/index.ts`
   - `src/models/contactManager/index.ts`
   - `src/models/vcardFile/index.ts`
   - `src/models/vcardManager/index.ts`
5. **Updated `/src/interfaces/index.ts`** to provide backward compatibility by re-exporting from definitions
6. **Updated `tsconfig.json`** to exclude `docs/old/` from compilation

## Benefits

1. **Clarity**: It's now clear which type definitions are actively used vs historical artifacts
2. **Maintainability**: Fewer files to maintain, no need to keep interfaces in sync with implementations
3. **Reduced confusion**: Developers can rely on TypeScript's structural typing for the models
4. **Better organization**: Active definitions are in a dedicated location
5. **Backward compatibility**: The `/src/interfaces/index.ts` still works for any code that imports from there

## Testing

All 613 tests pass successfully, confirming that:
- All imports were correctly updated
- No functionality was broken
- The build process works correctly

## Migration Guide

For any code that currently imports from `/src/interfaces/`:

**Before:**
```typescript
import { ContactsPluginSettings } from 'src/interfaces/ContactsPluginSettings';
```

**After:**
```typescript
import { ContactsPluginSettings } from 'src/definitions/ContactsPluginSettings';
```

Or use the index export:
```typescript
import { ContactsPluginSettings } from 'src/definitions';
```

The old path still works for backward compatibility but is deprecated.
