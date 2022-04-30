import { test } from "uvu";
import * as assert from "uvu/assert";
import postcss from "postcss";
import { pluginPostcss } from "../src/postcss-tokens";
import { readFile, writeFile } from "fs/promises";

test("result host", async () => {
    const result = await postcss([pluginPostcss()]).process(
        `@import "./tokens.json" ( prefix: my-dsprefix );`,
        {
            from: "./tests",
        }
    );

    // await writeFile("./tests/expect-host.txt", result.css);
    assert.is(result.css, await readFile("./tests/expect-host.txt", "utf8"));
});

test("result host", async () => {
    const result = await postcss([pluginPostcss()]).process(
        `@import "./tokens.json" ( prefix: my-dsprefix ) and (root: ":root");`,
        {
            from: "./tests",
        }
    );
    // await writeFile("./tests/expect-root.txt", result.css);
    assert.is(result.css, await readFile("./tests/expect-root.txt", "utf8"));
});

test.run();
