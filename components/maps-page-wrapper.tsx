'use client';

import dynamic from 'next/dynamic';
import type { MatchOption } from '@/components/maps-page-client';

// Dynamically import MapsPageClient with SSR disabled to prevent leaflet from running on server
const MapsPageClient = dynamic(
  () => import('@/components/maps-page-client').then((mod) => mod.MapsPageClient),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-muted-foreground">Loading map...</div>
      </div>
    )
  }
);

interface MapsPageWrapperProps {
  matches: MatchOption[];
  defaultMatchId: string;
}

export function MapsPageWrapper({ matches, defaultMatchId }: MapsPageWrapperProps) {
  return <MapsPageClient matches={matches} defaultMatchId={defaultMatchId} />;
}
