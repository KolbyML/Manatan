module.exports = {
    extends: ['airbnb', 'airbnb-typescript', 'prettier'],
    plugins: [
        'unused-imports',
        'eslint-plugin-import',
        '@typescript-eslint',
        'no-relative-import-paths',
        'prettier',
        'header',
    ],
    parserOptions: {
        project: ['./tsconfig.json', './tsconfig.node.json', './tools/scripts/tsconfig.json'],
    },
    overrides: [
        {
            files: ['*'],
            rules: {
                'no-param-reassign': ['error', { props: true, ignorePropertyModificationsForRegex: ["^draft"] }],

                'unused-imports/no-unused-imports': 'error',

                'import/prefer-default-export': 'off',
                'import/no-default-export': 'error',
                'prettier/prettier': 'error',

                'class-methods-use-this': 'off',

                'no-plusplus': ['error', { allowForLoopAfterthoughts: true }],

                // just why
                'react/jsx-uses-react': 'off',
                'react/react-in-jsx-scope': 'off',
                'react/jsx-no-bind': 'off',
                'react/jsx-props-no-spreading': 'off',
                'react/require-default-props': 'off',
                'react/function-component-definition': 'off',

                'react/no-unstable-nested-components': [
                    'error',
                    {
                        allowAsProps: true,
                    },
                ],

                // seems to be bugged for aliases
                'import/extensions': ['error', 'ignorePackages', { '': 'never' }],

                'no-relative-import-paths/no-relative-import-paths': [
                    'error',
                    {
                        rootDir: 'src',
                        prefix: '@',
                    },
                ],

                'no-restricted-imports': [
                    'error',
                    {
                        patterns: [
                            {
                                group: ['@mui/*', '!@mui/material/', '!@mui/icons-material/', '!@mui/x-date-pickers/'],
                            },
                            {
                                group: ['@mui/*/*/*'],
                            },
                        ],
                    },
                ],

                'no-restricted-syntax': [
                    'error',
                    {
                        selector: 'TSTypeReference[typeName.name="SxProps"]:not([typeParameters])',
                        message: 'SxProps must have Theme parameter to avoid significant compiler slowdown.',
                    },
                ],
            },
        },
        {
            files: ['tools/scripts/**/*'],
            rules: {
                'no-relative-import-paths/no-relative-import-paths': 'off',
                'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
            },
        },
    ],
};
