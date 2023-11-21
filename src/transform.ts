import { parse } from "./parse";
export interface Options {
    scope?: string;
    prefix?: string;
    use?: string;
    filter?: string;
    bind?: boolean;
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
    [selector: string]: { [prop: string]: any };
}

export const Alias = {
    "<": "greater-than",
    ">": "less-than",
    "=": "is",
    "!=": "is-not",
    "|": "or",
    "&": "and",
    "slot=*": "any-slot",
};

export const transform = (data: Data, options: Options) => {
    const customProperties = createCustomProperties(data);
    const rules: Rules = {};
    const search = options.use || options.filter;
    const regExp = search ? RegExp(`^(${search})(-){0,}`) : null;
    const prefix = `--${options.prefix ? `${options.prefix}--` : ""}`;

    return objectToCss(
        mapTransform(customProperties, options, rules, regExp, prefix, true)
    );
};

const mapTransform = (
    customProperties: CustomProperties,
    options: Options,
    rules: Rules,
    regExp: RegExp,
    prefix: string,
    isParent: boolean,
    parentPrefix = "",
    parentSuffix = ""
) => {
    for (const prop in customProperties) {
        const { value, attrs, props } = customProperties[prop];
        const [selector, selectorAttrs, excludeAttrs] =
            options.scope === ":root"
                ? [options.scope, []]
                : getSelector(attrs, options.scope);

        if (regExp && !regExp.test(prop)) continue;

        const token = regExp && options.use ? prop.replace(regExp, "") : prop;
        const currentRegExp = options.use ? regExp : null;

        if (!token) continue;

        rules[selector] = rules[selector] || {};

        if (selector.startsWith("@") && isParent) {
            mapTransform(
                {
                    [prop]: {
                        ...customProperties[prop],
                        attrs: excludeAttrs,
                    },
                },
                options,
                rules[selector],
                regExp,
                prefix,
                false
            );
            continue;
        }

        const nextValue =
            options.scope === ":root" || value.includes("$")
                ? value.replace(
                      /\$([\w\-]+)/g,
                      (_: string, variable: string) =>
                          `var(${prefix}${variable})`
                  )
                : `var(${prefix}${prop})`;

        if (options.scope === ":root") {
            rules[selector][`${prefix}${prop}`] =
                nextValue != value ? nextValue : value;
        } else {
            const isHostContext = selector.startsWith(":host-context");
            const isSlotted = selector.startsWith("::slotted");
            let id =
                parentPrefix +
                props.join("-").replace(currentRegExp, "") +
                parentSuffix;

            if (isHostContext) {
                const token = selectorAttrs
                    .map((value) =>
                        value.replace(/\[/g, "(").replace(/\]/g, ")")
                    )
                    .map(customPropertyToHumanName)
                    .reduce(
                        (prop, value) => prop.replace(`--${value}`, ""),
                        prop
                    );
                if (options.bind) {
                    rules[selector][`--_${token}`] =
                        nextValue != value
                            ? nextValue
                            : `var(${prefix}${prop})`;
                } else {
                    rules[selector][`${prefix}${token}`] =
                        nextValue != value
                            ? nextValue
                            : `var(${prefix}${prop})`;
                }
            } else if (isSlotted) {
                if (excludeAttrs.length) {
                    mapTransform(
                        {
                            [prop]: {
                                ...customProperties[prop],
                                attrs: excludeAttrs,
                                props: [...customProperties[prop].props],
                            },
                        },
                        {
                            ...options,
                            bind: false,
                        },
                        rules,
                        regExp,
                        prefix,
                        false,
                        "",
                        customProperties[prop].alias[0]
                            ? `--${customProperties[prop].alias[0]}`
                            : ""
                    );
                    continue;
                }
                const idSlot = `--${prop}`;
                rules[":host"][idSlot] = `var(${prefix}${prop})`;
                rules[selector][`--${id}`] = `var(${idSlot})`;
            } else {
                if (nextValue != value) {
                    rules[selector][`--${id}`] = nextValue;
                } else if (!isSlotted && options.bind && selectorAttrs.length) {
                    rules[selector][`--_${token}`] = `var(${prefix}${prop})`;
                    rules[selector][`--_${id}`] = `var(--_${token})`;
                } else if (!isSlotted && options.bind) {
                    rules[selector][`--_${token}`] = `var(${prefix}${prop})`;
                    rules[selector][`--${id}`] = `var(--_${token})`;
                } else {
                    rules[selector][`--${id}`] = `var(${prefix}${prop})`;
                }
            }
        }
    }
    return rules;
};

const objectToCss = (rules: Rules): string => {
    let css = "";
    for (const selector in rules) {
        let props = "";
        for (const prop in rules[selector]) {
            if (typeof rules[selector][prop] === "object") {
                props += objectToCss({
                    [prop]: rules[selector][prop],
                });
            } else {
                props += `${prop}:${rules[selector][prop]};`;
            }
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
        .map(({ type, parts: [attr, operator = "=", value] }) => {
            if (type === "slot") {
                if (attr === "*") {
                    return [Alias["slot=*"]];
                }
                value = attr;
                attr = "slot";
            }
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

        if (prop !== "=") {
            const [ref] = parse(prop);
            if (ref?.type === "root") {
                createCustomProperties(
                    { [ref.value]: value },
                    customProperties,
                    currentAttrs,
                    [],
                    currentAlias
                );
                continue;
            }
        }

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
): [string, string[], string[]] {
    const nextAttrs = attrs.map(parse).flat(1);

    const noAttrs = nextAttrs.filter((ref) => ref.type !== "");

    const excludeAttrs = noAttrs.length
        ? nextAttrs.filter((ref) => !ref.type).map((ref) => ref.raw)
        : [];

    const selector = (noAttrs.length ? noAttrs : nextAttrs)
        .sort(({ parts: [attr1] }, { parts: [attr2] }) =>
            attr1 > attr2 ? 1 : attr1 < attr2 ? -1 : 0
        )
        .map(({ type, parts: [attr, operator, value] }) => {
            let prefix = "[";
            let suffix = "]";
            switch (type) {
                case "slot": {
                    scope = "::slotted";
                    if (attr === "*") {
                        return "*";
                    }
                    if (!operator) {
                        value = attr;
                        attr = "slot";
                        operator = "=";
                    }
                    break;
                }
                case "container":
                case "media": {
                    scope = `@${type} `;
                    prefix = "";
                    suffix = "";
                    break;
                }
                case "context": {
                    scope = ":host-context";
                    break;
                }
            }
            return operator === "!="
                ? `:not([${attr}=${value}])`
                : `${prefix}${attr}${
                      operator ? `${operator}${value}` : ""
                  }${suffix}`;
        });

    return [
        `${scope}${
            /^(:host|::slotted|@)/.test(scope) && selector.length
                ? `(${selector.join("")})`
                : `${selector.join("")}`
        }`,
        selector,
        excludeAttrs,
    ];
}
