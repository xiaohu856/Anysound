const fs = require('fs');
const js = fs.readFileSync('D:/VS Code/anysound HD [正式版]/液态玻璃/_next/static/chunks/14694ed103ad37d1.js', 'utf8');

// Extract JSX with Tailwind classes
let output = '=== JSX COMPONENT SNIPPETS ===\n\n';

// Find sections with className patterns
const patterns = [
    /"Button[^"]*"[^}]*className:\s*"[^"]*"/g,
    /"Switch[^"]*"[^}]*className:\s*"[^"]*"/g,
    /"Slider[^"]*"[^}]*className:\s*"[^"]*"/g,
    /"Dialog[^"]*"[^}]*className:\s*"[^"]*"/g,
    /"Tab[^"]*"[^}]*className:\s*"[^"]*"/g,
    /"Toggle[^"]*"[^}]*className:\s*"[^"]*"/g,
    /"Card[^"]*"[^}]*className:\s*"[^"]*"/g,
    /"Input[^"]*"[^}]*className:\s*"[^"]*"/g,
    /"Badge[^"]*"[^}]*className:\s*"[^"]*"/g,
    /"Progress[^"]*"[^}]*className:\s*"[^"]*"/g,
];

for (let p of patterns) {
    let matches = js.match(p);
    if (matches) {
        output += `\n--- Pattern: ${p.source} ---\n`;
        matches.forEach(m => output += m + '\n');
    }
}

// Also look for the shadcn components
const shadcnPatterns = [
    /className:\s*"[^"]{2,}"/g,
];

// Find all the Tailwind class combinations
let allClasses = js.match(/className:\s*"[^"]*"/g);
if (allClasses) {
    output += '\n=== ALL CLASSNAME STRINGS ===\n';
    let unique = [...new Set(allClasses)];
    // Filter out short ones and keep interesting ones
    unique.forEach(c => {
        if (c.length > 30) output += c + '\n\n';
    });
}

fs.writeFileSync('D:/VS Code/anysound HD [正式版]/液态玻璃/extracted-jsx.txt', output);
console.log('Done!');