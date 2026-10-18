// Assignment titles look like "Relation & Functions || 17th April" or
// "Inverse Trigonometry || 7th May || Board specific": the topic comes first.

const NOISE = new Set([
    'and', 'of', 'the', 'in', 'for', 'to', 'by', 'on', 'with', 'part', 'test', 'class', 'assignment',
    'homework', 'holiday', 'submit', 'board', 'specific', 'chapter', 'chapters', 'set', 'sheet',
    'practice', 'revision', 'review', 'jee', 'wbjee', 'extra',
]);

// Words so common in sub-topic names that sharing them says nothing about being the same thing.
const GENERIC = new Set(['funct', 'equat', 'probl', 'basic', 'prope', 'appli', 'gener', 'formu', 'theor', 'quest', 'metho', 'types', 'conce']);

/** The topic part of an assignment title ("" when it names no topic, e.g. "Holiday Homework-1"). */
export function assignmentLabel(title: string): string {
    const head = (title || '').split('||')[0].trim();
    if (/^(holiday\s+)?home\s?work\b/i.test(head) || /^holiday\b/i.test(head)) return '';
    return head;
}

// Compare words by their first 5 letters so "Integration"/"Integral" and "Matrix"/"Matrices" line up.
export function stemSet(text: string): Set<string> {
    const out = new Set<string>();
    for (const w of (text || '').toLowerCase().replace(/&/g, ' and ').split(/[^a-z0-9]+/)) {
        if (w.length < 3 || NOISE.has(w) || /^\d+$/.test(w)) continue;
        out.add(w.slice(0, 5));
    }
    return out;
}

function withoutGeneric(s: Set<string>): Set<string> {
    const out = new Set<string>();
    s.forEach(x => { if (!GENERIC.has(x)) out.add(x); });
    return out;
}

/** True when two sub-topic headings are plainly the same thing worded differently. */
export function sameHeading(a: string, b: string): boolean {
    if (a === b) return true;
    const A = withoutGeneric(stemSet(a)), B = withoutGeneric(stemSet(b));
    if (A.size === 0 || B.size === 0) return false;
    let inter = 0;
    A.forEach(s => { if (B.has(s)) inter++; });
    return inter === Math.min(A.size, B.size) && inter / Math.max(A.size, B.size) >= 0.5;
}

export interface TopicCandidate { topic: string; categories: string[]; weight: number }

/**
 * The topic an assignment is about: best match on topic names first, then on sub-topic headings
 * ("Rate of Change" lives under another topic). Ties go to the topic with more test data.
 */
export function matchTopic(label: string, candidates: TopicCandidate[]): string | null {
    const a = stemSet(label);
    if (a.size === 0) return null;

    let best: { topic: string; overlap: number; weight: number } | null = null;
    const consider = (topic: string, text: string, weight: number, minOverlap: number) => {
        const b = stemSet(text);
        if (b.size === 0) return;
        let inter = 0;
        a.forEach(s => { if (b.has(s)) inter++; });
        if (inter === 0) return;
        const overlap = inter / Math.min(a.size, b.size);
        if (overlap < minOverlap) return;
        if (!best || overlap > best.overlap || (overlap === best.overlap && weight > best.weight)) {
            best = { topic, overlap, weight };
        }
    };

    for (const c of candidates) consider(c.topic, c.topic, c.weight, 0.5);
    if (best) return (best as { topic: string }).topic;
    for (const c of candidates) for (const cat of c.categories) consider(c.topic, cat, c.weight, 0.8);
    return best ? (best as { topic: string }).topic : null;
}
