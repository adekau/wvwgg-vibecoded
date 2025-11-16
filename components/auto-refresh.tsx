'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AutoRefreshProps {
  interval?: number; // milliseconds
}

export function AutoRefresh({ interval = 60000 }: AutoRefreshProps) {
  const router = useRouter();
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [timeAgo, setTimeAgo] = useState<string>('just now');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Auto-refresh on interval
  useEffect(() => {
    const timer = setInterval(() => {
      router.refresh();
      setLastUpdate(new Date());
    }, interval);

    return () => clearInterval(timer);
  }, [interval, router]);

  // Update "time ago" display every second
  useEffect(() => {
    const updateTimeAgo = () => {
      const seconds = Math.floor((Date.now() - lastUpdate.getTime()) / 1000);

      if (seconds < 5) {
        setTimeAgo('just now');
      } else if (seconds < 60) {
        setTimeAgo(`${seconds}s ago`);
      } else {
        const minutes = Math.floor(seconds / 60);
        setTimeAgo(`${minutes}m ago`);
      }
    };

    updateTimeAgo();
    const timer = setInterval(updateTimeAgo, 1000);

    return () => clearInterval(timer);
  }, [lastUpdate]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    router.refresh();
    setLastUpdate(new Date());

    // Show spinner for at least 500ms for better UX
    setTimeout(() => {
      setIsRefreshing(false);
    }, 500);
  };

  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span>Last updated: {timeAgo}</span>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={handleManualRefresh}
        disabled={isRefreshing}
        className="h-8"
      >
        <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
        Refresh
      </Button>
    </div>
  );
}
