import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import json from "@rollup/plugin-json";
import typescript from "@rollup/plugin-typescript";

const config = {
    input: "src/index.ts",
    output: {
        esModule: true,
        file: "dist/index.js",
        format: "es",
        sourcemap: true,
    },
    plugins: [
        nodeResolve({ preferBuiltins: true }),
        commonjs(),
        json(),
        typescript({
            tsconfig: false,       // ignore tsconfig.json completely
            declaration: false,    // don’t generate .d.ts
            declarationMap: false, // don’t generate .d.ts map
            target: 'ESNext'       // set JS output target
        })    ],
};

export default config;