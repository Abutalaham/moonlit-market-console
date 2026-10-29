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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      bot_runs: {
        Row: {
          ended_at: string | null
          ending_wealth: number | null
          id: string
          run_label: string
          stage: string
          started_at: string
          starting_capital: number
          status: string
          summary: Json
        }
        Insert: {
          ended_at?: string | null
          ending_wealth?: number | null
          id?: string
          run_label: string
          stage?: string
          started_at?: string
          starting_capital?: number
          status?: string
          summary?: Json
        }
        Update: {
          ended_at?: string | null
          ending_wealth?: number | null
          id?: string
          run_label?: string
          stage?: string
          started_at?: string
          starting_capital?: number
          status?: string
          summary?: Json
        }
        Relationships: []
      }
      bot_telemetry: {
        Row: {
          engine_status: string
          error_count: number
          gateway_status: string
          heartbeat_age_ms: number | null
          id: number
          kafka_status: string
          last_order_at: string | null
          latest_market_event: Json | null
          processing_latency_ms: number | null
          recorded_at: string
          run_id: string | null
          stage: string | null
        }
        Insert: {
          engine_status?: string
          error_count?: number
          gateway_status?: string
          heartbeat_age_ms?: number | null
          id?: never
          kafka_status?: string
          last_order_at?: string | null
          latest_market_event?: Json | null
          processing_latency_ms?: number | null
          recorded_at?: string
          run_id?: string | null
          stage?: string | null
        }
        Update: {
          engine_status?: string
          error_count?: number
          gateway_status?: string
          heartbeat_age_ms?: number | null
          id?: never
          kafka_status?: string
          last_order_at?: string | null
          latest_market_event?: Json | null
          processing_latency_ms?: number | null
          recorded_at?: string
          run_id?: string | null
          stage?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_telemetry_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "bot_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      order_audit: {
        Row: {
          action: string
          decision_id: number | null
          execution_details: Json | null
          execution_price: number | null
          id: number
          quantity: number
          rejection_code: string | null
          responded_at: string | null
          run_id: string
          status: string
          submitted_at: string
          ticker: string
        }
        Insert: {
          action: string
          decision_id?: number | null
          execution_details?: Json | null
          execution_price?: number | null
          id?: never
          quantity: number
          rejection_code?: string | null
          responded_at?: string | null
          run_id: string
          status?: string
          submitted_at: string
          ticker: string
        }
        Update: {
          action?: string
          decision_id?: number | null
          execution_details?: Json | null
          execution_price?: number | null
          id?: never
          quantity?: number
          rejection_code?: string | null
          responded_at?: string | null
          run_id?: string
          status?: string
          submitted_at?: string
          ticker?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_audit_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "trade_decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_audit_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "bot_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_snapshots: {
        Row: {
          available_cash: number
          holdings_value: number
          id: number
          locked_margin: number
          realized_pnl: number
          recorded_at: string
          run_id: string
          total_wealth: number
          unrealized_pnl: number
        }
        Insert: {
          available_cash: number
          holdings_value?: number
          id?: never
          locked_margin?: number
          realized_pnl?: number
          recorded_at?: string
          run_id: string
          total_wealth: number
          unrealized_pnl?: number
        }
        Update: {
          available_cash?: number
          holdings_value?: number
          id?: never
          locked_margin?: number
          realized_pnl?: number
          recorded_at?: string
          run_id?: string
          total_wealth?: number
          unrealized_pnl?: number
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_snapshots_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "bot_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_configs: {
        Row: {
          enabled_modules: string[]
          id: string
          is_active: boolean
          name: string
          params: Json
          risk_limits: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled_modules?: string[]
          id?: string
          is_active?: boolean
          name: string
          params?: Json
          risk_limits?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled_modules?: string[]
          id?: string
          is_active?: boolean
          name?: string
          params?: Json
          risk_limits?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      trade_decisions: {
        Row: {
          action: string
          decision_latency_ms: number | null
          event_at: string
          id: number
          indicators: Json
          reason: string
          run_id: string
          ticker: string
        }
        Insert: {
          action: string
          decision_latency_ms?: number | null
          event_at: string
          id?: never
          indicators?: Json
          reason: string
          run_id: string
          ticker: string
        }
        Update: {
          action?: string
          decision_latency_ms?: number | null
          event_at?: string
          id?: never
          indicators?: Json
          reason?: string
          run_id?: string
          ticker?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_decisions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "bot_runs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
