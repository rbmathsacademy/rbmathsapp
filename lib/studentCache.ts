// Tiny client-side cache for the student portal pages ("stale-while-revalidate").
//
// A page shows the last response it got for a URL immediately, then fetches the URL again as it
// always did and swaps in the fresh data. So navigation feels instant, but nothing is ever served
// stale for long and no extra API calls are made.
//
// Entries live in memory (survives client-side navigation) and in sessionStorage (survives a
// WebView reload; gone when the app/tab is closed). Each entry is tagged with the logged-in
// identity so one student can never see another student's cached data on a shared device.

type Entry = { at: number; ns: string; data: any };

const PREFIX = 'sc:';
const MAX_PERSIST_CHARS = 1_500_000; // don't push very large payloads into sessionStorage
const mem = new Map<string, Entry>();

function identity(): string {
    try {
        return `${localStorage.getItem('studentName') || ''}|${localStorage.getItem('user') || ''}`;
    } catch {
        return '';
    }
}

export function readCache<T = any>(key: string): { data: T; at: number } | null {
    const ns = identity();
    let e = mem.get(key);
    if (!e) {
        try {
            const raw = sessionStorage.getItem(PREFIX + key);
            if (raw) {
                e = JSON.parse(raw) as Entry;
                mem.set(key, e);
            }
        } catch { /* storage unavailable or corrupt */ }
    }
    if (!e || e.ns !== ns) return null;
    return { data: e.data as T, at: e.at };
}

export function writeCache(key: string, data: any) {
    const e: Entry = { at: Date.now(), ns: identity(), data };
    mem.set(key, e);
    try {
        const s = JSON.stringify(e);
        if (s.length <= MAX_PERSIST_CHARS) sessionStorage.setItem(PREFIX + key, s);
        else sessionStorage.removeItem(PREFIX + key);
    } catch { /* quota exceeded or storage unavailable: memory copy still works */ }
}

/** Call on login and logout. */
export function clearStudentCache() {
    mem.clear();
    try {
        Object.keys(sessionStorage).filter(k => k.startsWith(PREFIX)).forEach(k => sessionStorage.removeItem(k));
    } catch { /* ignore */ }
}
