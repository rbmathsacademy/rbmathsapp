import mergeMap from './subtopicMergeMap.json';
import { CATEGORY_RULES } from './subtopicCategories';

const MERGE_MAP = mergeMap as Record<string, Record<string, string>>;
const PRACTICE = /practi[cs]e/i;

// "-Delete Me", " - Delete Me3", "_Delete Me_CustomTest", "_DELETE ME" and anything after it.
const DELETE_TAG = /[\s_-]*delete[\s_-]*me[\s_\w-]*$/i;

// Test-building scratch topics that really mean one of the bank's topics.
const TOPIC_ALIASES: Array<[RegExp, string]> = [
    [/^st\.? ?line$/i, 'Straight Lines'],
    [/^aod(?!\s*-\s*wbjee)/i, 'Applications of Derivatives (AOD)'],
    [/^derivatives?-aod/i, 'Applications of Derivatives (AOD)'],
    [/^second order deriv/i, 'Derivatives'],
    [/^derivative$/i, 'Derivatives'],
    [/^(integration|integrations|integrals?)\b/i, 'Indefinite Integral'],
    [/^limits?$/i, 'Limits - Class XI'],
    [/^permutations? and combinations?$/i, 'Permutation & Combination'],
    [/^relations? and functions?$/i, 'Relation & Functions'],
    [/^relations?$/i, 'Relation & Functions'],
    [/^substitution/i, 'Indefinite Integral'],
    [/^sets$/i, 'Sets - Class XI'],
    [/^linear inequalit/i, 'Linear Inequality'],
];

/** Tidy a topic name stored on a test question: drop scratch tags and map aliases. */
export function cleanTopicName(raw?: string | null): string {
    let t = (raw || '').trim();
    if (!t) return '';
    const hadTag = DELETE_TAG.test(t);
    t = t.replace(DELETE_TAG, '').trim();
    // Scratch topics are numbered ("Limit1", "St Line 2", "LPP1"); the number means nothing.
    if (hadTag) t = t.replace(/[\s_-]*\d+\s*$/, '').trim();
    for (const [re, canonical] of TOPIC_ALIASES) {
        if (re.test(t)) return canonical;
    }
    return t;
}

/** Topic to use when a test question has none: the topic part of the test title. */
export function topicFromTestTitle(title?: string | null): string {
    const head = (title || '').split('||')[0].trim();
    return cleanTopicName(head) || 'General';
}

const regexCache = new Map<string, RegExp>();
function rx(source: string, flags: string): RegExp {
    const key = source + '/' + flags;
    let r = regexCache.get(key);
    if (!r) { r = new RegExp(source, flags); regexCache.set(key, r); }
    return r;
}

/**
 * Map a sub-topic name as stored in a test onto today's cleaned-up heading for that topic
 * (the same merge + categorise steps applied to the question bank). Unknown topics keep their
 * own label. Anything "practice"-like is not a real sub-topic, so it becomes "General".
 */
export function canonicalSubtopic(topic: string, rawLabel?: string | null): string {
    const label = (rawLabel || '').trim();
    if (!label || PRACTICE.test(label)) return 'General';

    const merged = MERGE_MAP[topic]?.[label] ?? label;
    const rules = CATEGORY_RULES[topic];
    if (rules) {
        for (const [category, source, flags] of rules) {
            if (source === null || rx(source, flags).test(merged)) return category;
        }
    }
    return merged;
}
