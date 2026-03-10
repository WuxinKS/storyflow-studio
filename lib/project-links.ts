import type { Route } from 'next';

export type ProjectIdValue = string | string[] | null | undefined;

export function normalizeProjectId(value: ProjectIdValue) {
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === 'string' && item.trim());
    return first?.trim() || undefined;
  }

  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

export function buildProjectHref(path: string, projectId?: ProjectIdValue): Route {
  const normalizedProjectId = normalizeProjectId(projectId);
  if (!normalizedProjectId) return path as Route;

  const [pathWithoutHash, hashFragment] = path.split('#');
  const [pathname, queryString] = pathWithoutHash.split('?');
  const params = new URLSearchParams(queryString || '');
  params.set('projectId', normalizedProjectId);

  const nextQuery = params.toString();
  return `${pathname}${nextQuery ? `?${nextQuery}` : ''}${hashFragment ? `#${hashFragment}` : ''}` as Route;
}
