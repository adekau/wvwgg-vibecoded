'use client';

import { useEffect, useState } from 'react';
import { Shield, Castle as CastleIcon, Home, Flag } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ObjectivesData {
  red: { keeps: number; towers: number; camps: number; castles: number };
  blue: { keeps: number; towers: number; camps: number; castles: number };
  green: { keeps: number; towers: number; camps: number; castles: number };
}

interface WorldInfo {
  name: string;
  color: 'red' | 'blue' | 'green';
}

interface ObjectivesDisplayProps {
  matchId: string;
  worlds?: WorldInfo[];
}

const colorClasses = {
  red: {
    bg: 'bg-chart-1/18',
    text: 'text-chart-1',
    border: 'border-chart-1/25',
  },
  blue: {
    bg: 'bg-chart-2/18',
    text: 'text-chart-2',
    border: 'border-chart-2/25',
  },
  green: {
    bg: 'bg-chart-3/18',
    text: 'text-chart-3',
    border: 'border-chart-3/25',
  },
};

export function ObjectivesDisplay({ matchId, worlds }: ObjectivesDisplayProps) {
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
      <Card className="panel-border inset-card frosted-panel p-4" style={{ background: 'transparent' }}>
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
    <Card className="panel-border inset-card frosted-panel p-6" style={{ background: 'transparent' }}>
      <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" />
        Map Objectives
      </h3>

      <div className="space-y-4">
        {colors.map((color) => {
          const classes = colorClasses[color];
          const worldInfo = worlds?.find(w => w.color === color);

          return (
            <div
              key={color}
              className={`rounded-md p-4 border ${classes.bg} ${classes.border}`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-sm">{worldInfo?.name || `${color.charAt(0).toUpperCase() + color.slice(1)} Team`}</span>
                <Badge variant="secondary" className="font-mono text-xs">
                  {color.toUpperCase()}
                </Badge>
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
                      <Icon className="h-4 w-4 mb-1 text-foreground" />
                      <div className="text-xs text-muted-foreground">
                        {objectiveLabels[objType]}
                      </div>
                      <div className="font-mono font-bold">{count}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
