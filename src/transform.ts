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

const HOST = ":host";
const HOST_CONTEXT = ":host-context";
const SLOTTED = "::slotted";

export const Alias = {
    "<": "greater-than",
    ">": "less-than",
    "=": "is",
    "!=": "is-not",
    "|": "or",
    "&": "and",
    "*": "any",
};

export const transform = (data: Data, options: Options) => {
    const customProperties = createCustomProperties(data);
    const rules: Rules = {};
    const search = options.use || options.filter;
    const regExp = search
        ? RegExp(`^(?:${search}|${search}(?:-){1,}(.+))$`)
        : null;
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
    parentSuffix = "",
    observeProperty = (property: string, value: string) => {}
) => {
    const setSelector = (selector: string, property: string, value: string) => {
        prepareSelector(selector);
        observeProperty(property, value);
        rules[selector][property] = value;
    };
    const prepareSelector = (selector: string) =>
        (rules[selector] = rules[selector] || {});

    for (const prop in customProperties) {
        const { value, attrs, props } = customProperties[prop];
        const [selector, selectorAttrs, excludeAttrs] =
            options.scope === ":root"
                ? [options.scope, []]
                : getSelector(attrs, options.scope);

        if (regExp && !regExp.test(prop)) continue;

        const token = regExp && options.use ? prop.replace(regExp, "$1") : prop;
        const currentRegExp = options.use ? regExp : null;

        if (!token) continue;

        prepareSelector(selector);

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

        const [baseProp] = prop.split("-");

        const nextValue =
            options.scope === ":root" || value.includes("$")
                ? value.replace(
                      /\$(\$)?([\w\-]+)/g,
                      (_, reference, variable) => {
                          if (options.scope != ":root") {
                              const [baseVariable] = variable.split("-");
                              if (baseVariable === baseProp) {
                                  return `var(--${variable.replace(
                                      options.use ? regExp : null,
                                      "$1"
                                  )})`;
                              } else if (!customProperties[prop].attrs.length) {
                                  return `var(--${variable})`;
                              }
                          }
                          return reference
                              ? `var(--${variable})`
                              : `var(${prefix}${variable})`;
                      }
                  )
                : `var(${prefix}${prop})`;

        if (options.scope === ":root") {
            setSelector(
                selector,
                `${prefix}${prop}`,
                nextValue != value ? nextValue : value
            );
        } else {
            const isHostContext = selector.startsWith(HOST_CONTEXT);
            const isSlotted = selector.startsWith(SLOTTED);
            let id =
                parentPrefix +
                props.join("-").replace(currentRegExp, "$1") +
                parentSuffix;
            if (isHostContext || isSlotted) {
                setSelector(selector, `--${id}`, `var(${prefix}${prop})`);
            } else {
                if (nextValue != value) {
                    setSelector(selector, `--${id}`, nextValue);
                } else if (attrs.length) {
                    setSelector(HOST, `--${token}`, `var(${prefix}${prop})`);
                    setSelector(
                        selector,
                        `--${id}`,
                        `var(--${token})${options.bind ? "!important" : ""}`
                    );
                } else {
                    setSelector(selector, `--${id}`, `var(${prefix}${prop})`);
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
                if (attr === "slot" && value === "*") {
                    value = Alias[value] || value;
                } else if (attr === "*") {
                    attr = "slot";
                    operator = "=";
                    value = "any";
                }
            }
            const alias = Alias[operator] || "";
            value = value === "true" ? "" : value;
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
    scope: string = HOST
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
                    scope = SLOTTED;
                    if (attr === "*" || (value === "*" && attr === "slot")) {
                        return "*";
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
                    scope = HOST_CONTEXT;
                    break;
                }
            }
            if (value === "true" && operator === "=") {
                operator = "";
            }
            return (
                operator === "!="
                    ? `:not([${attr}=${value}])`
                    : `${prefix}${attr}${
                          operator ? `${operator}${value}` : ""
                      }${suffix}`
            ).replace(/=true]/g, "]");
        });

    return [
        `${scope}${
            /^(:host|::slotted|@)/.test(scope) && selector.length
                ? `(${selector.join("").replace("]*", "]")})`
                : `${selector.join("")}`
        }`,
        selector,
        excludeAttrs,
    ];
}
