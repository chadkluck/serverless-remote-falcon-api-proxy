module.exports = {
	testEnvironment: 'node',
	testMatch: ['**/tests/**/*.test.js'],
	collectCoverageFrom: [
		'**/*.js',
		'!**/node_modules/**',
		'!**/tests/**'
	],
	transformIgnorePatterns: [
		'/node_modules/(?!jose)/'
	],
	transform: {
		'^.+\\.js$': ['babel-jest', { plugins: ['@babel/plugin-transform-modules-commonjs'] }]
	}
};
