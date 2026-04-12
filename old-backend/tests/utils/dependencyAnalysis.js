/**
 * Backend Dependency Analysis Script
 * Validates that backend tests don't import frontend modules
 * Requirements: 1.1 - Backend tests must run without frontend dependencies
 */

const fs = require('fs');
const path = require('path');

class BackendDependencyAnalyzer {
  constructor() {
    this.backendRoot = path.resolve(__dirname, '../../');
    this.frontendPaths = [
      '../../../amplifyapp/',
      '../../amplifyapp/',
      '../amplifyapp/',
      'amplifyapp/',
      './amplifyapp/',
      '/amplifyapp/'
    ];
    this.violations = [];
    this.filesAnalyzed = 0;
  }

  /**
   * Analyzes all test files in the backend for frontend dependencies
   * @returns {Object} Analysis results with violations and summary
   */
  analyzeAllTests() {
    this.violations = [];
    this.filesAnalyzed = 0;
    
    // Analyze backend test directory
    this.analyzeDirectory(path.join(this.backendRoot, 'tests'));
    
    // Analyze any test files in src directory (legacy)
    this.analyzeDirectory(path.join(this.backendRoot, 'src'));
    
    return {
      violations: this.violations,
      totalFilesAnalyzed: this.filesAnalyzed,
      hasViolations: this.violations.length > 0,
      summary: this.generateSummary()
    };
  }

  /**
   * Recursively analyzes a directory for test files
   * @param {string} dirPath - Directory to analyze
   */
  analyzeDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
      return;
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        // Skip node_modules and build directories
        if (!['node_modules', 'build', 'dist', '.git', '.aws-sam'].includes(entry.name)) {
          this.analyzeDirectory(fullPath);
        }
      } else if (this.isTestFile(entry.name)) {
        this.analyzeTestFile(fullPath);
      }
    }
  }

  /**
   * Determines if a file is a test file
   * @param {string} filename - File name to check
   * @returns {boolean} True if it's a test file
   */
  isTestFile(filename) {
    return filename.includes('.test.') || 
           filename.includes('.spec.') ||
           filename.endsWith('.test.js') ||
           filename.endsWith('.test.jsx') ||
           filename.endsWith('.spec.js') ||
           filename.endsWith('.spec.jsx');
  }

  /**
   * Analyzes a single test file for frontend dependencies
   * @param {string} filePath - Path to the test file
   */
  analyzeTestFile(filePath) {
    this.filesAnalyzed++;
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      
      lines.forEach((line, lineNumber) => {
        const trimmedLine = line.trim();
        
        // Check for import statements (ES6)
        if (this.isImportStatement(trimmedLine)) {
          const importPath = this.extractImportPath(trimmedLine);
          
          if (importPath && this.isFrontendImport(importPath)) {
            this.violations.push({
              file: path.relative(this.backendRoot, filePath),
              line: lineNumber + 1,
              content: trimmedLine,
              importPath: importPath,
              type: 'frontend_import',
              severity: 'error'
            });
          }
        }
        
        // Check for require statements (CommonJS)
        if (this.isRequireStatement(trimmedLine)) {
          const requirePath = this.extractRequirePath(trimmedLine);
          
          if (requirePath && this.isFrontendImport(requirePath)) {
            this.violations.push({
              file: path.relative(this.backendRoot, filePath),
              line: lineNumber + 1,
              content: trimmedLine,
              importPath: requirePath,
              type: 'frontend_require',
              severity: 'error'
            });
          }
        }
      });
    } catch (error) {
      console.warn(`Warning: Could not analyze file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Checks if a line contains an import statement
   * @param {string} line - Line to check
   * @returns {boolean} True if it's an import statement
   */
  isImportStatement(line) {
    return line.startsWith('import ') && line.includes('from ');
  }

  /**
   * Checks if a line contains a require statement
   * @param {string} line - Line to check
   * @returns {boolean} True if it's a require statement
   */
  isRequireStatement(line) {
    return line.includes('require(') && (line.includes('const ') || line.includes('let ') || line.includes('var '));
  }

  /**
   * Extracts the import path from an import statement
   * @param {string} line - Import statement line
   * @returns {string|null} The import path or null if not found
   */
  extractImportPath(line) {
    const match = line.match(/from\s+['"`]([^'"`]+)['"`]/);
    return match ? match[1] : null;
  }

  /**
   * Extracts the require path from a require statement
   * @param {string} line - Require statement line
   * @returns {string|null} The require path or null if not found
   */
  extractRequirePath(line) {
    const match = line.match(/require\(['"`]([^'"`]+)['"`]\)/);
    return match ? match[1] : null;
  }

  /**
   * Checks if an import path points to frontend code
   * @param {string} importPath - The import path to check
   * @returns {boolean} True if it's a frontend import
   */
  isFrontendImport(importPath) {
    // Check for direct frontend path references
    for (const frontendPath of this.frontendPaths) {
      if (importPath.includes(frontendPath) || importPath.startsWith(frontendPath)) {
        return true;
      }
    }
    
    // Check for absolute paths that might reference frontend
    if (importPath.includes('/amplifyapp/') || importPath.endsWith('/amplifyapp')) {
      return true;
    }
    
    // Check for React-specific imports that shouldn't be in backend
    if (importPath.startsWith('react') || 
        importPath.includes('react-') || 
        importPath.includes('@testing-library/react') ||
        importPath.includes('vitest') ||
        importPath.includes('vite')) {
      return true;
    }
    
    return false;
  }

  /**
   * Generates a summary of the analysis results
   * @returns {string} Summary text
   */
  generateSummary() {
    if (this.violations.length === 0) {
      return `✅ All ${this.filesAnalyzed} backend test files are properly isolated from frontend dependencies.`;
    }
    
    const fileCount = new Set(this.violations.map(v => v.file)).size;
    return `❌ Found ${this.violations.length} frontend dependency violations in ${fileCount} test files.`;
  }

  /**
   * Prints detailed violation report
   */
  printViolationReport() {
    if (this.violations.length === 0) {
      console.log('✅ No frontend dependency violations found in backend tests.');
      return;
    }

    console.log('❌ Frontend Dependency Violations Found:');
    console.log('======================================');
    
    const groupedViolations = this.violations.reduce((groups, violation) => {
      if (!groups[violation.file]) {
        groups[violation.file] = [];
      }
      groups[violation.file].push(violation);
      return groups;
    }, {});

    Object.entries(groupedViolations).forEach(([file, violations]) => {
      console.log(`\nFile: ${file}`);
      violations.forEach(violation => {
        console.log(`  Line ${violation.line}: ${violation.content}`);
        console.log(`    → Frontend import detected: ${violation.importPath}`);
      });
    });

    console.log('\n📋 Remediation Steps:');
    console.log('1. Replace frontend imports with mock events from backend/tests/mock-events/');
    console.log('2. Use MockEventLoader to load frontend requests for testing');
    console.log('3. Ensure tests can run independently without frontend dependencies');
    console.log('4. Use Jest instead of Vitest for backend testing');
  }
}

module.exports = { BackendDependencyAnalyzer };

// CLI usage when run directly
if (require.main === module) {
  const analyzer = new BackendDependencyAnalyzer();
  const results = analyzer.analyzeAllTests();
  
  console.log('\nBackend Test Dependency Analysis');
  console.log('================================');
  console.log(results.summary);
  
  if (results.hasViolations) {
    analyzer.printViolationReport();
    process.exit(1);
  }
}