// Client-safe constants and types for fantasy.
// lib/fantasy.ts pulls in server-only code; this file is safe to import from client components.

export const DEFAULT_BUDGET = 30.0;
// Legacy export — UI now uses per-user budget from server. Kept for any constants references.
export const FANTASY_BUDGET = 30.0;
export const BASE_PRICE = 10.0;
export const MIN_PRICE = 4.0;

export type RoundLite = { id: string; name: string; status: string; display_order: number };

export type FixtureLite = {
  match_id: string;
  opponent_name: string;
  opponent_short_name: string | null;
  opponent_primary: string | null;
  opponent_secondary: string | null;
  is_home: boolean;
  kickoff_at: string | null;
};

export type PlayerForPicker = {
  id: string;
  name: string;
  team_id: string | null;
  team_name: string | null;
  team_short: string | null;
  team_primary: string | null;
  team_secondary: string | null;
  photo_url: string | null;
  price: number;
  last_round_points: number | null;
  total_points: number;
  ownership_pct: number;
  next_fixtures: FixtureLite[];
};

export type LeagueRanking = {
  league_id: string;
  league_name: string;
  invite_code: string;
  member_count: number;
  my_rank: number;
  my_total: number;
};

export type FantasyOverview = {
  total_points: number;
  last_round_points: number | null;
  last_round_name: string | null;
  overall_rank: number | null;
  overall_total: number;
  leagues: LeagueRanking[];
  next_round: RoundLite | null;
  active_round: RoundLite | null;
  active_round_points: number | null;
  last_finished_round: RoundLite | null;
};
