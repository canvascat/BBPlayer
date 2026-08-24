import { defineConfig } from 'vite-plus'

export default defineConfig({
	defaultPackage: './packages/renderer',
	lint: {
		plugins: [
			'react',
			'typescript',
			'unicorn',
			'eslint',
			'oxc',
			'import',
			'promise',
		],
		categories: {
			suspicious: 'error',
			perf: 'error',
		},
		env: {
			es2022: true,
			browser: true,
			node: true,
		},
		options: {
			typeAware: true,
		},
		rules: {
			'react/react-in-jsx-scope': 'off',
			'no-unused-vars': [
				'error',
				{
					args: 'all',
					argsIgnorePattern: '^_',
					caughtErrors: 'all',
					caughtErrorsIgnorePattern: '^_',
					destructuredArrayIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					ignoreRestSiblings: true,
				},
			],
			'no-console': ['error', { allow: ['error', 'warn'] }],
			'react-hooks/exhaustive-deps': 'allow',
			'react/exhaustive-effect-dependencies': 'allow',
			'typescript/no-explicit-any': 'allow',
			'typescript/no-misused-promises': ['error', { checksVoidReturn: false }],
			'typescript/no-unsafe-type-assertion': 'allow',
			'typescript/consistent-return': 'off',
			'no-underscore-dangle': [
				'error',
				{ allow: ['__csrf', '__dirname', '__filename'] },
			],
			'react/no-unstable-nested-components': 'off',
			'react/no-array-index-key': 'allow',
			'import/no-unassigned-import': 'allow',
			'unicorn/require-module-specifiers': 'allow',
			'unicorn/prefer-add-event-listener': 'allow',
			'eslint/no-await-in-loop': 'error',
			'eslint/no-shadow': 'allow',
			'eslint/preserve-caught-error': 'allow',
			'promise/no-callback-in-promise': 'allow',
			'typescript/no-floating-promises': 'allow',
			'typescript/no-unnecessary-type-conversion': 'allow',
			'always-return': 'allow',
			'no-array-sort': 'allow',
			'no-new-array': 'allow',
			'style-prop-object': 'allow',
			'no-map-spread': 'allow',
			'no-await-in-loop': 'allow',
		},
		settings: {
			react: {
				version: '19.2',
			},
		},
		overrides: [
			{
				files: ['packages/**/*.{ts,tsx,js,jsx}'],
				rules: {
					'no-console': 'allow',
				},
			},
			{
				files: [
					'**/vite.config.ts',
					'**/*.config.ts',
					'**/*.config.mts',
					'packages/main/scripts/**',
				],
				rules: {
					'no-console': 'allow',
				},
			},
		],
	},
	fmt: {
		printWidth: 80,
		useTabs: true,
		semi: false,
		singleQuote: true,
		jsxSingleQuote: true,
		singleAttributePerLine: true,
		sortImports: {
			groups: [
				['side_effect'],
				['builtin'],
				['external', 'type-external'],
				['internal', 'type-internal'],
				['parent', 'type-parent'],
				['sibling', 'type-sibling'],
				['index', 'type-index'],
			],
		},
	},
	staged: {
		'*': 'vp check --fix',
	},
	test: {
		environment: 'node',
		include: ['packages/**/*.test.ts'],
		exclude: [
			'**/node_modules/**',
			'**/dist/**',
			'**/dist-electron/**',
			'**/release/**',
		],
	},
})
