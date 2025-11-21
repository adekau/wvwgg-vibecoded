'use client';

import { useState } from 'react';
import { WvWMap } from '@/components/wvw-map';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface MatchOption {
  id: string;
  label: string;
  region: string;
  tier: string;
  worlds: {
    red: string;
    blue: string;
    green: string;
  };
}

interface MapsPageClientProps {
  matches: MatchOption[];
  defaultMatchId: string;
}

export function MapsPageClient({ matches, defaultMatchId }: MapsPageClientProps) {
  const [selectedMatchId, setSelectedMatchId] = useState(defaultMatchId);

  // Ensure matches is always an array (defensive check)
  const safeMatches = Array.isArray(matches) ? matches : [];

  // If no matches available, show a message
  if (safeMatches.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="container mx-auto px-4 py-6 text-center">
          <h1 className="text-3xl font-bold mb-4">Live WvW Map</h1>
          <p className="text-muted-foreground">
            No matches available at the moment. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold">Live WvW Map</h1>
            <p className="text-muted-foreground mt-1">
              Real-time objective tracking across all borderlands
            </p>
          </div>
          <Select value={selectedMatchId} onValueChange={setSelectedMatchId}>
            <SelectTrigger className="w-[400px]">
              <SelectValue placeholder="Select a match" />
            </SelectTrigger>
            <SelectContent>
              {safeMatches.map((match) => (
                <SelectItem key={match.id} value={match.id}>
                  {match.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Map container - full height minus header and title */}
      <div className="flex-1 relative min-h-[600px]">
        <WvWMap key={selectedMatchId} matchId={selectedMatchId} className="absolute inset-0" />
      </div>
    </div>
  );
}
