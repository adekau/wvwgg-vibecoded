'use client';

import { useEffect, useState, useMemo, useTransition } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Clock, Calendar } from 'lucide-react';

interface HistoryDataPoint {
  timestamp: number;
  red: { score: number; kills: number; deaths: number; victoryPoints: number };
  blue: { score: number; kills: number; deaths: number; victoryPoints: number };
  green: { score: number; kills: number; deaths: number; victoryPoints: number };
}

interface MatchHistoryChartProps {
  matchId: string;
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

export function MatchHistoryChart({ matchId }: MatchHistoryChartProps) {
  const [history, setHistory] = useState<HistoryDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<24 | 72 | 168>(24); // 24h, 72h (3d), 168h (7d)
  const [metric, setMetric] = useState<'score' | 'kills' | 'deaths' | 'kd' | 'victoryPoints'>('score');
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/history/${matchId}?hours=${timeRange}`);
        if (response.ok) {
          const data = await response.json();
          setHistory(data.history || []);
        }
      } catch (error) {
        console.error('Failed to fetch history:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();

    // Refresh every 5 minutes
    const interval = setInterval(fetchHistory, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [matchId, timeRange]);

  // Transform data for chart (memoized to prevent expensive recalculations)
  // Must be called before any conditional returns (Rules of Hooks)
  const chartData = useMemo(() => {
    return history.map((point) => {
      const getValue = (color: 'red' | 'blue' | 'green') => {
        if (metric === 'kd') {
          const kills = point[color].kills;
          const deaths = point[color].deaths;
          return deaths > 0 ? Number((kills / deaths).toFixed(2)) : kills;
        }
        return point[color][metric];
      };

      return {
        time: new Date(point.timestamp).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          month: 'short',
          day: 'numeric',
        }),
        timestamp: point.timestamp,
        Red: getValue('red'),
        Blue: getValue('blue'),
        Green: getValue('green'),
      };
    });
  }, [history, metric]);

  // Calculate stats (memoized to prevent expensive recalculations)
  // Must be called before any conditional returns (Rules of Hooks)
  const leadTimePercentage = useMemo(() => {
    const leadTime = { red: 0, blue: 0, green: 0 };
    let lastLeader: 'red' | 'blue' | 'green' | null = null;
    let lastTimestamp = 0;

    history.forEach((point, index) => {
      // Get values based on current metric
      const values = {
        red: metric === 'kd'
          ? (point.red.deaths > 0 ? point.red.kills / point.red.deaths : point.red.kills)
          : point.red[metric],
        blue: metric === 'kd'
          ? (point.blue.deaths > 0 ? point.blue.kills / point.blue.deaths : point.blue.kills)
          : point.blue[metric],
        green: metric === 'kd'
          ? (point.green.deaths > 0 ? point.green.kills / point.green.deaths : point.green.kills)
          : point.green[metric],
      };

      const leader = (Object.keys(values) as Array<'red' | 'blue' | 'green'>).reduce((a, b) =>
        values[a] > values[b] ? a : b
      );

      if (index > 0 && lastLeader) {
        const timeDiff = point.timestamp - lastTimestamp;
        leadTime[lastLeader] += timeDiff;
      }

      lastLeader = leader;
      lastTimestamp = point.timestamp;
    });

    const total = leadTime.red + leadTime.blue + leadTime.green;
    return {
      red: total > 0 ? Math.round((leadTime.red / total) * 100) : 0,
      blue: total > 0 ? Math.round((leadTime.blue / total) * 100) : 0,
      green: total > 0 ? Math.round((leadTime.green / total) * 100) : 0,
    };
  }, [history, metric]);

  if (isLoading) {
    return (
      <Card className="panel-border inset-card frosted-panel p-6" style={{ background: 'transparent' }}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-muted rounded w-1/3"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card className="panel-border inset-card frosted-panel p-6" style={{ background: 'transparent' }}>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h3 className="text-xl font-bold">Match History</h3>
        </div>
        <p className="text-muted-foreground text-sm">
          Historical data will be available soon. Snapshots are captured hourly.
        </p>
      </Card>
    );
  }

  const metricLabels = {
    score: 'Total Score',
    kills: 'Kills',
    deaths: 'Deaths',
    kd: 'K/D Ratio',
    victoryPoints: 'Victory Points',
  };

  return (
    <Card className="panel-border inset-card frosted-panel p-6" style={{ background: 'transparent' }}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h3 className="text-xl font-bold">Match History</h3>
          </div>

          <div className="flex items-center gap-2">
            {/* Time Range Selector */}
            <div className="flex gap-1">
              <Button
                variant={timeRange === 24 ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  startTransition(() => {
                    setTimeRange(24);
                  });
                }}
              >
                <Clock className="h-3 w-3 mr-1" />
                24h
              </Button>
              <Button
                variant={timeRange === 72 ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  startTransition(() => {
                    setTimeRange(72);
                  });
                }}
              >
                <Calendar className="h-3 w-3 mr-1" />
                3d
              </Button>
              <Button
                variant={timeRange === 168 ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  startTransition(() => {
                    setTimeRange(168);
                  });
                }}
              >
                <Calendar className="h-3 w-3 mr-1" />
                7d
              </Button>
            </div>

            {/* Metric Selector */}
            <select
              className="text-sm border rounded px-2 py-1 bg-background"
              value={metric}
              onChange={(e) => {
                startTransition(() => {
                  setMetric(e.target.value as any);
                });
              }}
            >
              <option value="score">Total Score</option>
              <option value="kills">Kills</option>
              <option value="deaths">Deaths</option>
              <option value="kd">K/D Ratio</option>
              <option value="victoryPoints">Victory Points</option>
            </select>
          </div>
        </div>

        {/* Lead Time Stats */}
        <div className="grid grid-cols-3 gap-3">
          {(['red', 'blue', 'green'] as const).map((color) => {
            const classes = colorClasses[color];
            return (
              <div
                key={color}
                className={`rounded-md p-4 border ${classes.bg} ${classes.border}`}
              >
                <div className="text-xs text-muted-foreground mb-1">
                  {color.charAt(0).toUpperCase() + color.slice(1)} Team Lead Time
                </div>
                <div className="text-2xl font-bold font-mono">
                  {leadTimePercentage[color]}%
                </div>
              </div>
            );
          })}
        </div>

        {/* Chart */}
        <div className="h-80" style={{ opacity: isPending ? 0.6 : 1, transition: 'opacity 150ms' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="Red"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="Blue"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="Green"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Data points captured hourly • Last {history.length} snapshots shown
        </p>
      </div>
    </Card>
  );
}
