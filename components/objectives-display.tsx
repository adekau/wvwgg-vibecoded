'use client';

import { useEffect, useState } from 'react';
import { Shield, Castle as CastleIcon, Home, Flag } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface ObjectivesData {
  red: { keeps: number; towers: number; camps: number; castles: number };
  blue: { keeps: number; towers: number; camps: number; castles: number };
  green: { keeps: number; towers: number; camps: number; castles: number };
}

interface ObjectivesDisplayProps {
  matchId: string;
}

export function ObjectivesDisplay({ matchId }: ObjectivesDisplayProps) {
  const [objectives, setObjectives] = useState<ObjectivesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchObjectives = async () => {
      try {
        const response = await fetch(`/api/objectives/${matchId}`);
        if (response.ok) {
          const data = await response.json();
          setObjectives(data.objectives);
        }
      } catch (error) {
        console.error('Failed to fetch objectives:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchObjectives();

    // Refresh objectives every 30 seconds
    const interval = setInterval(fetchObjectives, 30000);
    return () => clearInterval(interval);
  }, [matchId]);

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded w-1/3"></div>
          <div className="space-y-2">
            <div className="h-3 bg-muted rounded"></div>
            <div className="h-3 bg-muted rounded"></div>
            <div className="h-3 bg-muted rounded"></div>
          </div>
        </div>
      </Card>
    );
  }

  if (!objectives) {
    return null;
  }

  const objectiveIcons = {
    castles: CastleIcon,
    keeps: Shield,
    towers: Home,
    camps: Flag,
  };

  const objectiveLabels = {
    castles: 'Castles',
    keeps: 'Keeps',
    towers: 'Towers',
    camps: 'Camps',
  };

  const colors = ['red', 'blue', 'green'] as const;

  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        <Shield className="h-4 w-4" />
        Map Objectives
      </h3>

      <div className="space-y-3">
        {colors.map((color) => (
          <div
            key={color}
            className={`p-3 rounded-lg border ${
              color === 'red'
                ? 'border-red-500/30 bg-red-500/5'
                : color === 'blue'
                ? 'border-blue-500/30 bg-blue-500/5'
                : 'border-green-500/30 bg-green-500/5'
            }`}
          >
            <div className="font-semibold capitalize mb-2 text-sm">
              {color} Team
            </div>

            <div className="grid grid-cols-4 gap-2">
              {(Object.keys(objectiveLabels) as Array<keyof typeof objectiveLabels>).map((objType) => {
                const Icon = objectiveIcons[objType];
                const count = objectives[color][objType];

                return (
                  <div
                    key={objType}
                    className="flex flex-col items-center text-center"
                  >
                    <Icon className={`h-4 w-4 mb-1 ${
                      color === 'red'
                        ? 'text-red-500'
                        : color === 'blue'
                        ? 'text-blue-500'
                        : 'text-green-500'
                    }`} />
                    <div className="text-xs text-muted-foreground">
                      {objectiveLabels[objType]}
                    </div>
                    <div className="font-mono font-bold">{count}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
