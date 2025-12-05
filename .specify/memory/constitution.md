<!--
═══════════════════════════════════════════════════════════════════════════════
SYNC IMPACT REPORT
═══════════════════════════════════════════════════════════════════════════════
Version Change: [TEMPLATE] → 1.0.0
Change Type: MINOR (Initial constitution establishment)
Date: 2025-11-26

Modified Principles:
  - All principles newly defined (initial constitution)

Added Sections:
  - I. Specification-Driven Development
  - II. Incremental Delivery
  - III. Test Independence
  - IV. Maintainability & Documentation
  - V. Simplicity & Focus
  - Development Standards
  - Quality Gates
  - Governance

Removed Sections: None

Templates Status:
  ✅ .specify/templates/plan-template.md - Reviewed (Constitution Check section aligns)
  ✅ .specify/templates/spec-template.md - Reviewed (User scenarios & requirements align)
  ✅ .specify/templates/tasks-template.md - Reviewed (User story organization aligns)
  ✅ .specify/templates/checklist-template.md - Reviewed (No constitution conflicts)
  ✅ .claude/commands/speckit.constitution.md - Reviewed (No agent-specific refs)

Follow-up TODOs: None
═══════════════════════════════════════════════════════════════════════════════
-->

# Anita Project Constitution

## Core Principles

### I. Specification-Driven Development

All features MUST begin with a written specification before implementation. Specifications MUST include:

- Prioritized user stories (P1, P2, P3...) that are independently testable
- Clear acceptance criteria in Given-When-Then format
- Functional requirements (FR-XXX) with MUST/SHOULD designations
- Success criteria that are measurable and technology-agnostic

**Rationale**: Specifications prevent scope creep, enable parallel development, provide a reference
for validation, and ensure all stakeholders understand the feature before code is written. The
SpecKit workflow enforces this through `/speckit.specify` → `/speckit.plan` → `/speckit.tasks`
progression.

### II. Incremental Delivery

Features MUST be decomposed into independently deliverable user stories ordered by priority. Each
user story MUST:

- Be implementable as a standalone slice of functionality
- Be testable independently without requiring other stories
- Deliver measurable value on its own (viable as an MVP increment)
- Not break previously completed stories when added

**Rationale**: Incremental delivery reduces risk, enables early feedback, allows flexible
prioritization, and ensures progress is always demonstrable. Priority P1 story completion yields a
working MVP; subsequent stories add value without destabilizing the foundation.

### III. Test Independence

Tests MUST be independently executable and MUST NOT depend on execution order or shared mutable
state. When tests are requested in a specification:

- Write tests FIRST and ensure they FAIL before implementation (Red-Green-Refactor)
- Contract tests validate API boundaries and data contracts
- Integration tests validate user journeys end-to-end
- Unit tests (optional) validate isolated component behavior
- Each test MUST be runnable in isolation

**Rationale**: Test independence enables parallel execution, simplifies debugging (failures point to
specific components), prevents cascading failures, and ensures tests remain reliable as the codebase
evolves. This is NOT mandatory TDD—tests are only written when explicitly requested in the spec.

### IV. Maintainability & Documentation

Code and features MUST be maintainable by future developers unfamiliar with the original context.
This requires:

- Clear naming conventions (no abbreviations unless domain-standard)
- Inline comments ONLY where logic is non-obvious (prefer self-documenting code)
- Architecture decision records (ADRs) for significant design choices
- Up-to-date quickstart documentation showing how to use implemented features
- Contracts defined before implementation (API endpoints, data schemas, service boundaries)

**Rationale**: Maintainability reduces technical debt, accelerates onboarding, and prevents knowledge
silos. Documentation is not busywork—it's a forcing function for clear thinking and a reference for
future work. Contracts prevent integration surprises.

### V. Simplicity & Focus

Complexity MUST be justified. Default to the simplest solution that meets current requirements:

- No premature abstraction (three instances before extracting a pattern)
- No speculative features ("we might need this later")
- No framework over-engineering (use language/framework idioms)
- No premature optimization (profile before optimizing)
- Feature flags and backward compatibility ONLY when truly necessary

**Rationale**: Unnecessary complexity increases cognitive load, introduces bugs, and slows
development. YAGNI (You Aren't Gonna Need It) prevents wasted effort. Simple code is easier to
understand, test, modify, and delete. Complexity should emerge from necessity, not anticipation.

## Development Standards

### Code Quality

- Code MUST pass linting and formatting checks before commit
- Security vulnerabilities (OWASP Top 10: XSS, SQL injection, command injection, etc.) MUST be
  avoided
- Error handling MUST be present at system boundaries (user input, external APIs), but NOT for
  scenarios that cannot happen
- Logging MUST be structured and MUST capture security events and critical operations

### Repository Hygiene

- Commit messages MUST be clear and descriptive (conventional commits recommended)
- Unused code MUST be deleted completely (no commented-out code, no `_unused` variables)
- Each task or logical group SHOULD be committed independently
- Feature work SHOULD occur in feature branches (`###-feature-name` format)

## Quality Gates

### Constitution Check (Mandatory)

All implementation plans MUST pass a Constitution Check before Phase 0 research begins. The check
MUST verify:

- Specification completeness (user stories, requirements, success criteria)
- User story independence (each story is testable on its own)
- Complexity justification (any violations of Principle V documented in plan.md)
- Test strategy alignment (if tests requested, contract/integration/unit split is clear)

### Checkpoints (Mandatory)

- **After Foundational Phase**: Core infrastructure complete, user story work can begin
- **After Each User Story**: Story is independently functional and tested before moving to next
  priority
- **Before Final Deployment**: All requested user stories complete, quickstart.md validated

## Governance

### Amendment Procedure

1. Propose amendment with rationale and version bump justification (MAJOR/MINOR/PATCH)
2. Update `.specify/memory/constitution.md` via `/speckit.constitution` command
3. Validate dependent templates (plan-template.md, spec-template.md, tasks-template.md) for
   consistency
4. Update templates if constitution adds/removes mandatory sections or constraints
5. Commit with message: `docs: amend constitution to vX.Y.Z (summary of changes)`

### Versioning Policy

- **MAJOR**: Backward incompatible governance changes (principle removal, redefinition that breaks
  existing workflows)
- **MINOR**: New principle added, new mandatory section, materially expanded guidance
- **PATCH**: Clarifications, wording improvements, typo fixes, non-semantic refinements

### Compliance Review

- All PRs MUST reference applicable constitution principles in description or review comments
- Constitution violations MUST be documented in the "Complexity Tracking" section of plan.md with
  justification
- Unjustified complexity or principle violations SHOULD be rejected in code review

**Version**: 1.0.0 | **Ratified**: 2025-11-26 | **Last Amended**: 2025-11-26
