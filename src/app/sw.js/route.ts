import { workerSource } from '@/lib/pwa/worker';

// /sw.js: the installed app's service worker (decision 0021). Its version is the deploy's commit, so
// every deploy is a new worker and the app can offer "Reload".
export const dynamic = 'force-static';

export function GET() {
  const version = (process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev').slice(0, 12);
  return new Response(workerSource(version), {
    headers: {
      'content-type': 'text/javascript; charset=utf-8',
      'cache-control': 'no-cache',
      'service-worker-allowed': '/',
    },
  });
}
