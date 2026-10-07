const fs = require('fs');
let content = fs.readFileSync('app/admin/answers/page.tsx', 'utf8');

const pattern = /{q\.options\.map\(\(opt: string, i: number\) => \(\s*<div key=\{i\} className={	ext-xs px-2 py-1\.5 rounded border border-gray-700 bg-gray-900\/50 flex items-start gap-2 \$\{q\.answer && \(opt\.includes\(q\.answer\) \|\| q\.answer\.includes\(opt\)\) \? 'border-green-500\/30 bg-green-900\/10' : ''}}>\s*<span className="font-bold text-gray-500 uppercase flex-shrink-0">\{String\.fromCharCode\(65 \+ i\)\}\.<\/span>\s*<span className="text-gray-300 break-words w-full"><Latex>\{opt\}<\/Latex><\/span>\s*<\/div>\s*\)\)}/g;

const replacement = \{q.options.map((opt: any, i: number) => {
    const isObj = typeof opt === 'object' && opt !== null;
    const optText = isObj ? (opt.text ?? '') : (opt ?? '');
    const optImage = isObj ? (opt.image ?? '') : '';
    
    let isAns = false;
    if (q.answer) {
        const ansStr = String(q.answer);
        isAns = (optText && (optText.includes(ansStr) || ansStr.includes(optText))) || String(i) === ansStr || String(String.fromCharCode(65 + i)) === ansStr;
    }
    return (
    <div key={i} className={\\\	ext-xs px-2 py-1.5 rounded border flex flex-col gap-2 \\\\\\}>
        <div className="flex items-start gap-2">
            <span className="font-bold text-gray-500 uppercase flex-shrink-0">{String.fromCharCode(65 + i)}.</span>
            {optText && <span className="text-gray-300 break-words w-full"><Latex>{optText}</Latex></span>}
        </div>
        {optImage && <img src={optImage} alt={\\\Option \\\\\\} className="max-h-24 object-contain rounded ring-1 ring-white/10 ml-5" />}
    </div>
)})}\;

const newContent = content.replace(pattern, replacement);
fs.writeFileSync('app/admin/answers/page.tsx', newContent);
console.log(content.length !== newContent.length);
