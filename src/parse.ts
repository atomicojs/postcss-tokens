const SPACE = " ";

interface Ref {
    type: string;
    value: string;
    raw: string;
    parts: string[];
}

const REGEXP_SELECTOR = String.raw`(?:(?:\!|\^|\~|\$|\*|\|)?(?:=))`;
const REGEXP_ATTRIBUTE = String.raw`(?: *(>|<|:) *)`;
const REGEXP = RegExp(
    String.raw`([\w\-\*]+)(:?(${REGEXP_SELECTOR}|${REGEXP_ATTRIBUTE})(.*))?`
);

export const parse = (value: string) => {
    const text = value.replace(/\s+/g, " ") + " ";
    let current = "";
    let isOpen = 0;
    let ref: Ref;
    const refs: Ref[] = [];
    for (let i = 0; i < text.length; i++) {
        const value = text[i];
        if (value === "(" && !isOpen++) {
            ref = { type: "attr", value: "", parts: [], raw: "" };
            if (text[i - 1] !== SPACE) {
                ref.type = current.trim();
            }
            current = "";
            refs.push(ref);
            continue;
        }
        if (value === ")" && !--isOpen) {
            ref.value = current.trim();
            const test = ref.value.match(REGEXP);
            if (test) {
                const [, attr, , operator, , value] = test;
                ref.parts.push(
                    attr,
                    operator ? operator.trim() : undefined,
                    value
                );
                ref.raw = `${ref.type || ""}(${ref.value})`;
            }
            ref = null;
            current = "";
            continue;
        }
        if (value === SPACE && !isOpen && current) {
            refs.push({
                type: "operator",
                value: current.trim(),
                parts: [],
                raw: "",
            });
            current = "";
        }
        current += value;
    }
    return refs;
};
