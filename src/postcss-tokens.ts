import path from "path";
import { readFile } from "fs/promises";
import postcss, { PluginCreator } from "postcss";

interface Import {
    prefix?: string;
    root: string;
    from: string;
    default?: boolean;
    variation?: boolean;
}

const postcssTokens: PluginCreator<any> = () => ({
    postcssPlugin: "@atomico/postcss-tokens",
    AtRule: {
        import: async (AtRule) => {
            const file = AtRule.source.input.file;
            const test = AtRule.params.match(/(?:"([^"]+)"|'([^']+)')\s+(.+)/);
            if (!test) return;

            let [, quote1, quote2, params] = test;
            const from = quote1 || quote2;
            const options = /\(\s*([^:\s]+)\s*:\s*([^)\s]+)\s*\)/;
            const config: Import = {
                root: ":host",
                from,
                default: true,
            };

            let subtest: RegExpMatchArray;

            while ((subtest = params.match(options))) {
                const [all, index, value] = subtest;
                params = params.replace(all, "");
                config[index] = value;
            }

            if (!config.prefix) return;

            config.root = config.root.replace(/^("|')(.+)("|')$/g, "$2");
            const dirname = path.dirname(file);
            const { variation, ...tokens } = JSON.parse(
                await readFile(path.join(dirname, config.from), "utf8")
            );

            const rootTokens = mapTokens(tokens, config);
            const rules: string[] = [];
            let cssProps = customProperties(rootTokens, config);
            let isHost = config.root === ":host" ? true : false;

            for (let prop in variation) {
                const value = variation[prop];
                const prefixVariation = prop.replace(/[^\w]+/g, "-");
                const variationTokens = mapTokens(value, config);
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

            AtRule.replaceWith(rules.map(postcss.parse as any));
        },
    },
});

postcssTokens.postcss = true;

const cssRule = (selector: string, cssProps: string[]) =>
    `\n${selector}{\n${cssProps
        .map((cssProp) => `   ${cssProp}`)
        .join(";\n")}\n}`;

const dotToDash = (value: string) => value.replace(/\./g, `-`);

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

function customProperties(tokens: any, config: Import, css: string[] = []) {
    let isHost = config.root === ":host" ? true : false;

    for (let prop in tokens) {
        let cssProp = `--` + dotToDash(prop);

        const cssValue = tokens[prop].replace(
            /@([\w\.]+)/g,
            (all, prop: string) => {
                const cssValue = `--${dotToDash(prop)}`;
                return isHost
                    ? `var(${cssValue})`
                    : `var(--${config.prefix}${cssValue})`;
            }
        );

        const refCssProp =
            isHost && tokens[prop] === cssValue
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
