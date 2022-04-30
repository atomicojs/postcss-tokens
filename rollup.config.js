import esbuild from "rollup-plugin-esbuild";

export default {
    input: ["./src/postcss-tokens.ts"],
    output: [
        {
            file: "dist/postcss-tokens.cjs",
            format: "cjs",
        },
        {
            file: "dist/postcss-tokens.mjs",
            format: "esm",
        },
    ],
    plugins: [esbuild({ target: "esnext" })],
};
