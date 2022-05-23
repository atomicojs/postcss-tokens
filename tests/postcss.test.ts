import { test } from "uvu";
import * as assert from "uvu/assert";
import postcss from "postcss";
import postcssTokens from "../src/postcss-tokens";
import { readFile, writeFile } from "fs/promises";

test("result host", async () => {
    const result = await postcss([postcssTokens()]).process(
        `@tokens "./tokens.json" ( prefix: "my-dsprefix" );`,
        {
            from: "./tests/demo.css",
        }
    );

    // await writeFile("./tests/expect-host.txt", result.css);
    assert.is(result.css, await readFile("./tests/expect-host.txt", "utf8"));
});

test("result host", async () => {
    const result = await postcss([postcssTokens()]).process(
        `@tokens "./tokens.json" ( prefix: my-dsprefix ) and (root: ":root");`,
        {
            from: "./tests/demo.css",
        }
    );
    // await writeFile("./tests/expect-root.txt", result.css);
    assert.is(result.css, await readFile("./tests/expect-root.txt", "utf8"));
});

test("result host", async () => {
    const result = await postcss([
        postcssTokens({ prefix: "my-dsprefix" }),
    ]).process(`@tokens "./tokens.json" (use: "size|font|color.primary");`, {
        from: "./tests/demo.css",
    });

    assert.is(result.css, await readFile("./tests/expect-use.txt", "utf8"));
});

test("result file yaml", async () => {
    const result = await postcss([
        postcssTokens({ prefix: "my-dsprefix" }),
    ]).process(`@tokens "./tokens.yaml" (use: "size|font|color.primary");`, {
        from: "./tests/demo.css",
    });

    assert.is(result.css, await readFile("./tests/expect-use.txt", "utf8"));
});

test.run();
