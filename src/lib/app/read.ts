import 'server-only';
import { cache } from 'react';
import { getAppStore } from './store';

// Reads that the app frame (layout) and the page both make while rendering one request (build plan
// 10.2). cache() runs each once per request. For rendering only: server actions read the store
// directly, so they always see their own writes, and so does a page that writes while it renders
// (Plans syncs the calendar first).

/** The team's practices, newest first. */
export const teamPractices = cache(async (teamId: string) => (await getAppStore()).listPractices(teamId));
