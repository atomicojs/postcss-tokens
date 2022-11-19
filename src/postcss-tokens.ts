import path from "path";
import postcss, { PluginCreator, AtRule, rule } from "postcss";
import { load } from "./load";
import { transform } from "./transform";
import { objectToCssProps, cssRule, cleanQuote } from "./utils";

interface Import {
    prefix?: string;
    root: string;
    from: string;
    filter?: string;
    import?: string;
    default?: boolean;
    variation?: string;
    wrapper?: boolean;
}

interface Options {
    prefix?: string;
    defaultValue?: boolean;
    load?: (file: string, from: string) => Promise<any>;
}

async function replace(atRule: AtRule, { load, ...rootOptions }: Options) {
    const file = atRule.source.input.file;
    const test = atRule.params.match(/(?:"([^"]+)"|'([^']+)')\s*(.+){0,1}/);
    if (!test) return;

    let [, quote1, quote2, params = ""] = test;
    const from = quote1 || quote2;
    const options = /\(\s*([^:\s]+)\s*:\s*([^\s)]+)\s*\)/;

    const config: Import = {
        ...rootOptions,
        default: rootOptions.defaultValue,
        root: ":host",
        from,
    };

    let subtest: RegExpMatchArray;

    while ((subtest = params.match(options))) {
        const [all, index, value] = subtest;
        params = params.replace(all, "");
        const nextValue = cleanQuote(value);
        const lastValue = nextValue === "true" ? true : nextValue;

        config[index] = lastValue;
    }

    atRule.walkDecls(({ prop, value }) => {
        config[prop] = value;
    });

    if (!config.prefix) return;

    if (!config.filter && config.import) config.filter = config.import;

    const dirname = path.dirname(file);

    const data = await load(path.join(dirname, config.from), file);

    const tokens = transform({
        data,
        prefix: config.prefix,
        root: config.root,
        withDefault: config.default,
    });

    const rootRules: string[] = [];
    const rules: string[] = [];

    for (const prop in tokens) {
        if (config.root === ":host") {
            const selector = prop === ":host" ? prop : `:host(${prop})`;
            rules.push(
                cssRule(
                    selector,
                    objectToCssProps(tokens[prop], {
                        prefix: "    --",
                        filter: config.filter,
                        import: config.import,
                    })
                )
            );
        } else {
            rootRules.push(objectToCssProps(tokens[prop]));
        }
    }

    atRule.replaceWith(
        (rootRules.length
            ? [cssRule(config.root, rootRules.join(";\n"))]
            : rules
        ).map(postcss.parse as any)
    );
}

const postcssTokens: PluginCreator<Options> = (options: Options) => ({
    postcssPlugin: "@atomico/postcss-tokens",
    AtRule: {
        tokens: (atRule) =>
            replace(atRule, {
                ...options,
                async load(file, from) {
                    let data: any;
                    if (options?.load) {
                        data = await options.load(file, from);
                    }
                    return data ? data : load(file);
                },
            }),
    },
});

postcssTokens.postcss = true;

export default postcssTokens;
