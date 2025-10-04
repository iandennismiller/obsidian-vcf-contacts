# Gender Processing Specification

## Overview

This specification covers gender-aware relationship processing in the plugin. The system stores genderless relationship types internally but renders them with gender-specific terms based on the GENDER field.

## Gender Field

### Format

The GENDER field follows vCard 4.0 specification (RFC 6350):
- `M` - Male
- `F` - Female  
- `NB` - Non-binary
- `U` - Unknown/Unspecified
- Empty/missing - No gender specified

### Storage

Gender is stored in frontmatter:
```yaml
GENDER: M
```

## Gender-Aware Rendering

### Genderless Storage, Gendered Display

The plugin stores relationship types in a genderless form in frontmatter and vCard RELATED fields, but renders them with gender-specific terms in the Related list.

**Example:**
- Frontmatter: `RELATED[parent]: urn:uuid:jane-uid-456`
- Contact Jane has `GENDER: F`
- Related list displays: `- mother [[Jane Doe]]`

### Relationship Type Mappings

| Genderless Type | Male (M) | Female (F) | Non-binary (NB) | Unknown (U) |
|----------------|----------|------------|-----------------|-------------|
| parent         | father   | mother     | parent          | parent      |
| child          | son      | daughter   | child           | child       |
| sibling        | brother  | sister     | sibling         | sibling     |
| spouse         | husband  | wife       | spouse          | spouse      |
| grandparent    | grandfather | grandmother | grandparent  | grandparent |
| grandchild     | grandson | granddaughter | grandchild    | grandchild  |
| kin            | uncle/nephew | aunt/niece | kin           | kin         |

## Gender Inference

When a user specifies a gendered relationship term, the plugin infers the contact's gender.

### Inference Rules

**Gendered terms that infer GENDER:**
- mother, mom, mum → `F`
- father, dad → `M`
- son → `M`
- daughter → `F`
- brother → `M`
- sister → `F`
- husband → `M`
- wife → `F`
- grandfather → `M`
- grandmother → `F`
- grandson → `M`
- granddaughter → `F`
- uncle → `M`
- aunt → `F`
- nephew → `M`
- niece → `F`

### Inference Process

1. User adds gendered term to Related list: `- mother [[Jane Doe]]`
2. Plugin identifies gendered term "mother"
3. Plugin infers Jane's gender: `F`
4. Plugin updates Jane's frontmatter: `GENDER: F`
5. Plugin converts relationship to genderless type: `parent`
6. Plugin stores in frontmatter: `RELATED[parent]: urn:uuid:jane-uid-456`
7. Plugin updates REV field on Jane's contact

## Bidirectional Consistency

### Rendering Process

When rendering relationships in the Related list:
1. Read relationship type from frontmatter (e.g., `parent`)
2. Resolve UID to contact
3. Read contact's GENDER field
4. Map genderless type + gender to gendered term
5. Display gendered term in Related list

### Editing Process

When user edits Related list:
1. Parse gendered term from list (e.g., `mother`)
2. Infer contact's gender if term is gendered
3. Update contact's GENDER field if inferred
4. Convert to genderless type for storage
5. Store in frontmatter as genderless type

## Complex Relationships

Some relationship terms include prefixes or modifiers:
- mother-in-law, father-in-law
- step-mother, step-father
- half-brother, half-sister
- adopted-son, adopted-daughter

These are handled by:
1. Extracting the base relationship term
2. Preserving the modifier/prefix
3. Applying gender inference to base term
4. Storing with full type including modifier

## REV Field Updates

Gender changes trigger REV field updates:
- When GENDER is inferred from relationship term
- When GENDER is explicitly changed
- REV only updates if GENDER value actually changes

## Related Specifications

- [Relationship Management Specification](relationship-management-spec.md)
