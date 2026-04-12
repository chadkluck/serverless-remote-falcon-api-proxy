/**
 * Backend Dependency Analysis Test
 * Validates that backend tests don't import frontend modules
 * Requirements: 1.1 - Backend tests must run without frontend dependencies
 */

const { BackendDependencyAnalyzer } = require('./dependencyAnalysis');

describe('Backend Test Dependency Analysis', () => {
  test('should not have any frontend dependencies in backend tests', () => {
    const analyzer = new BackendDependencyAnalyzer();
    const results = analyzer.analyzeAllTests();
    
    // If there are violations, print detailed report for debugging
    if (results.hasViolations) {
      analyzer.printViolationReport();
    }
    
    // Assert that no frontend dependencies were found
    expect(results.violations).toHaveLength(0);
    expect(results.hasViolations).toBe(false);
  });

  test('should analyze at least some test files', () => {
    const analyzer = new BackendDependencyAnalyzer();
    const results = analyzer.analyzeAllTests();
    
    // Ensure the analyzer actually found and analyzed test files
    expect(results.totalFilesAnalyzed).toBeGreaterThan(0);
  });

  test('should provide meaningful summary information', () => {
    const analyzer = new BackendDependencyAnalyzer();
    const results = analyzer.analyzeAllTests();
    
    expect(results.summary).toBeDefined();
    expect(typeof results.summary).toBe('string');
    expect(results.summary.length).toBeGreaterThan(0);
  });
});