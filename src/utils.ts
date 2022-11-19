export const objectToCssProps = (
    data: Record<string, string>,
    { prefix = "  ", filter = "", import: _import = "" } = {}
) => {
    const match = filter
        ? RegExp(`^(${filter.replace(/\./g, "-").replace(/ *, */g, "|")})`)
        : false;

    const replaceImport = _import
        ? RegExp(`^${_import.replace(/\./, "-")}-*`)
        : false;

    return Object.entries(data)
        .filter(([index]) => (match ? match.test(index) : true))
        .map(
            ([index, value]) =>
                `${prefix || ""}${
                    replaceImport ? index.replace(replaceImport, "") : index
                }: ${value}`
        )
        .join(";\n");
};

export const cssRule = (selector: string, cssProps: string) =>
    `${selector} {\n${cssProps}\n}\n`;

export const cleanQuote = (value: string) =>
    value.replace(/^("|')(.+)("|')$/g, "$2");
