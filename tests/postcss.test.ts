import { test } from "uvu";
import * as assert from "uvu/assert";
import postcss from "postcss";
import postcssTokens from "../src/postcss-tokens";
import { readFile, writeFile } from "fs/promises";

// test("result autoprefix", async () => {
//     const result = await postcss([
//         postcssTokens({
//             prefix: "my-dsprefix",
//         }),
//     ]).process(
//         `
//         :host{
//             @tokens color.primary, font;
//             color: var(--color-title);
//         }
//     `,
//         {
//             from: "./tests/demo.css",
//         }
//     );

//     // writeFile("./tests/expect-rule.txt", result.css);
//     assert.is(result.css, await readFile("./tests/expect-rule.txt", "utf8"));
// });

// test("result import", async () => {
//     const result = await postcss([
//         postcssTokens({ prefix: "my-dsprefix" }),
//     ]).process(`@tokens "./tokens.json" (import:font);`, {
//         from: "./tests/demo.css",
//     });

//     // writeFile("./tests/expect-import.txt", result.css);
//     assert.is(result.css, await readFile("./tests/expect-import.txt", "utf8"));
// });

// test("result host", async () => {
//     const result = await postcss([postcssTokens()]).process(
//         `@tokens "./tokens.json" ( prefix: "my-dsprefix" );`,
//         {
//             from: "./tests/demo.css",
//         }
//     );

//     // await writeFile("./tests/expect-host.txt", result.css);
//     assert.is(result.css, await readFile("./tests/expect-host.txt", "utf8"));
// });

// test("result host", async () => {
//     const result = await postcss([postcssTokens()]).process(
//         `@tokens "./tokens.json" ( prefix: my-dsprefix ) and (root: ":root");`,
//         {
//             from: "./tests/demo.css",
//         }
//     );
//     //await writeFile("./tests/expect-root.txt", result.css);
//     assert.is(result.css, await readFile("./tests/expect-root.txt", "utf8"));
// });

// test("result host", async () => {
//     const result = await postcss([
//         postcssTokens({ prefix: "my-dsprefix" }),
//     ]).process(`@tokens "./tokens.json" (filter: "size|font|color.primary");`, {
//         from: "./tests/demo.css",
//     });

//     // await writeFile("./tests/expect-use.txt", result.css);

//     assert.is(result.css, await readFile("./tests/expect-use.txt", "utf8"));
// });

// test("result file yaml", async () => {
//     const result = await postcss([
//         postcssTokens({ prefix: "my-dsprefix", defaultValue: true }),
//     ]).process(`@tokens "./tokens.yaml";`, {
//         from: "./tests/demo.css",
//     });

//     // await writeFile("./tests/expect-use-default.txt", result.css);
//     assert.is(
//         result.css,
//         await readFile("./tests/expect-use-default.txt", "utf8")
//     );
// });

// test("new import", async () => {
//     const result = await postcss([
//         postcssTokens({ prefix: "my-dsprefix", defaultValue: true }),
//     ]).process(
//         `
//         @tokens "./tokens.yaml" {
//             filter: size , font, color.primary;
//             import: size , font, color.primary;
//         };
//     `,
//         {
//             from: "./tests/demo.css",
//         }
//     );
// });

test("result file 2 yaml", async () => {
    const result = await postcss([
        postcssTokens({ prefix: "my-dsprefix", defaultValue: true }),
    ]).process(`@tokens "./tokens-2.yaml" (filter: generic);`, {
        from: "./tests/demo.css",
    });

    await writeFile("./tests/expect-tokens-2.txt", result.css);
    // assert.is(
    //     result.css,
    //     await readFile("./tests/expect-tokens-2.txt", "utf8")
    // );
});

// test("result file tokens-3.yaml (:host)", async () => {
//     const result = await postcss([
//         postcssTokens({ prefix: "my-dsprefix", defaultValue: true }),
//     ]).process(`@tokens "./tokens-3.yaml";`, {
//         from: "./tests/demo.css",
//     });

//     await writeFile("./tests/expect-tokens-host-3.txt", result.css);

//     console.log(result);
// });

// test("result file tokens-3.yaml (:root)", async () => {
//     const result = await postcss([
//         postcssTokens({ prefix: "my-dsprefix", defaultValue: true }),
//     ]).process(`@tokens "./tokens-3.yaml" (root:":root");`, {
//         from: "./tests/demo.css",
//     });

//     await writeFile("./tests/expect-tokens-root-3.txt", result.css);

//     console.log(result);
// });

test.run();
