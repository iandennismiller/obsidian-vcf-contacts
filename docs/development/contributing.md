# Contributing

## Development Workflow

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/my-feature`
3. **Make** your changes following the coding standards
4. **Test** your changes: `npm test`
5. **Build** to ensure no errors: `npm run build`
6. **Commit** with clear messages: `git commit -m "Add feature X"`
7. **Push** to your fork: `git push origin feature/my-feature`
8. **Create** a Pull Request

## Coding Standards

- **TypeScript**: Use strict TypeScript with proper typing
- **ESLint**: Follow the configured ESLint rules
- **Comments**: Add JSDoc comments for public methods
- **Tests**: Include tests for new functionality
- **Model Organization**: Keep related functionality within appropriate models

## Architecture Guidelines

1. **Model-Based Organization**: Place functionality in appropriate domain models
2. **Processor Pattern**: Implement data operations as processors when possible
3. **Separation of Concerns**: Keep parsing, business logic, and UI separate
4. **Dependency Injection**: Use dependency injection for testability
5. **Error Handling**: Implement proper error handling and logging
