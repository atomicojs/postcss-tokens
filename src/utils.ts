export const objectToCssProps = (
    data: Record<string, string>,
    {
        prefix = "  ",
        filter = "",
        import: _import = false,
    }: {
        prefix?: string;
        filter?: string;
        import?: RegExp | false;
    } = {}
) => {
    const match = filter
        ? RegExp(`^(${filter.replace(/\./g, "-").replace(/ *, */g, "|")})`)
        : false;

    return Object.entries(data)
        .filter(([index]) => (match ? match.test(index) : true))
        .map(
            ([index, value]) =>
                `${prefix || ""}${
                    _import ? index.replace(_import, "") : index
                }: ${value}`
        )
        .join(";\n");
};

export const cssRule = (selector: string, cssProps: string) =>
    `${selector} {\n${cssProps}\n}\n`;

export const cleanQuote = (value: string) =>
    value.replace(/^("|')(.+)("|')$/g, "$2");
