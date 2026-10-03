const fs = require('fs');
const css = fs.readFileSync('D:/VS Code/anysound HD [正式版]/液态玻璃/_next/static/chunks/a531f99a2f08da6d.css', 'utf8');

// Split by } and find all non-utility classes
let output = '=== ALL CUSTOM CLASSES ===\n\n';
const parts = css.split('}');
let seen = new Set();

// Known Tailwind utility prefixes to skip
const utilityPrefixes = /^(\.(size-|inset-|top-|right-|bottom-|left-|z-|col-|row-|container|mx-|my-|mt-|mr-|mb-|ml-|ms-|me-|block|contents|flex|grid|hidden|inline|table|flow|list|field|aspect|h-|w-|max-|min-|shrink|grow|basis|caption|border|origin|translate|rotate|scale|transform|animate|cursor|touch|resize|scroll|list|auto|grid-cols|grid-rows|flex-|items-|justify-|gap-|space-|gap-y|self|justify-self|overflow|rounded|rounded-|border-|bg-|from-|to-|via-|text-|underline|overline|line-through|no-underline|decoration|antialiased|subpixel|placeholder|opacity|shadow|shadow-|outline|ring|ring-|blur|brightness|contrast|grayscale|hue-|invert|saturate|sepia|drop|filter|backdrop|transition|duration|ease|delay|animate|will|content|forced|sr-only|not-|pointer|visible|invisible|collapse|static|fixed|absolute|relative|sticky|isolate|float|clear|object|object-|overflow-|overscroll|truncate|text-ellipsis|text-clip|whitespace|break|hyphens|align|leading|tracking|indent|normal|uppercase|lowercase|capitalize|italic|not-italic|font-|ordinal|slashed|lining|oldstyle|proportional|tabular|diagonal|stacked|underline|decoration|select|snap|scroll-|columns|break-|box-|clear|float|grid|justify|place|content|items|self|order|divide|ring|shadow|mix|blend|filter|backdrop|sepia|saturate|hue|invert|grayscale|contrast|brightness|blur|drop|transition|animate|duration|ease|delay|will|contents|sr|not|forced|first|last|odd|even|visited|target|open|empty|disabled|enabled|checked|indeterminate|default|required|valid|invalid|in-range|out-of|placeholder|autofill|read|file|focus|focus-|hover|active|group|peer|motion|dark|portrait|landscape|print|sm:|md:|lg:|xl:|2xl:|min-|max-|supports|aria|data|has|\[\&|\.\@|selection|marker|\[data|\[aria|\.group|\.peer|\.dark|\.motion|before:|after:|first-letter|first-line|marker:|backdrop:|file:|placeholder:|selection:))/;

for (let i = 0; i < parts.length; i++) {
    let part = parts[i];
    // Find className definitions
    let classMatch = part.match(/\.([a-zA-Z][a-zA-Z0-9_-]*)\s*\{/g);
    if (classMatch) {
        for (let m of classMatch) {
            let name = m.replace(/[{.]/g, '').trim();
            if (!seen.has(name) && !utilityPrefixes.test('.' + name)) {
                seen.add(name);
                let fullRule = parts[i] + '}';
                output += `.${name} { ${fullRule.split('{').slice(1).join('{')}\n\n`;
            }
        }
    }
}

// Also look for CSS variable definitions
output += '\n=== CSS VARIABLE REFS ===\n';
const varRefs = css.match(/var\(--[a-zA-Z-]+/g);
if (varRefs) {
    let unique = [...new Set(varRefs)];
    output += unique.join('\n');
}

fs.writeFileSync('D:/VS Code/anysound HD [正式版]/液态玻璃/extracted-css.txt', output);
console.log('Done!');