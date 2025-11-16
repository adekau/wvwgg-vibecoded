'use client';

import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, TrendingUp, Activity, Users } from 'lucide-react';

interface WorldData {
  name: string;
  kills: number;
  deaths: number;
  color: 'red' | 'blue' | 'green';
  score?: number;
  victoryPoints?: number;
  ratio?: number;
  activity?: number;
  population?: string;
}

interface EnhancedMatchCardProps {
  tier: string;
  worlds: WorldData[];
}

export function EnhancedMatchCard({ tier, worlds }: EnhancedMatchCardProps) {
  const router = useRouter();
  // Sort worlds by score to determine rankings
  const rankedWorlds = [...worlds].sort((a, b) => (b.score || 0) - (a.score || 0));

  // Calculate deltas from leader
  const leaderScore = rankedWorlds[0]?.score || 0;

  const getRankIcon = (rank: number) => {
    if (rank === 0) return '🥇';
    if (rank === 1) return '🥈';
    if (rank === 2) return '🥉';
    return '';
  };

  const getActivityLevel = (activity?: number) => {
    if (!activity) return 'Low';
    if (activity > 30000) return 'Very High';
    if (activity > 25000) return 'High';
    if (activity > 20000) return 'Medium';
    return 'Low';
  };

  const getActivityColor = (activity?: number) => {
    if (!activity) return 'text-muted-foreground';
    if (activity > 30000) return 'text-green-500';
    if (activity > 25000) return 'text-blue-500';
    if (activity > 20000) return 'text-yellow-500';
    return 'text-muted-foreground';
  };

  return (
    <Card
      className="frosted-panel inset-card panel-border overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer group"
      onClick={() => router.push(`/matches/${tier}`)}
      style={{ background: 'transparent' }}
    >
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg group-hover:text-primary transition-colors">{tier}</h3>
          <Badge variant="outline" className="font-mono">
            <span className="relative flex h-2 w-2 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            Live
          </Badge>
        </div>

        {/* Teams */}
        <div className="space-y-3">
          {rankedWorlds.map((world, index) => {
            const rank = index;
            const scoreDelta = leaderScore - (world.score || 0);

            return (
              <div
                key={world.color}
                className={`p-3 rounded-lg border-2 ${
                  world.color === 'red'
                    ? 'border-red-500/30 bg-red-500/5'
                    : world.color === 'blue'
                    ? 'border-blue-500/30 bg-blue-500/5'
                    : 'border-green-500/30 bg-green-500/5'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{getRankIcon(rank)}</span>
                      <h4 className="font-semibold">{world.name}</h4>
                    </div>

                    {/* Stats Row */}
                    <div className="flex flex-wrap gap-3 text-sm">
                      {/* Score */}
                      {world.score !== undefined && (
                        <div className="flex items-center gap-1">
                          <Trophy className="h-3 w-3 text-muted-foreground" />
                          <span className="font-mono font-semibold">
                            {world.score.toLocaleString()}
                          </span>
                          {scoreDelta > 0 && (
                            <span className="text-muted-foreground text-xs">
                              (-{scoreDelta.toLocaleString()})
                            </span>
                          )}
                        </div>
                      )}

                      {/* K/D Ratio */}
                      {world.ratio !== undefined && (
                        <div className="flex items-center gap-1">
                          <TrendingUp className={`h-3 w-3 ${
                            world.ratio > 1 ? 'text-green-500' :
                            world.ratio > 0.8 ? 'text-yellow-500' :
                            'text-red-500'
                          }`} />
                          <span className="font-mono">
                            {world.ratio.toFixed(2)} K/D
                          </span>
                        </div>
                      )}

                      {/* Activity */}
                      {world.activity !== undefined && (
                        <div className="flex items-center gap-1">
                          <Activity className={`h-3 w-3 ${getActivityColor(world.activity)}`} />
                          <span className={getActivityColor(world.activity)}>
                            {getActivityLevel(world.activity)}
                          </span>
                        </div>
                      )}

                      {/* Population */}
                      {world.population && (
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {world.population}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Victory Points */}
                  {world.victoryPoints !== undefined && (
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">VP</div>
                      <div className="font-mono font-bold text-lg">
                        {world.victoryPoints}
                      </div>
                    </div>
                  )}
                </div>

                {/* Kills/Deaths Bar */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono w-20">
                    {world.kills.toLocaleString()} K
                  </span>
                  <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        world.color === 'red'
                          ? 'bg-red-500'
                          : world.color === 'blue'
                          ? 'bg-blue-500'
                          : 'bg-green-500'
                      }`}
                      style={{
                        width: `${Math.min(100, (world.ratio || 0) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="font-mono w-20 text-right">
                    {world.deaths.toLocaleString()} D
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
