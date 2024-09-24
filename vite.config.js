import { defineConfig } from 'vite'
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer';

export default defineConfig({
    base: '/vu_graphics/',
    plugins: [
        ViteImageOptimizer({
            /* pass your config */
        }),
    ],
})