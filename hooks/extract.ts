export interface ExtractedExports {
    names : string[]
    hasDefault : boolean
}

// Blank out comments and string/template literals so the export regexes can't
// false-match inside them. Offsets are preserved; newlines kept.
export function stripLiterals(source : string) : string {
    const out = source.split("");
    const blank = (i : number) => {
        if(out[i] !== "\n") out[i] = " ";
    }

    // A "code" context above the root models a `${ ... }` interpolation.
    type Ctx = { kind: "code", braces: number } | { kind: "template" };
    const stack : Ctx[] = [{ kind: "code", braces: 0 }];

    let i = 0;
    while(i < source.length) {
        const ctx = stack[stack.length - 1];
        const c = source[i];
        const d = source[i + 1];

        if(ctx.kind === "template") {
            if(c === "\\") {
                blank(i);
                if(i + 1 < source.length) blank(i + 1);
                i += 2;
            } else if(c === "`") {
                blank(i);
                stack.pop();
                i++;
            } else if(c === "$" && d === "{") {
                blank(i);
                blank(i + 1);
                stack.push({ kind: "code", braces: 0 });
                i += 2;
            } else {
                blank(i);
                i++;
            }
            continue;
        }

        if(c === "/" && d === "/") {
            while(i < source.length && source[i] !== "\n") blank(i++);
        } else if(c === "/" && d === "*") {
            blank(i);
            blank(i + 1);
            i += 2;
            while(i < source.length && !(source[i] === "*" && source[i + 1] === "/")) blank(i++);
            if(i < source.length) {
                blank(i);
                blank(i + 1);
                i += 2;
            }
        } else if(c === '"' || c === "'") {
            blank(i++);
            while(i < source.length && source[i] !== c && source[i] !== "\n") {
                if(source[i] === "\\") blank(i++);
                if(i < source.length) blank(i++);
            }
            if(i < source.length) blank(i++);
        } else if(c === "`") {
            blank(i++);
            stack.push({ kind: "template" });
        } else if(c === "{") {
            ctx.braces++;
            i++;
        } else if(c === "}") {
            if(ctx.braces === 0 && stack.length > 1) {
                // closes a `${` interpolation — back to the template
                blank(i);
                stack.pop();
            } else {
                ctx.braces--;
            }
            i++;
        } else {
            i++;
        }
    }

    return out.join("");
}

const FN_RE = /export\s+(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/g;
const VAR_RE = /export\s+(?:const|let|var)\s+(?:enum\s+)?([A-Za-z_$][\w$]*)/g;
const CLASS_RE = /export\s+(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/g;
const ENUM_RE = /export\s+enum\s+([A-Za-z_$][\w$]*)/g;
const BRACE_RE = /export\s*(type\s*)?\{([^}]*)\}/g;
const DEFAULT_RE = /export\s+default\b/;
const STAR_RE = /export\s*\*/;
const DESTRUCTURE_RE = /export\s+(?:const|let|var)\s*[{[]/;

export function extractExportedNames(source : string, url? : string) : ExtractedExports {
    const src = stripLiterals(source);

    if(STAR_RE.test(src)) throw new Error(`Unsupported export * in ${url}`);
    if(DESTRUCTURE_RE.test(src)) throw new Error(`Unsupported destructuring export in ${url}`);

    const names = new Set<string>();
    let hasDefault = DEFAULT_RE.test(src);

    for(const re of [FN_RE, VAR_RE, CLASS_RE, ENUM_RE]) {
        re.lastIndex = 0;
        for(const m of src.matchAll(re)) {
            if(m[1] !== "default") names.add(m[1]);
        }
    }

    BRACE_RE.lastIndex = 0;
    for(const m of src.matchAll(BRACE_RE)) {
        if(m[1]) continue; // export type { ... } — no runtime binding
        for(const entry of m[2].split(",")) {
            const parts = entry.trim().split(/\s+/);
            if(parts[0] === "" || parts[0] === "type") continue; // empty or inline type export
            const exported = parts.length >= 3 && parts[1] === "as" ? parts[2] : parts[0];
            if(exported === "default") hasDefault = true;
            else names.add(exported);
        }
    }

    return { names: [...names], hasDefault };
}
