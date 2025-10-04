# Project Documentation

This directory contains project-level documentation for development, planning, and technical specifications.

## Directory Structure

### `/specifications` - Technical Specifications

Technical specifications describe **how** the system implements features. These documents include:
- Implementation details and algorithms
- Data structures and interfaces
- Field formats and validation rules
- API contracts and protocols

See [specifications/README.md](specifications/README.md) for the complete specification index.

### `/user-stories` - User Stories

User stories describe **what** users want to accomplish. Each story follows the format:
> "As a user, I want... so that..."

Stories are organized by functional area (VCF management, relationships, contact data, etc.).

See [user-stories/README.md](user-stories/README.md) for the complete story index.

### `/plans` - Implementation Plans

Multi-stage implementation plans for complex features. These documents track:
- Development milestones
- Task breakdown
- Dependencies and sequencing
- Implementation status

### `/references` - Third-Party References

Documentation for external libraries and APIs:
- **`references/vcard/`**: vCard 4.0 specification and extensions
- **`references/obsidian/`**: Obsidian plugin API documentation

## Documentation Workflow

When working on a feature:

1. **Understand the Need**: Read the related user story
2. **Review the Spec**: Check the technical specification
3. **Plan the Work**: Create or update an implementation plan
4. **Implement**: Write code following the specification
5. **Test**: Verify against user story requirements
6. **Document**: Update specs and user guides as needed

## Relationship to /docs

- **`/docs`**: User-facing and general developer documentation
- **`/project`**: Project-level documentation for contributors and maintainers

User guides, getting started, and feature overviews belong in `/docs`.  
Technical specs, user stories, and implementation plans belong in `/project`.

## Contributing

When adding documentation:
- Put user stories in `/project/user-stories/`
- Put technical specs in `/project/specifications/`
- Put implementation plans in `/project/plans/`
- Put user guides in `/docs/`
