export function filter(select: string, data: Record<string, string>) {
    const result: Record<string, string> = {};

    for (const prop in data) {
    }
}

export const objectToCssProps = (data: Record<string, string>, prefix = "  ") =>
    Object.entries(data)
        .map(([index, value]) => `${prefix || ""}${index}: ${value}`)
        .join(";\n");

export const cssRule = (selector: string, cssProps: string) =>
    `${selector} {\n${cssProps}\n}\n`;

export const cleanQuote = (value: string) =>
    value.replace(/^("|')(.+)("|')$/g, "$2");
