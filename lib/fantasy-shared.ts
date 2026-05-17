// Client-safe constants and types for fantasy.
// lib/fantasy.ts pulls in server-only code; this file is safe to import from client components.

export const DEFAULT_BUDGET = 30.0;
// Legacy export — UI now uses per-user budget from server. Kept for any constants references.
export const FANTASY_BUDGET = 30.0;
export const BASE_PRICE = 10.0;
export const MIN_PRICE = 4.0;

export type RoundLite = { id: string; name: string; status: string; display_order: number };

export type PlayerForPicker = {
  id: string;
  name: string;
  team_id: string | null;
  team_name: string | null;
  team_primary: string | null;
  photo_url: string | null;
  price: number;
  last_round_points: number | null;
  total_points: number;
  ownership_pct: number;
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
  last_finished_round: RoundLite | null;
};
