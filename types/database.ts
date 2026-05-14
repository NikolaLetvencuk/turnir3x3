export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      fantasy_league_members: {
        Row: {
          joined_at: string
          league_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          league_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          league_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fantasy_league_members_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "fantasy_leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      fantasy_leagues: {
        Row: {
          created_at: string
          id: string
          invite_code: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invite_code: string
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invite_code?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      fantasy_player_points: {
        Row: {
          assists: number
          clean_sheets: number
          draws: number
          goals: number
          id: string
          own_goals: number
          player_id: string
          red_cards: number
          round_id: string
          total_points: number
          wins: number
          yellow_cards: number
        }
        Insert: {
          assists?: number
          clean_sheets?: number
          draws?: number
          goals?: number
          id?: string
          own_goals?: number
          player_id: string
          red_cards?: number
          round_id: string
          total_points?: number
          wins?: number
          yellow_cards?: number
        }
        Update: {
          assists?: number
          clean_sheets?: number
          draws?: number
          goals?: number
          id?: string
          own_goals?: number
          player_id?: string
          red_cards?: number
          round_id?: string
          total_points?: number
          wins?: number
          yellow_cards?: number
        }
        Relationships: [
          {
            foreignKeyName: "fantasy_player_points_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fantasy_player_points_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      fantasy_round_points: {
        Row: {
          id: string
          player1_points: number
          player2_points: number
          player3_points: number
          round_id: string
          total_points: number
          transfer_penalty: number
          user_id: string
        }
        Insert: {
          id?: string
          player1_points?: number
          player2_points?: number
          player3_points?: number
          round_id: string
          total_points?: number
          transfer_penalty?: number
          user_id: string
        }
        Update: {
          id?: string
          player1_points?: number
          player2_points?: number
          player3_points?: number
          round_id?: string
          total_points?: number
          transfer_penalty?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fantasy_round_points_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      fantasy_team_snapshots: {
        Row: {
          created_at: string
          id: string
          player1_id: string | null
          player2_id: string | null
          player3_id: string | null
          round_id: string
          transfer_penalty: number
          transfers_used: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          player1_id?: string | null
          player2_id?: string | null
          player3_id?: string | null
          round_id: string
          transfer_penalty?: number
          transfers_used?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          player1_id?: string | null
          player2_id?: string | null
          player3_id?: string | null
          round_id?: string
          transfer_penalty?: number
          transfers_used?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fantasy_team_snapshots_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fantasy_team_snapshots_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fantasy_team_snapshots_player3_id_fkey"
            columns: ["player3_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fantasy_team_snapshots_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      fantasy_teams: {
        Row: {
          id: string
          name: string | null
          player1_id: string | null
          player2_id: string | null
          player3_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          name?: string | null
          player1_id?: string | null
          player2_id?: string | null
          player3_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          name?: string | null
          player1_id?: string | null
          player2_id?: string | null
          player3_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fantasy_teams_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fantasy_teams_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fantasy_teams_player3_id_fkey"
            columns: ["player3_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      group_teams: {
        Row: {
          group_id: string
          team_id: string
        }
        Insert: {
          group_id: string
          team_id: string
        }
        Update: {
          group_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_teams_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: true
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          display_order: number
          id: string
          name: string
        }
        Insert: {
          display_order?: number
          id?: string
          name: string
        }
        Update: {
          display_order?: number
          id?: string
          name?: string
        }
        Relationships: []
      }
      match_events: {
        Row: {
          assist_player_id: string | null
          created_at: string
          event_type: string
          id: string
          match_id: string
          minute: number | null
          player_id: string
          team_id: string
        }
        Insert: {
          assist_player_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          match_id: string
          minute?: number | null
          player_id: string
          team_id: string
        }
        Update: {
          assist_player_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          match_id?: string
          minute?: number | null
          player_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_events_assist_player_id_fkey"
            columns: ["assist_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          away_score: number
          away_team_id: string
          bracket_position: string | null
          created_at: string
          finished_at: string | null
          group_id: string | null
          home_score: number
          home_team_id: string
          id: string
          kickoff_at: string | null
          round_id: string
          started_at: string | null
          status: string
        }
        Insert: {
          away_score?: number
          away_team_id: string
          bracket_position?: string | null
          created_at?: string
          finished_at?: string | null
          group_id?: string | null
          home_score?: number
          home_team_id: string
          id?: string
          kickoff_at?: string | null
          round_id: string
          started_at?: string | null
          status?: string
        }
        Update: {
          away_score?: number
          away_team_id?: string
          bracket_position?: string | null
          created_at?: string
          finished_at?: string | null
          group_id?: string | null
          home_score?: number
          home_team_id?: string
          id?: string
          kickoff_at?: string | null
          round_id?: string
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      player_prices: {
        Row: {
          id: string
          player_id: string
          price: number
          round_id: string
        }
        Insert: {
          id?: string
          player_id: string
          price?: number
          round_id: string
        }
        Update: {
          id?: string
          player_id?: string
          price?: number
          round_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_prices_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_prices_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      player_transfers: {
        Row: {
          created_at: string
          id: string
          player_in_id: string | null
          player_out_id: string | null
          round_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          player_in_id?: string | null
          player_out_id?: string | null
          round_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          player_in_id?: string | null
          player_out_id?: string | null
          round_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_transfers_player_in_id_fkey"
            columns: ["player_in_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_transfers_player_out_id_fkey"
            columns: ["player_out_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_transfers_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          created_at: string
          id: string
          name: string
          position: string | null
          team_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: string | null
          team_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          role: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          role?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          role?: string
        }
        Relationships: []
      }
      rounds: {
        Row: {
          display_order: number
          id: string
          locked_at: string | null
          name: string
          stage: string
          starts_at: string | null
          status: string
        }
        Insert: {
          display_order: number
          id?: string
          locked_at?: string | null
          name: string
          stage: string
          starts_at?: string | null
          status?: string
        }
        Update: {
          display_order?: number
          id?: string
          locked_at?: string | null
          name?: string
          stage?: string
          starts_at?: string | null
          status?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          short_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          short_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          short_name?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_invite_code: { Args: never; Returns: string }
      lock_round: { Args: { p_round_id: string }; Returns: undefined }
      recalculate_player_points_for_round: {
        Args: { p_round_id: string }
        Returns: undefined
      }
      recalculate_round: { Args: { p_round_id: string }; Returns: undefined }
      recalculate_user_points_for_round: {
        Args: { p_round_id: string }
        Returns: undefined
      }
      update_player_prices: { Args: { p_round_id: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
