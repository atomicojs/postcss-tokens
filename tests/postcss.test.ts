import { test } from "uvu";
import * as assert from "uvu/assert";
import postcss from "postcss";
import postcssTokens from "../src/postcss-tokens";
import { readFile, writeFile } from "fs/promises";

test("result host, with root", async () => {
    const result = await postcss([postcssTokens()]).process(
        `@tokens "./tokens.json" prefix(my-ds) scope(:root);`,
        {
            from: "./tests/demo.css",
        }
    );
    // await writeFile("./tests/expect-root-from-json.css", result.css);
    assert.is(
        result.css,
        await readFile("./tests/expect-root-from-json.css", "utf8")
    );
});

test("result file yaml", async () => {
    const result = await postcss([postcssTokens()]).process(
        `
        @tokens "./tokens.yaml" scope(:root) prefix(my-ds);
        `,
        {
            from: "./tests/demo.css",
        }
    );

    // await writeFile("./tests/expect-root.css", result.css);
    assert.is(result.css, await readFile("./tests/expect-root.css", "utf8"));
});

test("result file yaml", async () => {
    const result = await postcss([postcssTokens()]).process(
        `
        @tokens "./tokens.yaml" prefix(my-ds);
        `,
        {
            from: "./tests/demo.css",
        }
    );

    // await writeFile("./tests/expect-host.css", result.css);
    assert.is(result.css, await readFile("./tests/expect-host.css", "utf8"));
});

test("result file yaml", async () => {
    const result = await postcss([postcssTokens()]).process(
        `
        @tokens "./tokens.yaml" prefix(my-ds) filter(font-border);
        `,
        {
            from: "./tests/demo.css",
        }
    );

    // await writeFile("./tests/expect-filter.css", result.css);
    assert.is(result.css, await readFile("./tests/expect-filter.css", "utf8"));
});

test.run();
