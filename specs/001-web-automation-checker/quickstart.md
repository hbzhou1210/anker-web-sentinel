# Quickstart Guide: Web Automation Checker

**Feature**: Web Automation Checker
**Version**: 1.0.0
**Last Updated**: 2025-11-27

## Overview

The Web Automation Checker is a visual tool that automatically tests webpages for UI functionality and performance issues. Enter any URL, get a comprehensive report in seconds.

**What it does**:
- ✅ Tests if links, forms, buttons, and images work correctly
- ⚡ Measures page load time, resource size, and response speed
- 📊 Shows visual dashboard with pass/fail indicators
- 🔍 Provides detailed diagnostics and fix suggestions (P2)
- 📈 Tracks test history and trends over time (P3)

---

## Prerequisites

- **Node.js** 20 LTS or higher
- **PostgreSQL** 16 or higher
- **npm** or **yarn** package manager
- Modern web browser (Chrome 100+, Firefox 100+, or Safari 16+)

---

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/anita-project.git
cd anita-project
```

### 2. Install Dependencies

```bash
# Install all dependencies (frontend + backend)
npm install

# Playwright browsers will be installed automatically
```

### 3. Configure Database

```bash
# Create PostgreSQL database
createdb web_automation_checker

# Set database URL in environment
cp .env.example .env
# Edit .env and set DATABASE_URL=postgresql://user:pass@localhost:5432/web_automation_checker
```

### 4. Run Database Migrations

```bash
# From backend directory
cd backend
npm run migrate
```

### 5. Start the Application

```bash
# From project root
npm run dev

# This starts:
# - Frontend dev server on http://localhost:5173
# - Backend API server on http://localhost:3000
```

---

## Quick Usage Guide

### P1: Basic URL Testing

**Goal**: Test a webpage and get an instant report

**Steps**:

1. **Open the app** in your browser: `http://localhost:5173`

2. **Enter a URL** in the input field:
   ```
   https://example.com
   ```

3. **Click "Check"** button

4. **Wait for results** (typically 10-30 seconds):
   - Progress indicator shows test is running
   - Don't close the tab during testing

5. **View the report**:
   - **Overall Score**: 0-100 health score at the top
   - **UI Tests**: Links, forms, buttons, images (green = pass, red = fail)
   - **Performance**: Load time, resource size, response time, render time
   - **Summary Stats**: Total checks, passed, failed, warnings

**Example Output**:
```
Overall Health Score: 85/100 ✅

UI Functionality Tests:
  ✅ Links: 12 clickable links found, all functional
  ✅ Forms: 1 form detected, submit button present
  ✅ Buttons: 5 buttons tested, all responsive
  ✅ Images: 8 images loaded successfully

Performance Metrics:
  ✅ Load Time: 2.1s (threshold: 3s)
  ⚠️  Resource Size: 2.3MB (threshold: 2MB)
  ✅ Response Time: 320ms (threshold: 500ms)
  ✅ Render Time: 1.8s (threshold: 2s)
```

---

### P2: Detailed Problem Analysis

**Goal**: Understand why a test failed and how to fix it

**Steps**:

1. **Run a test** (follow P1 steps above)

2. **Look for red (failed) or yellow (warning) indicators**

3. **Click on any failed test item**:
   - A detail panel slides in from the right

4. **Review diagnostic information**:
   - **Screenshot**: Visual highlight of the problem area
   - **Element Info**: CSS selector or description
   - **Error Message**: What went wrong
   - **Recommendation**: Suggested fix

5. **Close the detail panel**:
   - Click the X or click outside the panel

**Example Failed Test**:
```
❌ Links: 2 broken links detected

[Click to expand]

Detail Panel:
--------------
Element: <a href="/404-page">About Us</a>
Location: Header navigation, 3rd item
Error: Link target returns HTTP 404 Not Found
Screenshot: [Shows header with broken link highlighted]
Recommendation: Update href to valid page or remove link
```

**Example Performance Warning**:
```
⚠️ Resource Size: 2.3MB (exceeds 2MB threshold by 15%)

[Click to expand]

Detail Panel:
--------------
Largest Resources:
  1. hero-image.jpg - 1.2MB (52% of total)
  2. video-background.mp4 - 800KB (35%)
  3. main.bundle.js - 200KB (9%)

Recommendation:
  - Compress hero-image.jpg using WebP format (save ~70%)
  - Consider lazy-loading video-background.mp4
  - Enable gzip compression for JavaScript files
```

---

### P3: Test History & Comparison

**Goal**: Track webpage health over time and identify regressions

#### View History

**Steps**:

1. **Run multiple tests** on the same URL (over different times)

2. **Click "View History"** button on a report

3. **See timeline** of all tests for that URL:
   - Each point shows date, time, and score
   - Color-coded: green (improving), yellow (stable), red (degrading)

4. **Identify trends**:
   - **Improving**: Score increasing over last 3 tests
   - **Degrading**: Score decreasing by >5 points ⚠️
   - **Stable**: No significant change

**Example History View**:
```
Test History for https://example.com
═════════════════════════════════════════

Latest Score: 85 | Trend: DEGRADING ⚠️
First Tested: 2025-11-20 | Total Runs: 5

Timeline:
Nov 27, 10:30 AM - Score: 85 ⬇️ (-7)
Nov 26, 3:15 PM  - Score: 92 ⬇️ (-3)
Nov 25, 11:00 AM - Score: 95 ⬆️ (+2)
Nov 24, 9:45 AM  - Score: 93 (stable)
Nov 20, 2:00 PM  - Score: 94 (first run)

⚠️ Warning: Performance degrading over last 3 tests
   Suggestion: Check recent code deployments
```

#### Compare Two Reports

**Steps**:

1. **From history view**, select two test runs

2. **Click "Compare"** button

3. **Review comparison**:
   - **Score Change**: Delta between reports
   - **Test Status Changes**: Which tests changed (pass→fail, fail→pass)
   - **Performance Trends**: Faster or slower?
   - **New Issues**: Problems that appeared since last run

**Example Comparison**:
```
Comparing Nov 26 (Score: 92) vs Nov 27 (Score: 85)
════════════════════════════════════════════════════

Overall: -7 points ⬇️

Changed Tests:
  ❌ NEW FAILURE: Links test failed (was passing)
     - 2 links became broken since Nov 26
  ✅ FIXED: Image test now passing (was failing)
     - All images loading correctly

Performance Changes:
  Load Time: 2.1s → 2.8s (+33%) ⬇️
  Resource Size: 2.0MB → 2.3MB (+15%) ⬇️
  Response Time: 320ms (no change)
  Render Time: 1.8s → 1.9s (+6%)

Detected Issue:
  Recent deployment added large images without optimization
  Recommendation: Compress new assets before next release
```

---

## API Usage (for developers)

If you want to integrate the checker into your CI/CD pipeline or automate testing:

### Create a Test

```bash
curl -X POST http://localhost:3000/api/v1/tests \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# Response:
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "url": "https://example.com",
  "status": "pending",
  "requestedAt": "2025-11-27T10:30:00Z"
}
```

### Poll for Status

```bash
curl http://localhost:3000/api/v1/tests/550e8400-e29b-41d4-a716-446655440000

# Response when completed:
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  ...
}
```

### Get Report

```bash
curl http://localhost:3000/api/v1/reports/{reportId}

# Response: Full TestReport object with all results
```

See [API Contract](./contracts/api.yaml) for complete API documentation.

---

## Configuration

### Test Timeouts

Default: 30 seconds

```json
{
  "url": "https://slow-site.com",
  "config": {
    "timeout": 45  // Wait up to 45 seconds
  }
}
```

### JavaScript Wait Time

Default: 5 seconds (wait for dynamic content to load)

```json
{
  "url": "https://react-app.com",
  "config": {
    "waitTime": 7  // Wait 7 seconds for React to render
  }
}
```

### Performance Thresholds

Edit `backend/src/config/thresholds.ts`:

```typescript
export const PERFORMANCE_THRESHOLDS = {
  loadTime: 3000,      // 3 seconds
  resourceSize: 2 * 1024 * 1024,  // 2MB
  responseTime: 500,   // 500ms
  renderTime: 2000     // 2 seconds
};
```

---

## Troubleshooting

### Test Fails with "Timeout"

**Problem**: Page takes longer than 30 seconds to load

**Solutions**:
1. Increase timeout in test config (up to 60 seconds)
2. Check if the target website is actually online
3. Test a simpler page first to verify the tool works

### "Browser Launch Failed" Error

**Problem**: Playwright can't launch browser

**Solutions**:
```bash
# Reinstall Playwright browsers
cd backend
npx playwright install

# On Linux, install system dependencies
npx playwright install-deps
```

### Database Connection Error

**Problem**: Can't connect to PostgreSQL

**Solutions**:
1. Check PostgreSQL is running: `pg_isready`
2. Verify DATABASE_URL in `.env` file
3. Ensure database exists: `psql -l | grep web_automation_checker`

### Frontend Can't Reach Backend

**Problem**: API calls return network errors

**Solutions**:
1. Check backend is running: `curl http://localhost:3000/health`
2. Verify VITE_API_URL in `frontend/.env` (should be `http://localhost:3000`)
3. Check for CORS errors in browser console

---

## Best Practices

### ✅ DO

- Test public URLs without authentication (MVP supports this)
- Wait for test completion before closing browser tab
- Review detailed diagnostics for failed tests
- Compare reports after code changes to detect regressions
- Run tests regularly to build meaningful history

### ❌ DON'T

- Test localhost URLs (backend can't reach them from server)
- Submit non-HTTP URLs (file://, ftp://, etc. are blocked)
- Run 100+ tests in quick succession (rate limit: 10/minute)
- Expect instant results (average 10-30 seconds per test)
- Test pages requiring login (P1 MVP doesn't support auth)

---

## Next Steps

### Learn More

- **[Specification](./spec.md)**: Detailed requirements and user stories
- **[Data Model](./data-model.md)**: Database schema and entity relationships
- **[API Contract](./contracts/api.yaml)**: Complete OpenAPI specification
- **[Research Decisions](./research.md)**: Technology choices and architecture

### Extend the Tool

**Ideas for enhancements**:
- Add authentication support for private pages
- Export reports to PDF
- Slack/email notifications for failures
- Schedule automated recurring tests
- Mobile device emulation
- Accessibility testing (WCAG compliance)

---

## Support

**Questions or Issues?**
- File a bug report: GitHub Issues
- Check the FAQ: [Link to FAQ]
- Contact team: team@example.com

**Contributing**:
See CONTRIBUTING.md for development guidelines.
