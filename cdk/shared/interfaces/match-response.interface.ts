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
