import { resolve } from 'node:path'

import { defineConfig } from 'vite-plus'

export default defineConfig({
	defaultPackage: './packages/renderer',
	lint: {
		ignorePatterns: ['**/routeTree.gen.ts'],
		plugins: [
			'react',
			'typescript',
			'unicorn',
			'eslint',
			'oxc',
			'import',
			'promise',
		],
		jsPlugins: ['@shadcn/lint'],
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
			'react/error-boundaries': 'error',
			'react/globals': 'error',
			'react/immutability': 'error',
			'react/incompatible-library': 'error',
			'react/preserve-manual-memoization': 'error',
			'react/purity': 'error',
			'react/refs': 'error',
			'react/set-state-in-effect': 'error',
			'react/set-state-in-render': 'error',
			'react/static-components': 'error',
			'react/unsupported-syntax': 'error',
			'react/use-memo': 'error',
			'react/void-use-memo': 'error',
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
			'shadcn/no-restyle': [
				'error',
				{
					allow: ['layout'],
					contracts: [
						{
							pattern: '^Button$',
							allow: [
								'layout',
								'px-*',
								'py-*',
								'p-0',
								'gap-*',
								'rounded-*',
								'whitespace-*',
								'bg-muted',
								'hover:bg-transparent',
							],
							message: {
								color:
									'Use a Button variant, or bg-muted for pressed/selected ghost buttons.',
								spacing:
									'Use a Button size ({{sizes}}) unless this is a list/cover/nav row.',
								default:
									'Use a Button variant ({{variants}}) instead of restyling appearance.',
							},
						},
						{
							pattern: '^Empty$',
							allow: ['layout', 'border'],
						},
						{
							pattern: '^Card$',
							allow: ['layout', 'spacing', 'rounded-*', '[--card-spacing:*]'],
						},
						{
							pattern: '^Card(Header|Content|Footer|Action)$',
							allow: ['layout', 'spacing'],
						},
						{
							pattern: '^Card(Title|Description)$',
							allow: ['layout', 'typography'],
						},
						{
							pattern: '^InputGroup$',
							allow: ['layout', 'bg-background'],
						},
						{
							pattern: '^Slider$',
							allow: ['layout', 'px-*', 'rounded-none'],
						},
					],
				},
			],
			'shadcn/no-raw-colors': [
				'error',
				{
					allow: ['bg-white'],
					message:
						'Use a theme token from {{file}} instead of "{{className}}". {{suggestions}}',
				},
			],
			'shadcn/no-arbitrary-values': [
				'error',
				{
					allow: [
						'layout',
						'text-[13px]',
						'text-[22px]',
						'[--amll-lp-color:*]',
						'[--amll-lp-hover-bg-color:*]',
						'[--amll-lp-font-size:*]',
						'[--amll-lp-line-width-aspect:*]',
					],
				},
			],
			'shadcn/no-inline-styles': [
				'error',
				{
					allow: [
						'--*',
						'display',
						'animationDuration',
						'transitionProperty',
						'transitionDuration',
						'transitionTimingFunction',
						'gridTemplateColumns',
						'maxWidth',
						'height',
						'width',
						'minHeight',
						'transition',
					],
				},
			],
			'shadcn/no-unknown-classes': 'error',
			'shadcn/require-static-classes': 'error',
		},
		settings: {
			react: {
				version: '19.3',
			},
			shadcn: {
				note: 'Prefer Button/Empty/Card variants and sizes. className is for layout. Tokens: packages/renderer/src/styles.css.',
			},
		},
		overrides: [
			{
				files: ['packages/renderer/src/components/ui/**'],
				rules: {
					'shadcn/no-restyle': 'off',
					'shadcn/no-arbitrary-values': 'off',
					'shadcn/require-static-classes': 'off',
				},
			},
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
		ignorePatterns: ['**/routeTree.gen.ts'],
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
		alias: {
			'@': resolve(import.meta.dirname, 'packages/renderer/src'),
		},
		exclude: [
			'**/node_modules/**',
			'**/dist/**',
			'**/dist-electron/**',
			'**/release/**',
		],
	},
})
