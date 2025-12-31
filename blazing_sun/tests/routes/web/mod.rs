// Web Route Tests (Playwright)
//
// Each page has its own folder:
// - SIGN_IN/  - Sign-in page tests
// - SIGN_UP/  - Sign-up page tests
// - DASHBOARD/ - Dashboard page tests
// - etc.
//
// These tests use Playwright for browser automation.
//
// # Setup
// ```bash
// cd blazing_sun/tests
// npm install
// npx playwright install
// ```
//
// # Running Tests
// ```bash
// npm test                    # Run all tests
// npm run test:headed         # Run with visible browser
// npm run test:debug          # Run in debug mode
// npm run test:sign-in        # Run SIGN_IN tests only
// npm run test:report         # View HTML report
// ```
//
// # Test Structure
// tests/routes/web/
// ├── SIGN_IN/
// │   └── sign_in.spec.ts
// ├── SIGN_UP/
// │   └── sign_up.spec.ts
// └── {PAGE_NAME}/
//     └── {page_name}.spec.ts
//
// # Using Playwright MCP
// Claude Code can run these tests using the Playwright MCP.
// Say: "Use playwright mcp to test the sign-in page"
