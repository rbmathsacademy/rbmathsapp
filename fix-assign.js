const fs = require('fs');
let content = fs.readFileSync('app/admin/assignments/[id]/page.tsx', 'utf8');

const oldStr = `                                                        {q.options.map((opt: string, j: number) => (
                                                            <div key={j} className="text-xs sm:text-sm px-3 py-2 rounded-lg border border-white/5 bg-black/20 flex items-start gap-2">
                                                                <span className="font-bold text-gray-500">{String.fromCharCode(65 + j)}.</span>
                                                                <span className="text-gray-300 overflow-x-auto"><Latex>{opt}</Latex></span>
                                                            </div>
                                                        ))}`;

const newStr = `                                                        {q.options.map((opt: any, j: number) => {
                                                            const isObj = typeof opt === 'object' && opt !== null;
                                                            const optText = isObj ? (opt.text ?? '') : (opt ?? '');
                                                            const optImage = isObj ? (opt.image ?? '') : '';
                                                            return (
                                                                <div key={j} className="text-xs sm:text-sm px-3 py-2 rounded-lg border border-white/5 bg-black/20 flex flex-col gap-2">
                                                                    <div className="flex items-start gap-2">
                                                                        <span className="font-bold text-gray-500">{String.fromCharCode(65 + j)}.</span>
                                                                        {optText && <span className="text-gray-300 overflow-x-auto"><Latex>{optText}</Latex></span>}
                                                                    </div>
                                                                    {optImage && <img src={optImage} alt={\`Option \${String.fromCharCode(65 + j)}\`} className="max-h-24 object-contain rounded ring-1 ring-white/10 ml-6" />}
                                                                </div>
                                                            );
                                                        })}`;

const parts1 = content.split(oldStr);
console.log('parts after first try: ', parts1.length);
if (parts1.length === 1) {
    const oldStrLF = oldStr.replace(/\r\n/g, '\n');
    const parts2 = content.split(oldStrLF);
    console.log('parts after second try (LF): ', parts2.length);
    content = parts2.join(newStr);
} else {
    content = parts1.join(newStr);
}

fs.writeFileSync('app/admin/assignments/[id]/page.tsx', content);
