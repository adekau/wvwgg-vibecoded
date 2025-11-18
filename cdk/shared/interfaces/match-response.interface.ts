export interface IMatchResponse {
  id: string;
  start_time: string;
  end_time: string;
  worlds: {
    red: number;
    blue: number;
    green: number;
  };
  all_worlds: {
    red: number[];
    blue: number[];
    green: number[];
  };
  kills: {
    red: number;
    blue: number;
    green: number;
  };
  deaths: {
    red: number;
    blue: number;
    green: number;
  };
  victory_points: {
    red: number;
    blue: number;
    green: number;
  };
  maps: Array<{
    id: number;
    type: string;
    scores: {
      red: number;
      blue: number;
      green: number;
    };
    kills: {
      red: number;
      blue: number;
      green: number;
    };
    deaths: {
      red: number;
      blue: number;
      green: number;
    };
    objectives?: Array<{
      id: string;
      type: string;
      owner?: string;
      points_tick?: number;
      points_capture?: number;
      last_flipped?: string;
      claimed_by?: string;
      claimed_at?: string;
      guild_upgrades?: number[];
      yaks_delivered?: number;
    }>;
  }>;
  skirmishes: Array<{
    id: number;
    scores: {
      red: number;
      blue: number;
      green: number;
    };
    map_scores: Array<{
      type: string;
      scores: {
        red: number;
        blue: number;
        green: number;
      };
    }>;
  }>;
}
