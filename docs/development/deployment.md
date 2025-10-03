# Deployment

## Building for Release

1. **Update version** in `manifest.json` and `package.json`
2. **Run tests**: `npm test`
3. **Check coverage**: `npm run test:coverage`
4. **Build**: `npm run build`
5. **Create release**: Tag and create GitHub release
6. **Publish**: Submit to Obsidian community plugins (if applicable)

## Release Checklist

- [ ] Version numbers updated
- [ ] Tests passing
- [ ] Coverage targets met
- [ ] Build successful
- [ ] Documentation updated
- [ ] Changelog updated
- [ ] Breaking changes noted
- [ ] Migration guide provided (if needed)

## Common Issues

1. **Build Errors**: Verify TypeScript version and dependencies are installed
2. **Test Failures**: Ensure test environment is properly configured
3. **Plugin Loading**: Verify manifest.json format
4. **Relationship Sync Issues**: Check that contacts have valid UIDs
5. **VCF Parse Errors**: Ensure VCF files follow vCard 4.0 format

## Debugging

1. **Console Logging**: Check Obsidian dev console (Ctrl+Shift+I)
2. **Test Debugging**: Run tests with `--reporter=verbose` flag
3. **Processor Debugging**: Add logging to individual processors
4. **Relationship Issues**: Use test fixtures to isolate problems

## Getting Help

- **Issues**: Report bugs on [GitHub Issues](https://github.com/iandennismiller/obsidian-vcf-contacts/issues)
- **Discussions**: Ask questions in [GitHub Discussions](https://github.com/iandennismiller/obsidian-vcf-contacts/discussions)
