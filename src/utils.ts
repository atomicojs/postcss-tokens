export function filter(select: string, data: Record<string, string>) {
    const result: Record<string, string> = {};

    for (const prop in data) {
    }
}

export const objectToCssProps = (
    data: Record<string, string>,
    { prefix = "  ", filter = "" } = {}
) => {
    const match = filter
        ? RegExp(`^(${filter.replace(/\./g, "-").replace(/ *, */g, "|")})`)
        : false;

    return Object.entries(data)
        .filter(([index]) => (match ? match.test(index) : true))
        .map(([index, value]) => `${prefix || ""}${index}: ${value}`)
        .join(";\n");
};

export const cssRule = (selector: string, cssProps: string) =>
    `${selector} {\n${cssProps}\n}\n`;

export const cleanQuote = (value: string) =>
    value.replace(/^("|')(.+)("|')$/g, "$2");
