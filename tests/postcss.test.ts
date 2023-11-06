import { test } from "uvu";
import * as assert from "uvu/assert";
import postcss from "postcss";
import postcssTokens from "../src/postcss-tokens";
import { readFile, writeFile } from "fs/promises";

test("result import", async () => {
    const result = await postcss([
        postcssTokens({ prefix: "my-dsprefix" }),
    ]).process(`@tokens "./tokens.json" use(font);`, {
        from: "./tests/demo.css",
    });

    await writeFile("./tests/expect-import.css", result.css);
    assert.is(result.css, await readFile("./tests/expect-import.css", "utf8"));
});

test("result host, with root", async () => {
    const result = await postcss([postcssTokens()]).process(
        `@tokens "./tokens.json" prefix(my-ds) scope(:root);`,
        {
            from: "./tests/demo.css",
        }
    );
    await writeFile("./tests/expect-root.css", result.css);
    assert.is(result.css, await readFile("./tests/expect-root.css", "utf8"));
});

test("result file yaml", async () => {
    const result = await postcss([postcssTokens()]).process(
        `
        @tokens "./tokens.yaml" scope(:root);
        @tokens "./tokens.yaml" prefix(my-ds);
        `,
        {
            from: "./tests/demo.css",
        }
    );

    await writeFile("./tests/expect-use-default.css", result.css);
    assert.is(
        result.css,
        await readFile("./tests/expect-use-default.css", "utf8")
    );
});

test.run();
