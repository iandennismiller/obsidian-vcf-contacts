# GitHub Actions Workflows

This directory contains automated workflows for the VCF Contacts plugin.

## Workflows

### Quality Checks (`quality-checks.yml`)

**Trigger**: Runs on every push and pull request to all branches except those starting with `copilot/`

**Purpose**: Enforces code quality standards before code can be merged

**Steps**:
1. TypeScript compilation check (`npm run compile`)
2. Production build verification (`npm run production`)
3. Test suite execution (`npm run test`) - only on main branch and PRs

**Branch-specific behavior**:
- **Main branch**: All three checks must pass (compile, build, test)
- **Other branches** (not `copilot/*`): Compile and build must pass; tests run only for PRs
- **Copilot branches**: Workflow is skipped entirely

This workflow acts as a pre-merge quality gate to ensure code stability.

---

### JSDoc Documentation (`jsdoc.yml`)

**Trigger**: Runs only on pushes to the `main` branch

**Purpose**: Automatically generates and deploys API documentation to GitHub Pages

**Steps**:
1. Install JSDoc and dependencies
2. Generate documentation from source code in `/src`
3. Upload to GitHub Pages artifact
4. Deploy to GitHub Pages

**Output**: API documentation available at `https://<username>.github.io/obsidian-vcf-contacts/`

**Configuration**: JSDoc settings are defined in `jsdoc.json` at the repository root.

---

## Configuration Files

### `jsdoc.json`

JSDoc configuration for generating API documentation:
- **Source**: Scans all TypeScript files in `src/`
- **Template**: Uses `better-docs` template for enhanced documentation
- **Output**: Generates to `docs/api/` directory
- **Features**: 
  - Markdown support
  - Syntax highlighting
  - GitHub integration
  - Tutorial support from `/docs`

### Package.json Script

```bash
npm run docs  # Generate JSDoc locally
```

---

## Setup Requirements

### For JSDoc Workflow

The JSDoc workflow requires GitHub Pages to be enabled in the repository settings:

1. Go to repository **Settings** > **Pages**
2. Under **Source**, select **GitHub Actions**
3. Save the settings

The workflow will automatically deploy documentation after each push to main.

---

## Local Testing

Before pushing changes, you can test locally:

```bash
# Quality checks
npm run compile  # TypeScript compilation
npm run production  # Production build
npm run test  # Run test suite

# Documentation generation
npm install --save-dev jsdoc jsdoc-to-markdown better-docs
npm run docs  # Generate docs to docs/api/
```

---

## Notes

- Workflows use Node.js 20 with npm caching for faster builds
- The quality checks workflow will prevent merging if checks fail
- JSDoc workflow only runs after successful merge to main
- Generated documentation in `docs/api/` is gitignored (not committed)
