import path from "path";
import postcss, { PluginCreator, AtRule } from "postcss";
import { load } from "./load";

const REG_VARIATION = /(\.){0,1}(\w+)=(\w+|"[\w+-]+")/;

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

let currentRoot: { [prop: string]: string };

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

    const tokens = await load(path.join(dirname, config.from), file);

    const rootTokens = filterTokens(mapTokens(tokens, config), config.filter);

    if (config.root === ":root") {
        currentRoot = rootTokens;
    }

    const rules: string[] = [];

    let { root, ...variations } = customProperties(rootTokens, config);

    rules.push(cssRule(`${config.root}`, root));

    for (let prop in variations) {
        rules.push(
            cssRule(
                `${config.root}${config.root === ":host" ? `(${prop})` : prop}`,
                variations[prop]
            )
        );
    }

    atRule.replaceWith(rules.map(postcss.parse as any));
}

const postcssTokens: PluginCreator<Options> = (options: Options) => ({
    postcssPlugin: "@atomico/postcss-tokens",
    AtRule: {
        tokens: (atRule) => {
            if (options?.prefix && atRule.parent.type === "rule") {
                let tokens = currentRoot
                    ? filterTokens(
                          currentRoot,
                          atRule.params.replace(/\s+/g, "")
                      )
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
                    }).root.join(";\n")
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

const dotToDash = (value: string) =>
    value.replace(/^\./, "").replace(/\./g, `-`);

const cleanQuote = (value: string) => value.replace(/^("|')(.+)("|')$/g, "$2");

function mapTokens(tokens: any, config: Import, root = {}, parent?: string) {
    for (let prop in tokens) {
        const value = tokens[prop];

        prop = prop === "=" ? "" : prop;

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

    let regExp = RegExp(
        `^(${mod.reduce(
            (filter, [reg, replace]) => filter.replace(reg, replace),
            filter.replace(/\s+/g, "")
        )})`
    );

    for (let prop in tokens) {
        if (regExp.test(prop.replace(REG_VARIATION, "").replace(/^\./, ""))) {
            nextTokens[prop] = tokens[prop];
        }
    }

    return nextTokens;
}

function customProperties(
    tokens: any,
    config: Import,
    rules: {
        [prop: string]: string[];
    } = {
        root: [],
    }
) {
    let isHost = config.root === ":host" ? true : false;
    let regImport = config.import
        ? RegExp(`^--${config.import}.`.replace(/\./g, "\\-"))
        : "";

    for (let prop in tokens) {
        const value = tokens[prop];

        let variation = "root";
        let cssPropProxy = "";

        prop = prop.replace(REG_VARIATION, (all, dot = "", name, value) => {
            value = value.replace(/"|'/g, "");
            const isTrue = value === "true";
            cssPropProxy = "--" + name + (isTrue ? "" : "-" + value);
            if (isHost) {
                variation = `[${name}${value === "true" ? "" : `=${value}`}]`;
            }
            return "";
        });

        if (!rules[variation]) rules[variation] = [];

        let cssProp = `--` + dotToDash(prop);

        if (config.wrapper) {
            rules[variation].push(
                `${cssProp}: var(--${config.prefix}${cssProp})`
            );
            continue;
        }

        const cssValue = (value + "").replace(
            /(@|\$\$|\$)([\w\.]+)/g,
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
            isHost && value === cssValue && !config.wrapper
                ? `var(--${config.prefix}${cssProp}${cssPropProxy}${
                      config.default ? `, ${cssValue}` : ""
                  })`
                : cssValue;

        rules[variation].push(
            `${
                isHost
                    ? regImport
                        ? cssProp.replace(regImport, "--")
                        : cssProp
                    : `--${config.prefix}${cssProp}${cssPropProxy}`
            }: ${refCssProp}`
        );
    }

    return rules;
}

export default postcssTokens;
