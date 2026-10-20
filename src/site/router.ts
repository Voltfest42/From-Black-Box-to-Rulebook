import { useSyncExternalStore } from 'react';

/**
 * Hash-based routing: "#/<page>/<section>". Every URL is served by the same
 * index.html, so the static host needs no rewrite rules.
 */
export interface Route {
  page: string;
  section: string | null;
}

export function parseHash(hash: string): Route {
  const [page = '', section = null] = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  return { page: decodeURIComponent(page), section: section && decodeURIComponent(section) };
}

export function href(page: string, section?: string | null): string {
  return `#/${page}${section ? `/${section}` : ''}`;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  return parseHash(hash);
}

/** Scrolls a section heading into view, leaving room for the sticky top bar on small screens. */
export function scrollToSection(id: string, behavior: ScrollBehavior = 'smooth'): boolean {
  const element = document.getElementById(id);
  if (!element) return false;
  const top = element.getBoundingClientRect().top + window.scrollY - 72;
  window.scrollTo({ top, behavior });
  return true;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
