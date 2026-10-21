// Client-side "stale-while-revalidate" cache for the admin portal.
//
// A page shows the last response it got for a URL immediately, then fetches the URL again as it
// always did and swaps in the fresh data, so revisiting a page is instant but nothing stays stale
// and no extra API calls are made. In-flight duplicate requests for the same URL are shared.
//
// Entries live in memory (survive client-side navigation) and in sessionStorage (survive a
// reload; gone when the tab closes). Each entry is tagged with the logged-in admin's email so one
// admin never sees another's cached data on a shared computer. Cleared on login and logout.

type Entry = { at: number; ns: string; data: any };

const PREFIX = 'ac:';
const MAX_PERSIST_CHARS = 1_500_000; // very large payloads stay in memory only
const mem = new Map<string, Entry>();
const inflight = new Map<string, Promise<any>>();

function identity(): string {
    try {
        return JSON.parse(localStorage.getItem('user') || '{}').email || '';
    } catch {
        return '';
    }
}

export function readAdminCache<T = any>(key: string): { data: T; at: number } | null {
    const ns = identity();
    let e = mem.get(key);
    if (!e) {
        try {
            const raw = sessionStorage.getItem(PREFIX + key);
            if (raw) { e = JSON.parse(raw) as Entry; mem.set(key, e); }
        } catch { /* storage unavailable or corrupt */ }
    }
    if (!e || e.ns !== ns) return null;
    return { data: e.data as T, at: e.at };
}

const MAX_MEM_ENTRIES = 80; // least-recently written entries are dropped beyond this

export function writeAdminCache(key: string, data: any) {
    const e: Entry = { at: Date.now(), ns: identity(), data };
    mem.delete(key);
    mem.set(key, e);
    while (mem.size > MAX_MEM_ENTRIES) mem.delete(mem.keys().next().value as string);
    try {
        const s = JSON.stringify(e);
        if (s.length <= MAX_PERSIST_CHARS) sessionStorage.setItem(PREFIX + key, s);
        else sessionStorage.removeItem(PREFIX + key);
    } catch { /* quota exceeded or storage unavailable: the memory copy still works */ }
}

/** Forget cached responses whose URL starts with any of the prefixes (all, when none given). */
export function clearAdminCache(...urlPrefixes: string[]) {
    const match = (k: string) => urlPrefixes.length === 0 || urlPrefixes.some(p => k.startsWith(p));
    for (const k of Array.from(mem.keys())) if (match(k)) mem.delete(k);
    try {
        Object.keys(sessionStorage).filter(k => k.startsWith(PREFIX) && match(k.slice(PREFIX.length))).forEach(k => sessionStorage.removeItem(k));
    } catch { /* ignore */ }
}

/**
 * Stale-while-revalidate GET of a JSON API.
 *  1. If a cached copy exists, `apply(cached, true)` is called right away (synchronously).
 *  2. The URL is fetched; on success the response is cached and `apply(fresh, false)` is called.
 * Returns the fresh data. Throws (with the API's error message) when the request fails, so the
 * page's existing error handling still runs. Identical requests already in flight are shared.
 */
export async function swrJson<T = any>(url: string, apply: (data: T, fromCache: boolean) => void, init?: RequestInit): Promise<T> {
    const cached = readAdminCache<T>(url);
    if (cached) apply(cached.data, true);

    let p = inflight.get(url);
    if (!p) {
        p = (async () => {
            const res = await fetch(url, { cache: 'no-store', ...init });
            let data: any = null;
            try { data = await res.json(); } catch { /* non-JSON */ }
            if (!res.ok) {
                const err: any = new Error((data && (data.error || data.message)) || `Request failed (${res.status})`);
                err.status = res.status;
                throw err;
            }
            writeAdminCache(url, data);
            return data;
        })().finally(() => inflight.delete(url));
        inflight.set(url, p);
    }
    const fresh = await p;
    apply(fresh, false);
    return fresh;
}

/** Headers most admin APIs expect (signed-in admin's email). */
export function adminHeaders(): Record<string, string> {
    const h: Record<string, string> = {};
    try {
        const email = JSON.parse(localStorage.getItem('user') || '{}').email;
        if (email) h['X-User-Email'] = email;
        const token = localStorage.getItem('adminToken');
        if (token) h.Authorization = `Bearer ${token}`;
    } catch { /* ignore */ }
    return h;
}
