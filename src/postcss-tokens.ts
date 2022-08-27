import path from "path";
import postcss, { PluginCreator, AtRule, Declaration, decl } from "postcss";
import { load } from "./load";

interface Import {
    prefix?: string;
    root: string;
    from: string;
    use?: string;
    default?: boolean;
    variation?: boolean;
    wrapper?: boolean;
}

interface Options {
    prefix?: string;
    load?: (file: string, from: string) => Promise<any>;
}

let currentRoot: { [prop: string]: string };

async function replace(atRule: AtRule, { load, ...rootOptions }: Options) {
    const file = atRule.source.input.file;
    const test = atRule.params.match(/(?:"([^"]+)"|'([^']+)')\s+(.+)/);
    if (!test) return;

    let [, quote1, quote2, params] = test;
    const from = quote1 || quote2;
    const options = /\(\s*([^:\s]+)\s*:\s*([^)]+)\s*\)/;

    const config: Import = {
        ...rootOptions,
        root: ":host",
        from,
        default: true,
    };

    let subtest: RegExpMatchArray;

    while ((subtest = params.match(options))) {
        const [all, index, value] = subtest;
        params = params.replace(all, "");
        const nextValue = cleanQuote(value);
        const lastValue = nextValue === "true" ? true : nextValue;

        config[index] = lastValue;
    }

    if (!config.prefix) return;

    const dirname = path.dirname(file);

    const { variation, ...tokens } = await load(
        path.join(dirname, config.from),
        file
    );

    const rootTokens = filterTokens(mapTokens(tokens, config), config.use);

    if (config.root === ":root") {
        currentRoot = rootTokens;
    }

    const rules: string[] = [];
    let cssProps = customProperties(rootTokens, config);
    let isHost = config.root === ":host" ? true : false;

    for (let prop in variation) {
        const value = variation[prop];
        const prefixVariation = prop.replace(/[^\w]+/g, "-");
        const variationTokens = filterTokens(
            mapTokens(value, config),
            config.use
        );

        if (isHost) {
            rules.push(
                cssRule(
                    `:host([${prop}])`,
                    customProperties(variationTokens, {
                        ...config,
                        variation: true,
                    })
                )
            );
        } else {
            customProperties(
                variationTokens,
                {
                    ...config,
                    prefix: config.prefix + `-` + prefixVariation,
                },
                cssProps
            );
        }
    }

    rules.unshift(cssRule(`${config.root}`, cssProps));

    atRule.replaceWith(rules.map(postcss.parse as any));
}

const postcssTokens: PluginCreator<Options> = (options: Options) => ({
    postcssPlugin: "@atomico/postcss-tokens",
    AtRule: {
        tokens: (atRule) => {
            if (options?.prefix && atRule.parent.type === "rule") {
                let tokens = currentRoot
                    ? filterTokens(currentRoot, atRule.params)
                    : atRule.params
                          .split(",")
                          .map((value) => value.trim())
                          .reduce((decl, prop) => {
                              decl[prop] = `$${prop}`;
                              return decl;
                          }, {});

                const decl = postcss.parse(
                    customProperties(tokens, {
                        root: ":host",
                        prefix: options.prefix,
                        from: "",
                        wrapper: true,
                    }).join(";\n")
                );

                atRule.replaceWith(decl);
            } else {
                return replace(atRule, {
                    ...options,
                    async load(file, from) {
                        let data: any;
                        if (options?.load) {
                            data = await options.load(file, from);
                        }
                        return data ? data : load(file);
                    },
                });
            }
        },
    },
});

postcssTokens.postcss = true;

const cssRule = (selector: string, cssProps: string[]) =>
    `\n${selector}{\n${cssProps
        .map((cssProp) => `   ${cssProp}`)
        .join(";\n")}\n}`;

const dotToDash = (value: string) => value.replace(/\./g, `-`);

const cleanQuote = (value: string) => value.replace(/^("|')(.+)("|')$/g, "$2");

function mapTokens(tokens: any, config: Import, root = {}, parent?: string) {
    for (let prop in tokens) {
        const value = tokens[prop];
        let parentProp = (parent ? parent + (prop ? "." : "") : "") + prop;
        if (typeof value === "object") {
            mapTokens(value, config, root, parentProp);
        } else {
            root[parentProp] = value;
        }
    }
    return root;
}

function filterTokens(tokens: any, filter: string) {
    if (!filter) return tokens;
    let nextTokens = {};
    const mod: [RegExp, string][] = [
        [/\s/g, ""],
        [/\{/g, "("],
        [/\}/g, ")"],
        [/\,/g, "|"],
        [/\./g, "\\."],
    ];

    let regtExp = RegExp(
        `^(${mod.reduce(
            (filter, [reg, replace]) => filter.replace(reg, replace),
            filter.replace(/\s+/g, "")
        )})`
    );

    for (let prop in tokens) {
        if (regtExp.test(prop)) {
            nextTokens[prop] = tokens[prop];
        }
    }

    return nextTokens;
}

function customProperties(tokens: any, config: Import, css: string[] = []) {
    let isHost = config.root === ":host" ? true : false;

    for (let prop in tokens) {
        let cssProp = `--` + dotToDash(prop);

        if (config.wrapper) {
            css.push(`${cssProp}: var(--${config.prefix}${cssProp})`);
            continue;
        }

        const cssValue = (tokens[prop] + "").replace(
            /(@|\$)([\w\.]+)/g,
            (all, type: string, prop: string) => {
                const cssValue = `--${dotToDash(prop)}`;
                const cssVar = isHost
                    ? `var(${cssValue})`
                    : `var(--${config.prefix}${cssValue})`;
                return type === "$"
                    ? `var(--${config.prefix}${cssProp}, ${cssVar})`
                    : cssVar;
            }
        );

        const refCssProp =
            isHost && tokens[prop] === cssValue && !config.wrapper
                ? `var(--${config.prefix}${cssProp}${
                      config.default ? `, ${cssValue}` : ""
                  })`
                : cssValue;

        css.push(
            `${
                isHost ? cssProp : `--${config.prefix}${cssProp}`
            }: ${refCssProp}`
        );
    }

    return css;
}

export default postcssTokens;
