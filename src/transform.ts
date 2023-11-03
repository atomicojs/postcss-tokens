export interface Options {
    scope?: string;
    prefix?: string;
    use?: string;
    filter?: string;
}

interface Data {
    [prop: string]: any;
}

interface CustomProperties {
    [prop: string]: {
        value: string;
        props: string[];
        attrs: string[];
        alias: string[];
    };
}

interface Rules {
    [selector: string]: { [prop: string]: string };
}

export const Alias = {
    "<": "greater-than",
    ">": "less-than",
    "=": "is",
    "!=": "is-not",
    "|": "or",
    "&": "and",
};

export const transform = (data: Data, options: Options) => {
    const customProperties = createCustomProperties(data);
    const rules: Rules = {};
    const search = options.use || options.filter;
    const regExp = search ? RegExp(`^(${search})(-){0,}`) : null;
    const prefix = `--${options.prefix ? `${options.prefix}--` : ""}`;

    for (const prop in customProperties) {
        const { value, attrs, props } = customProperties[prop];
        const [selector, selectorAttrs] =
            options.scope === ":root"
                ? [options.scope, []]
                : getSelector(attrs, options.scope);

        if (regExp && !regExp.test(prop)) continue;

        const nextProp = regExp ? prop.replace(regExp, "") : prop;

        if (!nextProp) continue;

        rules[selector] = rules[selector] || {};

        const nextValue = value.replace(
            /([\$]+){1,2}([\w\-]+)/g,
            (_: string, type: string, variable: string) => {
                const inRoot = customProperties[variable];
                return type === "$" && inRoot && options.scope != ":root"
                    ? `var(--${variable.replace(regExp, "")})`
                    : `var(${prefix}${variable})`;
            }
        );

        if (options.scope === ":root") {
            rules[selector][`${prefix}${prop}`] =
                nextValue != value ? nextValue : value;
        } else {
            const isHostContext = selector.startsWith(":host-context");
            if (isHostContext) {
                const nextProp = selectorAttrs
                    .map((value) =>
                        value.replace(/\[/g, "(").replace(/\]/g, ")")
                    )
                    .map(customPropertyToHumanName)
                    .reduce(
                        (prop, value) => prop.replace(`--${value}`, ""),
                        prop
                    );

                rules[selector][`${prefix}${nextProp}`] =
                    nextValue != value ? nextValue : `var(${prefix}${prop})`;
            } else {
                rules[selector][`--${props.join("-").replace(regExp, "")}`] =
                    nextValue != value ? nextValue : `var(${prefix}${prop})`;
            }
        }
    }

    return objectToCss(rules);
};

export const objectToCss = (rules: Rules): string => {
    let css = "";
    for (const selector in rules) {
        let props = "";
        for (const prop in rules[selector]) {
            props += `${prop}:${rules[selector][prop]};`;
        }
        if (props) css += `${selector}{${props}}`;
    }
    return css;
};

/**
 * returns a selector expression in array format
 * @example
 * getTokens("(theme=dark)");
 * //output: [["theme","=","dark"]]
 *
 * getTokens("(theme=dark) | (theme!=light)");
 * //output: [["theme","=","dark"], "|", ["theme","!=","light"]]
 */
const getTokens = (value: string) => {
    value = value + " ";
    let currentValue = "";
    const tokens = [];
    for (let i = 0; i < value.length; i++) {
        switch (value[i]) {
            case "=":
            case "(":
            case ")":
            case ">":
            case "<":
            case ":":
            case "|":
            case "!":
                if (currentValue) tokens.push(currentValue);
                currentValue = "";
                if (value[i] === "!" && value[i + 1] === "=") {
                    tokens.push("!=");
                    i++;
                    break;
                }
                tokens.push(value[i]);
                break;
            case " ":
                if (currentValue) tokens.push(currentValue);
                currentValue = "";
                break;
            default:
                currentValue += value[i];
                break;
        }
    }

    const list = tokens.map((value) =>
        value === "("
            ? "["
            : value === ")"
            ? "]"
            : value.startsWith('"')
            ? value
            : `"${value}"`
    );

    return JSON.parse(
        `[${list.join(",").replace(/\[,/g, "[").replace(/,\]/g, "]")}]`
    );
};

const customPropertyToHumanName = (name: string) => {
    if (name === "=") return "";

    const [first, ...tokens] = getTokens(name);

    if (!Array.isArray(first)) return first;

    return [first.length > 1 ? first : ["=", first], tokens]
        .flat(10)
        .map((value) => {
            value = value.replace(/^(@|\^)/, "");
            return value in Alias ? Alias[value] : value;
        })
        .join("-");
};

const createCustomProperties = (
    data: Data,
    customProperties: CustomProperties = {},
    currentAttrs: string[] = [],
    currentProps: string[] = [],
    currentAlias: string[] = []
) => {
    for (const prop in data) {
        const value = data[prop];
        const alia = customPropertyToHumanName(prop);

        const [attrs, props, alias] =
            prop === "="
                ? [currentAttrs, currentProps, currentAlias]
                : prop != alia
                ? [
                      [...currentAttrs, prop],
                      currentProps,
                      [...currentAlias, alia],
                  ]
                : [currentAttrs, [...currentProps, prop], currentAlias];

        if (typeof value === "object") {
            createCustomProperties(
                value,
                customProperties,
                attrs,
                props,
                alias
            );
        } else {
            const id =
                props.join("-") + (alias.length ? "--" + alias.join("--") : "");

            customProperties[id] = {
                value: value.toString(),
                attrs,
                props,
                alias,
            };
        }
    }
    return customProperties;
};

function getSelector(
    attrs: string[],
    scope: string = ":host"
): [string, string[]] {
    const nextAttrs = attrs.map(getTokens).flat(1);

    const onlyHostContext = nextAttrs.filter(([attr]: string[]) =>
        attr.startsWith("^")
    );

    scope = onlyHostContext.length ? ":host-context" : scope;

    const selector = (onlyHostContext.length ? onlyHostContext : nextAttrs).map(
        ([attr, exp, value]) => {
            if (attr.startsWith("^")) {
                attr = attr.slice(1);
            }
            return exp === "!="
                ? `:not([${attr}="${value}"])`
                : `[${attr}${exp ? `${exp}"${value}"` : ""}]`;
        }
    );

    return [
        `${scope}${
            scope.startsWith(":host") && selector.length
                ? `(${selector.join("")})`
                : `${selector.join("")}`
        }`,
        selector,
    ];
}

// const data = {
//     size: {
//         1: "1rem",
//         2: "2rem",
//         3: "3rem",
//     },
//     color: {
//         primary: 1,
//         "(checked)": {
//             primary: {
//                 "=": "100",
//                 contrast: "-110",
//                 "(contrast!=false)": {
//                     "=": 200,
//                     contrast: {
//                         "=": "-100",
//                         border: "tomato",
//                     },
//                 },
//             },
//         },
//         "(^theme=dark)": {
//             primary: 2,
//         },
//     },
//     button: {
//         border: {
//             "=": "$button-border-size solid $button-border-color",
//             color: "tomato",
//             size: "$$size-1",
//             "(checked)": {
//                 color: "red",
//                 "(show)": {
//                     color: "black",
//                     "(theme!=primary)": {
//                         color: "magenta",
//                     },
//                 },
//             },
//         },
//     },
// };

// console.log(
//     transform(data, {
//         scope: ":host",
//         prefix: "my-ds",
//     })
// );
