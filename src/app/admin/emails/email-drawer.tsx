'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Drawer } from '@/components/drawer';

// The selected email opens in a drawer over the journeys (?email=<id>), so the page keeps its place
// and its full width. Closing goes back to /admin/emails without scrolling.
export function EmailDrawer({ title, kicker, footer, children }: { title: string; kicker: string; footer: React.ReactNode; children: React.ReactNode }) {
  const router = useRouter();
  const close = useCallback(() => router.push('/admin/emails', { scroll: false }), [router]);
  return (
    <Drawer title={title} kicker={kicker} onClose={close} footer={footer} wide>
      {children}
    </Drawer>
  );
}
