# Data Model: Web Automation Checker

**Feature**: Web Automation Checker
**Date**: 2025-11-27
**Phase**: 1 - Design & Contracts

## Overview

This document defines the data entities, their relationships, validation rules, and state transitions for the Web Automation Checker feature. All entities are derived from the functional requirements in [spec.md](./spec.md).

## Entity Relationship Diagram

```text
┌─────────────────┐
│  TestRequest    │
└────────┬────────┘
         │ 1
         │
         │ creates
         │
         ▼ 1
┌─────────────────┐         ┌──────────────────┐
│   TestReport    ├────────►│  UITestResult    │
│                 │ 1     * │                  │
└────────┬────────┘         └──────────────────┘
         │ 1
         │
         │ has
         │
         ▼ *
┌─────────────────┐
│PerformanceResult│
└─────────────────┘

┌─────────────────┐
│  TestHistory    │ (Aggregate view of TestReports by URL)
└─────────────────┘
```

## Core Entities

### 1. TestRequest

**Purpose**: Represents a user's request to test a specific URL.

**Attributes**:

| Field           | Type      | Required | Validation                          | Description                                      |
|-----------------|-----------|----------|-------------------------------------|--------------------------------------------------|
| `id`            | UUID      | Yes      | Auto-generated                      | Unique identifier for the test request           |
| `url`           | String    | Yes      | URL format, https?://, max 2048 chars | The webpage URL to be tested                    |
| `requestedAt`   | DateTime  | Yes      | Auto-set to current timestamp       | When the test was requested                      |
| `status`        | Enum      | Yes      | [pending, running, completed, failed] | Current state of the test execution            |
| `config`        | JSON      | No       | Optional configuration object       | Test configuration (timeout, wait time, etc.)    |

**Validation Rules**:
- `url` MUST match regex: `^https?://[^\s/$.?#].[^\s]{0,2046}$`
- `url` MUST NOT use `file://`, `ftp://`, or other non-HTTP protocols
- `status` defaults to `pending` on creation
- `config.timeout` (if provided) MUST be between 5-60 seconds, default 30
- `config.waitTime` (if provided) MUST be between 0-10 seconds, default 5

**State Transitions**:
```text
pending → running → completed
                 → failed
```

**Business Rules**:
- A TestRequest automatically creates a TestReport when status changes to `completed`
- Failed requests create a TestReport with error details
- Timeout after 30 seconds changes status to `failed`

---

### 2. TestReport

**Purpose**: Contains the complete test results for a tested URL.

**Attributes**:

| Field              | Type       | Required | Validation                    | Description                                   |
|--------------------|------------|----------|-------------------------------|-----------------------------------------------|
| `id`               | UUID       | Yes      | Auto-generated                | Unique identifier for the report              |
| `testRequestId`    | UUID       | Yes      | Foreign key to TestRequest    | The request that generated this report        |
| `url`              | String     | Yes      | Same as TestRequest.url       | URL that was tested                           |
| `overallScore`     | Integer    | Yes      | 0-100                         | Overall health score (0=all fail, 100=all pass) |
| `totalChecks`      | Integer    | Yes      | >= 0                          | Total number of tests performed               |
| `passedChecks`     | Integer    | Yes      | >= 0, <= totalChecks          | Number of passed tests                        |
| `failedChecks`     | Integer    | Yes      | >= 0, <= totalChecks          | Number of failed tests                        |
| `warningChecks`    | Integer    | Yes      | >= 0, <= totalChecks          | Number of warnings                            |
| `testDuration`     | Integer    | Yes      | Milliseconds, >= 0            | How long the test took to execute             |
| `completedAt`      | DateTime   | Yes      | Auto-set when completed       | When the test finished                        |
| `uiTestResults`    | Relation   | Yes      | One-to-many UITestResult      | Collection of UI test results                 |
| `performanceResults` | Relation | Yes      | One-to-many PerformanceResult | Collection of performance metrics             |

**Validation Rules**:
- `overallScore` calculated as: `(passedChecks / totalChecks) * 100`
- `passedChecks + failedChecks + warningChecks` MUST equal `totalChecks`
- `testDuration` MUST be <= 30000ms (30 second timeout)
- Cannot be created without at least one UITestResult and one PerformanceResult

**Calculated Fields**:
- `overallScore = Math.round((passedChecks / totalChecks) * 100)`

**Business Rules**:
- Each TestReport is immutable once created (no updates after `completedAt` is set)
- Reports are retained for 30 days (P3 feature), then automatically archived/deleted
- A URL can have multiple TestReports over time (history feature)

---

### 3. UITestResult

**Purpose**: Represents the outcome of a single UI functionality test (link, form, button, or image).

**Attributes**:

| Field            | Type     | Required | Validation                          | Description                                   |
|------------------|----------|----------|-------------------------------------|-----------------------------------------------|
| `id`             | UUID     | Yes      | Auto-generated                      | Unique identifier                             |
| `testReportId`   | UUID     | Yes      | Foreign key to TestReport           | The report this result belongs to             |
| `testType`       | Enum     | Yes      | [link, form, button, image]         | Type of UI element tested                     |
| `elementId`      | String   | No       | Max 255 chars                       | CSS selector or description of element        |
| `status`         | Enum     | Yes      | [pass, fail, warning]               | Test outcome                                  |
| `errorMessage`   | String   | No       | Max 1000 chars                      | Error description if failed                   |
| `screenshotUrl`  | String   | No       | URL format, max 2048 chars          | Screenshot of failed element (P2 feature)     |
| `recommendation` | String   | No       | Max 500 chars                       | Suggested fix (P2 feature)                    |
| `diagnostics`    | JSON     | No       | Optional diagnostic data            | Additional debugging info                     |

**Validation Rules**:
- `status` = `fail` requires `errorMessage` to be present
- `status` = `pass` should NOT have `errorMessage` or `screenshotUrl`
- `screenshotUrl` only present when `status` = `fail` and screenshot was captured
- `recommendation` only provided for `fail` status

**Test Type Definitions**:
- **link**: Tests if anchor tags (`<a>`) have valid hrefs and are clickable
- **form**: Tests if forms have submit buttons and proper action attributes
- **button**: Tests if button elements respond to click events
- **image**: Tests if images load successfully (no 404/broken src)

**Business Rules**:
- Each TestReport MUST have at least 4 UITestResults (one per testType)
- Screenshots are compressed to WebP format (80% quality) before storage
- Recommendations are generated based on error patterns (e.g., "Check if href attribute exists")

---

### 4. PerformanceResult

**Purpose**: Represents a single performance metric measurement.

**Attributes**:

| Field            | Type     | Required | Validation                          | Description                                   |
|------------------|----------|----------|-------------------------------------|-----------------------------------------------|
| `id`             | UUID     | Yes      | Auto-generated                      | Unique identifier                             |
| `testReportId`   | UUID     | Yes      | Foreign key to TestReport           | The report this metric belongs to             |
| `metricName`     | Enum     | Yes      | [loadTime, resourceSize, responseTime, renderTime] | Type of performance metric |
| `measuredValue`  | Decimal  | Yes      | >= 0                                | The measured value                            |
| `unit`           | Enum     | Yes      | [ms, bytes, score]                  | Unit of measurement                           |
| `threshold`      | Decimal  | Yes      | >= 0                                | Pass/fail threshold                           |
| `status`         | Enum     | Yes      | [pass, fail, warning]               | Whether value meets threshold                 |
| `recommendation` | String   | No       | Max 500 chars                       | Optimization suggestion (P2 feature)          |
| `details`        | JSON     | No       | Optional breakdown data             | Detailed breakdown (e.g., largest resources)  |

**Validation Rules**:
- `measuredValue` and `threshold` MUST use same `unit`
- `status` = `pass` when `measuredValue <= threshold` (for time/size metrics)
- `status` = `warning` when `measuredValue` is within 10% of threshold
- `recommendation` required when `status` = `fail`

**Metric Definitions**:

| Metric Name      | Unit    | Default Threshold | Description                                |
|------------------|---------|-------------------|--------------------------------------------|
| `loadTime`       | ms      | 3000              | Time from start to page fully loaded       |
| `resourceSize`   | bytes   | 2097152 (2MB)     | Total size of all resources (HTML/CSS/JS)  |
| `responseTime`   | ms      | 500               | Time to first byte (TTFB)                  |
| `renderTime`     | ms      | 2000              | Time to interactive (TTI)                  |

**Business Rules**:
- Each TestReport MUST have at least 4 PerformanceResults (one per metricName)
- Thresholds are configurable per test but default to industry standards
- Recommendations include specific resources to optimize (e.g., "Compress image.png (1.5MB)")

---

### 5. TestHistory (Aggregate Entity)

**Purpose**: Provides a timeline view of all tests for a specific URL (P3 feature).

**Attributes**:

| Field            | Type           | Required | Validation               | Description                                |
|------------------|----------------|----------|--------------------------|--------------------------------------------|
| `url`            | String         | Yes      | URL format               | The URL being tracked                      |
| `reports`        | Relation       | Yes      | Collection of TestReports | All TestReports for this URL, ordered by completedAt DESC |
| `latestScore`    | Integer        | Yes      | 0-100                    | Most recent overallScore                   |
| `trend`          | Enum           | Yes      | [improving, stable, degrading] | Score trend over last 3 tests      |
| `totalRuns`      | Integer        | Yes      | >= 0                     | Number of times this URL was tested        |
| `firstTestedAt`  | DateTime       | Yes      | From earliest report     | When first test occurred                   |
| `lastTestedAt`   | DateTime       | Yes      | From latest report       | When most recent test occurred             |

**Calculated Fields**:
- `latestScore` = most recent TestReport.overallScore
- `trend` = comparison of last 3 TestReport.overallScore values
  - `improving` if scores increasing
  - `degrading` if scores decreasing by >5 points
  - `stable` otherwise
- `totalRuns` = count of TestReports for this URL
- `firstTestedAt` = MIN(TestReport.completedAt) for this URL
- `lastTestedAt` = MAX(TestReport.completedAt) for this URL

**Business Rules**:
- TestHistory is a **view**, not a stored table (computed on-demand)
- Used for P3 "View History" and comparison features
- Trend warning displayed when `trend` = `degrading` for 3+ consecutive runs

---

## Database Schema (PostgreSQL)

```sql
-- TestRequest table
CREATE TABLE test_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url VARCHAR(2048) NOT NULL,
  requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  config JSONB,
  CONSTRAINT valid_status CHECK (status IN ('pending', 'running', 'completed', 'failed'))
);

CREATE INDEX idx_test_requests_status ON test_requests(status);
CREATE INDEX idx_test_requests_requested_at ON test_requests(requested_at DESC);

-- TestReport table
CREATE TABLE test_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_request_id UUID NOT NULL REFERENCES test_requests(id) ON DELETE CASCADE,
  url VARCHAR(2048) NOT NULL,
  overall_score INTEGER NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  total_checks INTEGER NOT NULL CHECK (total_checks >= 0),
  passed_checks INTEGER NOT NULL CHECK (passed_checks >= 0),
  failed_checks INTEGER NOT NULL CHECK (failed_checks >= 0),
  warning_checks INTEGER NOT NULL CHECK (warning_checks >= 0),
  test_duration INTEGER NOT NULL CHECK (test_duration >= 0),
  completed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT total_checks_valid CHECK (passed_checks + failed_checks + warning_checks = total_checks)
);

CREATE INDEX idx_test_reports_url ON test_reports(url, completed_at DESC);
CREATE INDEX idx_test_reports_completed_at ON test_reports(completed_at DESC);

-- UITestResult table
CREATE TABLE ui_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_report_id UUID NOT NULL REFERENCES test_reports(id) ON DELETE CASCADE,
  test_type VARCHAR(20) NOT NULL,
  element_id VARCHAR(255),
  status VARCHAR(20) NOT NULL,
  error_message VARCHAR(1000),
  screenshot_url VARCHAR(2048),
  recommendation VARCHAR(500),
  diagnostics JSONB,
  CONSTRAINT valid_test_type CHECK (test_type IN ('link', 'form', 'button', 'image')),
  CONSTRAINT valid_status CHECK (status IN ('pass', 'fail', 'warning'))
);

CREATE INDEX idx_ui_test_results_report ON ui_test_results(test_report_id);

-- PerformanceResult table
CREATE TABLE performance_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_report_id UUID NOT NULL REFERENCES test_reports(id) ON DELETE CASCADE,
  metric_name VARCHAR(50) NOT NULL,
  measured_value DECIMAL(10, 2) NOT NULL CHECK (measured_value >= 0),
  unit VARCHAR(20) NOT NULL,
  threshold DECIMAL(10, 2) NOT NULL CHECK (threshold >= 0),
  status VARCHAR(20) NOT NULL,
  recommendation VARCHAR(500),
  details JSONB,
  CONSTRAINT valid_metric CHECK (metric_name IN ('loadTime', 'resourceSize', 'responseTime', 'renderTime')),
  CONSTRAINT valid_unit CHECK (unit IN ('ms', 'bytes', 'score')),
  CONSTRAINT valid_status CHECK (status IN ('pass', 'fail', 'warning'))
);

CREATE INDEX idx_performance_results_report ON performance_results(test_report_id);

-- TestHistory view (P3 feature)
CREATE VIEW test_history AS
SELECT
  url,
  COUNT(*) as total_runs,
  MIN(completed_at) as first_tested_at,
  MAX(completed_at) as last_tested_at,
  (SELECT overall_score FROM test_reports tr2 WHERE tr2.url = tr.url ORDER BY completed_at DESC LIMIT 1) as latest_score
FROM test_reports tr
GROUP BY url;
```

---

## TypeScript Interfaces (Shared between Frontend & Backend)

```typescript
// Enums
export enum TestRequestStatus {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed'
}

export enum TestResultStatus {
  Pass = 'pass',
  Fail = 'fail',
  Warning = 'warning'
}

export enum UITestType {
  Link = 'link',
  Form = 'form',
  Button = 'button',
  Image = 'image'
}

export enum PerformanceMetric {
  LoadTime = 'loadTime',
  ResourceSize = 'resourceSize',
  ResponseTime = 'responseTime',
  RenderTime = 'renderTime'
}

export enum MetricUnit {
  Milliseconds = 'ms',
  Bytes = 'bytes',
  Score = 'score'
}

export enum Trend {
  Improving = 'improving',
  Stable = 'stable',
  Degrading = 'degrading'
}

// Entities
export interface TestRequest {
  id: string;  // UUID
  url: string;
  requestedAt: Date;
  status: TestRequestStatus;
  config?: {
    timeout?: number;  // seconds
    waitTime?: number; // seconds
  };
}

export interface TestReport {
  id: string;  // UUID
  testRequestId: string;  // UUID
  url: string;
  overallScore: number;  // 0-100
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  warningChecks: number;
  testDuration: number;  // milliseconds
  completedAt: Date;
  uiTestResults: UITestResult[];
  performanceResults: PerformanceResult[];
}

export interface UITestResult {
  id: string;  // UUID
  testReportId: string;  // UUID
  testType: UITestType;
  elementId?: string;
  status: TestResultStatus;
  errorMessage?: string;
  screenshotUrl?: string;
  recommendation?: string;
  diagnostics?: Record<string, any>;
}

export interface PerformanceResult {
  id: string;  // UUID
  testReportId: string;  // UUID
  metricName: PerformanceMetric;
  measuredValue: number;
  unit: MetricUnit;
  threshold: number;
  status: TestResultStatus;
  recommendation?: string;
  details?: Record<string, any>;
}

export interface TestHistory {
  url: string;
  reports: TestReport[];
  latestScore: number;
  trend: Trend;
  totalRuns: number;
  firstTestedAt: Date;
  lastTestedAt: Date;
}
```

---

## Data Flow & Lifecycle

### Creating a Test

```text
1. User submits URL → TestRequest created (status: pending)
2. Backend validates URL → status: running
3. Playwright launches browser → runs UI tests → creates UITestResults
4. Lighthouse collects metrics → creates PerformanceResults
5. Scores calculated → TestReport created
6. TestRequest updated → status: completed
7. Frontend receives TestReport → displays visual dashboard
```

### Viewing History (P3)

```text
1. User clicks "View History" for a URL
2. Backend queries test_reports WHERE url = ? ORDER BY completed_at DESC
3. Aggregates into TestHistory view
4. Calculates trend from last 3 reports
5. Frontend displays timeline with trend indicator
```

---

## Summary

- **5 core entities** (TestRequest, TestReport, UITestResult, PerformanceResult, TestHistory)
- **Relational model** with clear foreign keys and constraints
- **Type-safe** TypeScript interfaces shared between frontend and backend
- **Validation rules** enforced at database and application layers
- **P3 history** supported through indexed queries and aggregate views

All entities align with functional requirements (FR-001 through FR-010) and success criteria from [spec.md](./spec.md).
