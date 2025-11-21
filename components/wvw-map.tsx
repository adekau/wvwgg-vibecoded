'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// TypeScript interfaces
export interface GW2Coordinate {
  x: number;
  y: number;
}

export interface GW2Objective {
  id: string;
  name: string;
  type: 'Camp' | 'Tower' | 'Keep' | 'Castle';
  coord: [number, number];
  owner: 'Red' | 'Blue' | 'Green' | 'Neutral';
  last_flipped: string;
  claimed_by?: string;
  claimed_at?: string;
  points_tick: number;
  points_capture: number;
  yaks_delivered?: number;
  guild_upgrades?: number[];
  map_id: number;
  map_type: 'Center' | 'RedHome' | 'BlueHome' | 'GreenHome';
}

export interface GuildInfo {
  id: string;
  name: string;
  tag: string;
}

export interface WvWMapProps {
  matchId: string;
  className?: string;
}

type ObjectiveType = 'camp' | 'tower' | 'keep' | 'castle';
type TeamColor = 'green' | 'blue' | 'red' | 'neutral';

interface MapIcons {
  [key: string]: {
    [key: string]: L.Icon;
  };
}

export function WvWMap({ matchId, className = '' }: WvWMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const iconsRef = useRef<MapIcons | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [objectiveInfo, setObjectiveInfo] = useState<{ [key: string]: GW2Objective }>({});
  const [isMapReady, setIsMapReady] = useState(false);

  // Coordinate unprojection utility - converts GW2 coordinates to Leaflet coordinates
  const unproject = useCallback((coord: [number, number]): L.LatLng => {
    if (!mapRef.current) return L.latLng(0, 0);
    return mapRef.current.unproject(coord, mapRef.current.getMaxZoom());
  }, []);

  // Prepare map icons for all objective types and team colors
  const prepareIcons = useCallback((): MapIcons => {
    const types: ObjectiveType[] = ['camp', 'tower', 'keep', 'castle'];
    const colors: TeamColor[] = ['green', 'blue', 'red', 'neutral'];
    const icons: MapIcons = {
      claimed: {},
    };

    for (const type of types) {
      icons[type] = {};
      icons.claimed[type] = {};

      for (const color of colors) {
        // Regular icons
        icons[type][color] = L.icon({
          iconUrl: `/img/objectives/${type}_${color}.png`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });

        // Claimed icons with shadow overlay
        icons.claimed[type][color] = L.icon({
          iconUrl: `/img/objectives/${type}_${color}.png`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
          shadowUrl: '/img/objectives/claimed.svg',
          shadowSize: [12, 12],
          shadowAnchor: [18, 18],
        });
      }
    }

    return icons;
  }, []);

  // Format relative time (e.g., "5 minutes ago")
  const formatRelativeTime = useCallback((timestamp: string): string => {
    const now = new Date().getTime();
    const then = new Date(timestamp).getTime();
    const elapsed = now - then;

    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    return `approximately ${days} day${days !== 1 ? 's' : ''} ago`;
  }, []);

  // Initialize the Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Create map with Simple CRS for GW2's coordinate system
    const map = L.map(mapContainerRef.current, {
      minZoom: 0,
      maxZoom: 6,
      crs: L.CRS.Simple,
      maxBoundsViscosity: 1.0,
    });

    // Set map bounds to GW2's map coordinate space
    const southWest = map.unproject([0, 16384], map.getMaxZoom());
    const northEast = map.unproject([16384, 8192], map.getMaxZoom());
    const bounds = L.latLngBounds(southWest, northEast);
    map.setMaxBounds(bounds);

    // Center the map on the bounds with appropriate zoom level for overview
    map.fitBounds(bounds);
    map.setZoom(1); // Lower zoom level to see more of the map

    // Add GW2 tile layer
    L.tileLayer('https://{s}.guildwars2.com/2/1/{z}/{x}/{y}.jpg', {
      minZoom: 0,
      maxZoom: 6,
      subdomains: ['tiles', 'tiles1', 'tiles2', 'tiles3', 'tiles4'],
    }).addTo(map);

    mapRef.current = map;
    iconsRef.current = prepareIcons();
    setIsMapReady(true);

    // Cleanup on unmount
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [prepareIcons]);

  // Update objective marker
  const updateObjectiveMarker = useCallback(
    (objective: GW2Objective, objectiveDefinition: GW2Objective) => {
      if (!mapRef.current || !iconsRef.current) return;

      const objId = objective.id;
      const owner = objective.owner.toLowerCase() as TeamColor;
      const type = objective.type.toLowerCase() as ObjectiveType;
      const isClaimed = !!objective.claimed_by;

      // Create marker if it doesn't exist
      if (!markersRef.current[objId]) {
        const marker = L.marker(unproject(objectiveDefinition.coord), {
          title: objectiveDefinition.name,
          icon: iconsRef.current[type].neutral,
        }).addTo(mapRef.current);

        markersRef.current[objId] = marker;
      }

      const marker = markersRef.current[objId];

      // Update icon based on ownership and claimed status
      const icon = isClaimed
        ? iconsRef.current.claimed[type][owner]
        : iconsRef.current[type][owner];
      marker.setIcon(icon);

      // Build popup content
      const lastFlipped = formatRelativeTime(objective.last_flipped);
      let popupContent = `
        <div style="min-width: 200px;">
          <center><b>${objectiveDefinition.name}</b></center><br />
          Last flipped <b>${lastFlipped}</b><br />
          Points Per Tick: <b>${objective.points_tick}</b><br />
          Points for Capture: <b>${objective.points_capture}</b><br />
      `;

      if (objective.yaks_delivered !== undefined) {
        popupContent += `Yaks: <b>${objective.yaks_delivered}</b><br />`;
      }

      // Add guild info if claimed (would need to fetch from API)
      if (objective.claimed_by) {
        popupContent += `Claimed by Guild: <b>${objective.claimed_by}</b><br />`;
      }

      popupContent += `</div>`;

      marker.unbindPopup();
      marker.bindPopup(popupContent);
    },
    [unproject, formatRelativeTime]
  );

  // Update recapture immunity timers
  const updateTimers = useCallback(() => {
    if (!mapRef.current || !iconsRef.current) return;

    Object.entries(objectiveInfo).forEach(([objId, objective]) => {
      const marker = markersRef.current[objId];
      if (!marker) return;

      const lastFlipped = new Date(objective.last_flipped).getTime();
      const now = new Date().getTime();
      const timeOwnedSeconds = Math.floor((now - lastFlipped) / 1000);

      // 5 minute (300 second) recapture immunity
      if (timeOwnedSeconds < 300) {
        const riTime = 300 - timeOwnedSeconds;
        const minutes = Math.floor(riTime / 60);
        const seconds = riTime % 60;
        const labelText = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        marker.unbindTooltip();
        marker.bindTooltip(labelText, {
          permanent: true,
          className: 'recapture-timer',
          direction: 'left',
          offset: [23, 23],
        }).openTooltip();
      } else {
        marker.unbindTooltip();
      }
    });
  }, [objectiveInfo]);

  // Start timer updates when objectives are loaded
  useEffect(() => {
    if (Object.keys(objectiveInfo).length === 0) return;

    // Update timers every second
    timerIntervalRef.current = setInterval(updateTimers, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [updateTimers, objectiveInfo]);

  // Fetch objectives data from API
  useEffect(() => {
    if (!isMapReady || !matchId) return;

    let isMounted = true;

    const fetchObjectives = async () => {
      try {
        const response = await fetch(`/api/map-objectives/${matchId}`);
        if (!response.ok) {
          console.error('Failed to fetch objectives, status:', response.status);
          return;
        }

        const data = await response.json();
        const allObjectives = data.objectives as GW2Objective[];

        // Filter to only show Eternal Battlegrounds (Center) objectives
        // since our tile layer only shows floor 1 (EB)
        const objectives = allObjectives.filter(obj => obj.map_type === 'Center');

        if (!isMounted) return;

        // Create objective info map and update markers
        const objInfo: { [key: string]: GW2Objective } = {};

        objectives.forEach((obj) => {
          objInfo[obj.id] = obj;
          updateObjectiveMarker(obj, obj);
        });

        setObjectiveInfo(objInfo);
      } catch (error) {
        console.error('Error fetching objectives:', error);
      }
    };

    // Initial fetch
    fetchObjectives();

    // Poll every 10 seconds for real-time updates
    const interval = setInterval(fetchObjectives, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isMapReady, matchId, updateObjectiveMarker]);

  return (
    <>
      <div ref={mapContainerRef} className={`w-full h-full ${className}`} />
      <style jsx global>{`
        .leaflet-container {
          background: #1a1a1a;
          font-family: inherit;
        }

        .recapture-timer {
          background-color: rgba(255, 255, 255, 0.6);
          border: none;
          padding: 5px;
          padding-top: 2px;
          padding-bottom: 2px;
          font-weight: 600;
          font-size: 12px;
        }

        .leaflet-tooltip-left.recapture-timer::before {
          border-left: none;
        }

        .leaflet-tooltip-right.recapture-timer::before {
          border-right: none;
        }

        /* Dark mode support for popups */
        .dark .leaflet-popup-content-wrapper {
          background-color: rgba(30, 30, 30, 0.95);
          color: #fff;
        }

        .dark .leaflet-popup-tip {
          background-color: rgba(30, 30, 30, 0.95);
        }
      `}</style>
    </>
  );
}
