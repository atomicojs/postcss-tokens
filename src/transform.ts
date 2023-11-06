import { parse } from "./parse";
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

const customPropertyToHumanName = (name: string) => {
    if (name === "=") return "";

    const tokens = parse(name);

    if (tokens?.[0]?.type === "operator") return tokens?.[0]?.value;

    return tokens
        .map(({ parts: [attr, operator = "=", value] }) => {
            const alias = Alias[operator] || "";
            return value ? [attr, alias, value] : [alias, attr];
        })
        .flat(1)
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
    const nextAttrs = attrs.map(parse).flat(1);

    const onlyHostContext = nextAttrs.filter((ref) => ref.type === "context");

    scope = onlyHostContext.length ? ":host-context" : scope;

    const selector = (onlyHostContext.length ? onlyHostContext : nextAttrs)
        .sort(({ parts: [attr1] }, { parts: [attr2] }) =>
            attr1 > attr2 ? 1 : attr1 < attr2 ? -1 : 0
        )
        .map(({ parts: [attr, operator, value] }) =>
            operator === "!="
                ? `:not([${attr}=${value}])`
                : `[${attr}${operator ? `${operator}${value}` : ""}]`
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
