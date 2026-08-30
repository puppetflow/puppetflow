import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
    publicDir: false,
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'resources/js'),
            '@proprietary': path.resolve(__dirname, 'proprietary/resources/js'),
        },
    },
    build: {
        target: 'node20',
        outDir: 'bootstrap/nodal-compiler',
        emptyOutDir: true,
        minify: false,
        ssr: true,
        rollupOptions: {
            input: {
                compiler: path.resolve(__dirname, 'scripts/nodal-compiler.ts'),
                'catalog-generator': path.resolve(__dirname, 'scripts/nodal-catalog.ts'),
            },
            output: {
                format: 'es',
                entryFileNames: '[name].mjs',
            },
        },
    },
});
