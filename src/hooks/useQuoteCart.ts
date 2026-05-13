import { useEffect, useState, useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'femavi:quote-cart';
const SYNC_EVENT = 'femavi-quote-cart-change';

function readStorage(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeStorage(slugs: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs));
  window.dispatchEvent(new CustomEvent(SYNC_EVENT));
}

function subscribe(cb: () => void) {
  const handler = () => cb();
  window.addEventListener(SYNC_EVENT, handler);
  // Cross-tab sync
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(SYNC_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}

// Stable empty snapshot for SSR / initial render
const EMPTY_SNAPSHOT: string[] = [];
let cachedSnapshot: string[] | null = null;
let cachedRaw = '';

function getSnapshot(): string[] {
  if (typeof window === 'undefined') return EMPTY_SNAPSHOT;
  const raw = localStorage.getItem(STORAGE_KEY) ?? '';
  if (raw === cachedRaw && cachedSnapshot) return cachedSnapshot;
  cachedRaw = raw;
  cachedSnapshot = readStorage();
  return cachedSnapshot;
}

function getServerSnapshot(): string[] {
  return EMPTY_SNAPSHOT;
}

export function useQuoteCart() {
  const slugs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const add = useCallback((slug: string) => {
    const current = readStorage();
    if (!current.includes(slug)) writeStorage([...current, slug]);
  }, []);

  const remove = useCallback((slug: string) => {
    writeStorage(readStorage().filter(s => s !== slug));
  }, []);

  const toggle = useCallback((slug: string) => {
    const current = readStorage();
    if (current.includes(slug)) writeStorage(current.filter(s => s !== slug));
    else writeStorage([...current, slug]);
  }, []);

  const clear = useCallback(() => writeStorage([]), []);

  const has = useCallback((slug: string) => slugs.includes(slug), [slugs]);

  return { slugs, count: slugs.length, add, remove, toggle, clear, has };
}

/**
 * Useful when callers want to mount only after hydration to avoid SSR mismatch
 * issues. We're CSR-only so this is mostly cosmetic.
 */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
