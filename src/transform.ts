const isMatch = /^(:|\[|=)/;

const join = (parent: string, child: string) =>
    /^(:|\[|=)/.test(child)
        ? (parent || "") + child
        : (parent ? parent + "-" : "") + child;

const split = (value: string) => {
    const part = [];
    let lastIndex = "";
    let matches: boolean;

    const add = (value: string) => !part.includes(value) && part.push(value);

    for (let i = 0; i < value.length; i++) {
        switch (value[i]) {
            case "'":
            case '"':
            case ")":
                break;
            case "(":
                if (matches) {
                    part.push(lastIndex);
                    lastIndex = "";
                    matches = false;
                }
                break;
            case ":":
                matches = true;
                break;
            case "=":
                add(lastIndex);
                lastIndex = "";
                break;
            case "[":
                lastIndex = "";
                break;
            case "]":
                add(lastIndex);
                lastIndex = "";
                break;
            default:
                lastIndex += value[i];
                break;
        }
    }
    return part;
};

const customProperty = ({
    prefix,
    root,
    prop,
    value,
    withDefault,
    onlyProperty,
    onlyValue,
    import: _import,
}: {
    prefix: string;
    root: string;
    prop: string;
    value: string;
    withDefault?: boolean;
    onlyProperty?: boolean;
    onlyValue?: boolean;
    import?: RegExp | false;
}) => {
    const mapRoot = isMatch.test(root)
        ? root === ":host"
            ? []
            : split(root)
        : [];

    const map = ["", prefix, ...mapRoot];

    const propMap = prop
        .split("-")
        .filter((prop) => !map.includes(prop))
        .join("-");

    if (propMap) map.push(propMap);

    const rootProp = map.join("--");

    if (onlyProperty) return rootProp;

    const nextValue = `${value}`.replace(
        /(\$(?:\$){0,1})([^\s$]+)/g,
        (all, type: string, mapProp: string) => {
            mapProp = mapProp.replace(/\./g, "-");
            return `var(${(type == "$"
                ? ["", prefix, mapProp]
                : ["", _import ? mapProp.replace(_import, "") : mapProp]
            ).join("--")})`;
        }
    );

    return nextValue === value
        ? onlyValue
            ? value
            : `var(${rootProp}${withDefault ? `, ${value}` : ""})`
        : nextValue;
};

export function transform(
    {
        data,
        prefix,
        root,
        shadowDom = root === ":host",
        withDefault,
        import: _import,
    }: {
        data: Record<string, any>;
        prefix: string;
        root: string;
        shadowDom?: boolean;
        withDefault?: boolean;
        import?: RegExp | false;
    },
    results = {} as Record<string, Record<string, string>>,
    parent = ""
) {
    for (const prop in data) {
        const test = prop.match(/(\w+)(!){0,1}=(.+)/);
        const value = data[prop];
        const type = typeof value;
        if (test) {
            const [, attribute, operator, attributeValue] = test;
            transform(
                {
                    data: value,
                    shadowDom,
                    prefix,
                    root: join(
                        root === ":host" ? "" : root,
                        `${operator === "!" ? ":not(" : ""}[${attribute}${
                            attributeValue === "true"
                                ? ""
                                : `="${attributeValue}"`
                        }]${operator ? ")" : ""}`
                    ),
                    withDefault,
                    import: _import,
                },
                results,
                parent
            );
        } else if (type === "object") {
            transform(
                {
                    data: value,
                    shadowDom,
                    prefix,
                    root,
                    withDefault,
                    import: _import,
                },
                results,
                join(parent, prop)
            );
        } else {
            const id = prop === "=" ? parent : join(parent, prop);
            results[root] = results[root] || {};
            if (shadowDom) {
                results[root][id] = customProperty({
                    prefix,
                    root,
                    prop: id,
                    value,
                    withDefault,
                    import: _import,
                });
            } else {
                results[root][
                    customProperty({
                        prefix,
                        root,
                        prop: id,
                        value,
                        onlyProperty: true,
                    })
                ] = customProperty({
                    prefix,
                    root,
                    prop: id,
                    value,
                    onlyValue: true,
                });
            }
        }
    }
    return results;
}
