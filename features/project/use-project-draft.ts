"use client";

import { useEffect, useState } from 'react';
import { PROJECT_DRAFT_KEY, ProjectDraft, defaultProjectDraft } from '@/features/project/draft';

export function useProjectDraft() {
  const [draft, setDraft] = useState<ProjectDraft>(defaultProjectDraft);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PROJECT_DRAFT_KEY);
      if (raw) {
        setDraft({ ...defaultProjectDraft, ...JSON.parse(raw) });
      }
    } catch {
      // ignore malformed local state
    } finally {
      setReady(true);
    }
  }, []);

  const persist = (next: ProjectDraft) => {
    setDraft(next);
    window.localStorage.setItem(PROJECT_DRAFT_KEY, JSON.stringify(next));
  };

  const reset = () => {
    setDraft(defaultProjectDraft);
    window.localStorage.setItem(PROJECT_DRAFT_KEY, JSON.stringify(defaultProjectDraft));
  };

  return { draft, persist, reset, ready };
}
