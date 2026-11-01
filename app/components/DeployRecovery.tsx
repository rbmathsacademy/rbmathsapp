'use client';

import { useEffect } from 'react';

/**
 * Keeps an open tab working across new deployments. After a deploy, a tab (or the phone app's offline
 * copy) that is still running the old version asks for page code that no longer exists, and buttons
 * that open another page seem to do nothing until a refresh. This component:
 *  - reloads the page once when such a "missing page code" error happens, and
 *  - notices a new version when the tab comes back after a while: internal links then do a full load,
 *    and a student page that sat in the background for 10+ minutes refreshes itself.
 * Never on a live online-test page: a reload there would count as resuming the test.
 */
const BUILD = process.env.NEXT_PUBLIC_BUILD_ID || '';
const CHUNK_ERROR = /ChunkLoadError|Loading chunk [\w-]+ failed|Loading CSS chunk|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i;
const RECHECK_AFTER_MS = 5 * 60 * 1000;
const AUTO_RELOAD_AFTER_HIDDEN_MS = 10 * 60 * 1000;

const isLiveTestPage = (path: string) => /^\/student\/online-test\/[^/]+$/.test(path);

function reloadOnce() {
    try {
        const last = Number(sessionStorage.getItem('deploy-recovery-reload') || 0);
        if (Date.now() - last < 30_000) return; // never loop
        sessionStorage.setItem('deploy-recovery-reload', String(Date.now()));
    } catch { }
    window.location.reload();
}

export default function DeployRecovery() {
    useEffect(() => {
        const onMaybeChunkError = (text: string) => {
            if (!CHUNK_ERROR.test(text) || isLiveTestPage(location.pathname)) return;
            reloadOnce();
        };
        const onError = (ev: ErrorEvent) => onMaybeChunkError(`${ev.message || ''} ${(ev.error && ev.error.name) || ''}`);
        const onRejection = (ev: PromiseRejectionEvent) => {
            const r: any = ev.reason;
            onMaybeChunkError(`${r?.name || ''} ${r?.message || r || ''}`);
        };

        let stale = false;
        let lastCheck = Date.now();
        let hiddenAt = 0;
        const checkVersion = async () => {
            if (!BUILD) return;
            lastCheck = Date.now();
            try {
                const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
                if (!res.ok) return;
                const v = await res.json();
                if (v?.id && v.id !== BUILD) stale = true;
            } catch { }
        };
        const typedSomething = () => Array.from(document.querySelectorAll('textarea, input[type="text"]'))
            .some(el => ((el as HTMLInputElement).value || '').trim().length > 0);

        const onVisibility = async () => {
            if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
            const away = hiddenAt ? Date.now() - hiddenAt : 0;
            if (Date.now() - lastCheck < RECHECK_AFTER_MS && !stale) return;
            await checkVersion();
            // A student page left in the background for a while: just pick up the new version
            if (stale && away >= AUTO_RELOAD_AFTER_HIDDEN_MS && location.pathname.startsWith('/student')
                && !isLiveTestPage(location.pathname) && !typedSomething()) {
                reloadOnce();
            }
        };
        // Old version still loaded: let internal links do a full page load (it fetches the new version)
        const onClick = (ev: MouseEvent) => {
            if (!stale || isLiveTestPage(location.pathname)) return;
            const a = (ev.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
            if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
            const url = new URL(a.href, location.href);
            if (url.origin !== location.origin) return;
            ev.preventDefault();
            ev.stopPropagation();
            window.location.href = url.href;
        };

        window.addEventListener('error', onError);
        window.addEventListener('unhandledrejection', onRejection);
        document.addEventListener('visibilitychange', onVisibility);
        document.addEventListener('click', onClick, true);
        return () => {
            window.removeEventListener('error', onError);
            window.removeEventListener('unhandledrejection', onRejection);
            document.removeEventListener('visibilitychange', onVisibility);
            document.removeEventListener('click', onClick, true);
        };
    }, []);
    return null;
}
