module.exports = {
    root: true,
    parserOptions: {
        sourceType: 'module',
        ecmaVersion: 2017,
    },
    env: {
        browser: true,
    },
    extends: 'airbnb-base',
    rules: {
        'no-debugger': process.env.NODE_ENV === 'production' ? 2 : 0,
        indent: ['error', 4],
        camelcase: 0,
        'no-alert': 0,
        'no-console': 0,
        'linebreak-style': [0, 'windows'],
        'no-underscore-dangle': 0,
        'no-param-reassign': 0,
        'max-len': 0,
        'no-plusplus': 0,
        'arrow-body-style': 0,
        'global-require': 0,
        'import/no-dynamic-require': 0,
    },
    globals: {
        window: true,
        describe: true,
        it: true,
        before: true,
        after: true,
        browser: true,
    },
};
