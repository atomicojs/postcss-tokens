const SPACE = " ";

interface Ref {
    type: string;
    value: string;
}

function parse(value: string) {
    const text = value.replace(/\s+/g, " ") + " ";
    let current = "";
    let isOpen = 0;
    let ref: Ref;
    const refs = [];
    for (let i = 0; i < text.length; i++) {
        const value = text[i];
        if (value === "(" && !isOpen++) {
            ref = { type: "attr", value: "" };
            if (text[i - 1] !== SPACE) {
                ref.type = current;
            }
            current = "";
            refs.push(ref);
            continue;
        }
        if (value === ")" && !--isOpen) {
            ref.value = current.trim();
            ref = null;
            current = "";
            continue;
        }
        if (value === SPACE && !isOpen && current) {
            refs.push({
                type: "operator",
                value: current.trim(),
            });
            current = "";
        }
        current += value;
    }
    return refs;
}
