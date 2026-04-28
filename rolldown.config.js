import {defineConfig} from 'rolldown';

export default defineConfig([
    {
        input: 'index.js',
        output: {
            file: 'dist/geobuf.js',
            format: 'umd',
            name: 'geobuf',
            minify: true
        }
    },
    {
        input: 'index.js',
        output: {
            file: 'dist/geobuf-dev.js',
            format: 'umd',
            name: 'geobuf',
            sourcemap: true
        }
    }
]);
