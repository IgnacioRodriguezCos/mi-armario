export default [
    {
        ignores: ['node_modules/**']
    },
    {
        files: ['app.js', 'logic.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: {
                window: 'readonly',
                document: 'readonly',
                localStorage: 'readonly',
                fetch: 'readonly',
                console: 'readonly',
                setTimeout: 'readonly',
                setInterval: 'readonly',
                location: 'readonly',
                EventSource: 'readonly',
                FileReader: 'readonly',
                encodeURI: 'readonly',
                globalThis: 'readonly',
                module: 'writable'
            }
        },
        rules: {
            'no-undef': 'error',
            'no-unused-vars': ['warn', { args: 'none' }],
            'no-redeclare': 'error',
            eqeqeq: 'warn'
        }
    },
    {
        files: ['tests/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                require: 'readonly',
                module: 'writable',
                __dirname: 'readonly',
                console: 'readonly',
                process: 'readonly'
            }
        },
        rules: {
            'no-undef': 'error',
            'no-unused-vars': ['warn', { args: 'none' }],
            eqeqeq: 'warn'
        }
    }
];
