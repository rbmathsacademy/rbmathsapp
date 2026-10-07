const fs = require('fs');
let content = fs.readFileSync('app/admin/online-tests/monitor/components/SubmissionReviewModal.tsx', 'utf8');

const oldAnsAnswer =                                         Array.isArray(ans.answer)\r
                                            ? ans.answer.map((idx: number, i: number) => (\r
                                                <span key={i}>{i > 0 && ', '}<LatexRender content={q.options[idx] || \Option \\} /></span>\r
                                            ))\r
                                            : <LatexRender content={q.options[parseInt(ans.answer)] || String(ans.answer)} />;

const oldAnsAnswerLF = oldAnsAnswer.replace(/\r\n/g, '\n');

const newAnsAnswer =                                         Array.isArray(ans.answer)
                                            ? ans.answer.map((idx: number, i: number) => {
                                                const opt = q.options[idx];
                                                const optText = typeof opt === 'object' && opt !== null ? (opt.text ?? '') : (opt || \Option \\);
                                                return <span key={i}>{i > 0 && ', '}<LatexRender content={optText} /></span>;
                                            })
                                            : (() => {
                                                const idx = parseInt(ans.answer);
                                                const opt = !isNaN(idx) ? q.options[idx] : undefined;
                                                const optText = typeof opt === 'object' && opt !== null ? (opt.text ?? '') : (opt || String(ans.answer));
                                                return <LatexRender content={optText} />;
                                            })();

content = content.replace(oldAnsAnswer, newAnsAnswer).replace(oldAnsAnswerLF, newAnsAnswer);


const oldCorrectIndices =                                 (q.correctIndices || []).map((idx: number, i: number) => (\r
                                    <span key={i} className="block">\r
                                        <span className="text-slate-500 text-[10px] mr-1">({String.fromCharCode(65 + idx)})</span>\r
                                        <LatexRender content={q.options[idx] || \Option \\} />\r
                                    </span>\r
                                ));

const oldCorrectIndicesLF = oldCorrectIndices.replace(/\r\n/g, '\n');

const newCorrectIndices =                                 (q.correctIndices || []).map((idx: number, i: number) => {
                                    const opt = q.options[idx];
                                    const optText = typeof opt === 'object' && opt !== null ? (opt.text ?? '') : (opt || \Option \\);
                                    return (
                                        <span key={i} className="block">
                                            <span className="text-slate-500 text-[10px] mr-1">({String.fromCharCode(65 + idx)})</span>
                                            <LatexRender content={optText} />
                                        </span>
                                    );
                                });

content = content.replace(oldCorrectIndices, newCorrectIndices).replace(oldCorrectIndicesLF, newCorrectIndices);

fs.writeFileSync('app/admin/online-tests/monitor/components/SubmissionReviewModal.tsx', content);
console.log("Done");
