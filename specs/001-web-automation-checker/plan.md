# Implementation Plan: Web Automation Checker

**Branch**: `001-web-automation-checker` | **Date**: 2025-11-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-web-automation-checker/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Build a visual web automation checker tool that allows users to input a URL and receive comprehensive test reports. The system performs two types of automated testing: (1) UI functionality testing - verifying links, forms, buttons, and images work correctly, and (2) Performance testing - measuring page load time, resource size, and response times against industry thresholds. Results are displayed in an interactive visual dashboard with detailed diagnostics for failures.

**Technical Approach**: Web application with React frontend for the UI dashboard and Node.js/Express backend orchestrating automated browser testing via Playwright. Performance metrics collected via Lighthouse API. PostgreSQL stores test history for P3 comparison features.

## Technical Context

**Language/Version**:
- Frontend: TypeScript 5.3 with React 18
- Backend: Node.js 20 LTS with TypeScript 5.3

**Primary Dependencies**:
- Frontend: React 18, TanStack Query (data fetching), Recharts (visualizations), Tailwind CSS
- Backend: Express 4, Playwright (browser automation), Lighthouse (performance), Zod (validation)

**Storage**: PostgreSQL 16 (test results history for P3 feature)

**Testing**:
- Frontend: Vitest + React Testing Library
- Backend: Jest with Supertest (API tests)
- E2E: Playwright (testing the checker itself)

**Target Platform**: Web application (modern browsers: Chrome 100+, Firefox 100+, Safari 16+)

**Project Type**: web (frontend + backend)

**Performance Goals**:
- Complete URL test execution in under 30 seconds (per spec SC-001)
- Dashboard report rendering in under 1 second (per spec SC-006)
- Support 10 concurrent test requests without degradation (per spec SC-007)

**Constraints**:
- Must handle dynamic JavaScript-heavy pages (5s wait time configurable)
- Must timeout long-loading pages at 30 seconds
- Screenshot capture for failed UI elements (memory efficient)
- Must queue concurrent requests gracefully

**Scale/Scope**:
- MVP: Single-user deployment (P1 + P2)
- P3: Multi-user with 30-day history retention
- Expected load: 10 concurrent users, ~1000 tests/day

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Specification-Driven Development ✅ PASS
- ✅ Feature has complete specification with prioritized user stories (P1, P2, P3)
- ✅ All acceptance criteria defined in Given-When-Then format
- ✅ 10 functional requirements with MUST/SHOULD designation
- ✅ 8 measurable, technology-agnostic success criteria

### II. Incremental Delivery ✅ PASS
- ✅ P1 (Basic URL Testing) is independently deliverable MVP
- ✅ P2 (Detailed Problem Analysis) builds on P1 without breaking it
- ✅ P3 (Test History) adds long-term value independently
- ✅ Each story can be tested, deployed, and demonstrated independently

### III. Test Independence ✅ PASS
- ✅ Spec does not explicitly request tests, so TDD is NOT required per constitution
- ✅ If tests are added, they will follow contract/integration/unit split
- ✅ Test independence architecture planned (isolated test data, no shared state)

### IV. Maintainability & Documentation ✅ PASS
- ✅ Clear naming planned (TestRequest, TestReport, UITestResult entities)
- ✅ API contracts will be defined before implementation (Phase 1)
- ✅ Quickstart documentation will be generated (Phase 1)
- ✅ Data model documentation planned (Phase 1)

### V. Simplicity & Focus ✅ PASS
- ✅ Using standard web stack (React + Node.js + PostgreSQL)
- ✅ No premature abstraction (single implementation of each test type)
- ✅ Playwright + Lighthouse are industry-standard tools (not over-engineering)
- ✅ No feature flags or backward compatibility needed for MVP

### Quality Gates ✅ PASS
- ✅ Specification complete and validated (requirements.md checklist passed)
- ✅ User story independence verified (each P1/P2/P3 testable alone)
- ✅ No unjustified complexity (see Complexity Tracking section below)

**GATE RESULT**: ✅ **PASS** - Proceed to Phase 0 research

## Project Structure

### Documentation (this feature)

```text
specs/001-web-automation-checker/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── api.yaml         # OpenAPI specification
│   └── entities.schema.json  # JSON Schema for data entities
└── checklists/
    └── requirements.md  # Specification quality checklist (already created)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── models/          # Data entities (TestRequest, TestReport, etc.)
│   ├── services/        # Business logic (TestExecutionService, PerformanceAnalyzer)
│   ├── automation/      # Playwright-based UI testing
│   ├── performance/     # Lighthouse integration
│   ├── api/             # Express REST endpoints
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── validators/
│   ├── database/        # PostgreSQL connection and migrations
│   └── utils/           # URL validation, screenshot handling
├── tests/
│   ├── integration/     # API endpoint tests
│   └── unit/            # Service and utility tests
├── package.json
└── tsconfig.json

frontend/
├── src/
│   ├── components/      # React components
│   │   ├── TestInput/   # URL input form
│   │   ├── TestReport/  # Main report dashboard
│   │   ├── UITestResults/  # UI test result cards
│   │   ├── PerformanceResults/  # Performance charts
│   │   ├── DetailPanel/  # P2 diagnostic detail view
│   │   └── HistoryView/  # P3 history timeline
│   ├── pages/           # Page-level components
│   │   ├── Home.tsx     # Main checker page (P1)
│   │   └── History.tsx  # History comparison page (P3)
│   ├── services/        # API client (React Query hooks)
│   ├── types/           # TypeScript interfaces matching backend
│   └── utils/           # Formatting, chart helpers
├── tests/
│   └── components/      # Component tests (Vitest)
├── package.json
├── tsconfig.json
└── vite.config.ts

package.json             # Root workspace configuration (monorepo)
```

**Structure Decision**: Selected **Option 2: Web application** structure because the feature requires:
1. A visual frontend for user interaction (URL input, report display, history view)
2. A backend service to orchestrate browser automation and performance testing
3. Clear separation between presentation (React) and automation logic (Node.js/Playwright)

This aligns with the spec's requirement for a "可视化界面" (visual interface) and "自动化测试" (automated testing backend).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations detected. All complexity is justified:
- Web stack (frontend + backend) is required for visual UI + automation separation
- PostgreSQL is needed for P3 history feature (30-day retention requirement)
- Playwright + Lighthouse are industry-standard tools, not custom over-engineering
