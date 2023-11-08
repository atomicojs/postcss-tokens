import path from "path";
import { AtRule, PluginCreator } from "postcss";
import { load } from "./load";
import { Options as OptionsTransform, transform } from "./transform";
import postcss from "postcss";
import { parse } from "./parse";
interface Options extends OptionsTransform {
    load?: (file: string, from: string) => Promise<any>;
}

async function replace(atRule: AtRule, { load, ...rootOptions }: Options) {
    const file = atRule.source.input.file;
    const test = atRule.params.match(/(?:"([^"]+)"|'([^']+)')\s*(.+){0,1}/);

    if (!test) return;

    let [, source, , attrs = ""] = test;

    const options = {
        ...rootOptions,
    };

    parse(attrs).forEach(({ type, value }) => {
        if (type === "operator") {
            options[value] = true;
        } else {
            options[type] = value;
        }
    });

    const dirname = path.dirname(file);

    const data = await load(path.join(dirname, source), file);

    const rules = transform(data, options);

    atRule.replaceWith(postcss.parse(rules));
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
