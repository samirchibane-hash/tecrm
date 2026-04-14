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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          account_name: string
          created_at: string
          id: string
        }
        Insert: {
          account_name: string
          created_at?: string
          id?: string
        }
        Update: {
          account_name?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      campaign_notes: {
        Row: {
          account_id: string | null
          account_name: string
          campaign_name: string
          content: string
          created_at: string
          id: string
        }
        Insert: {
          account_id?: string | null
          account_name: string
          campaign_name: string
          content: string
          created_at?: string
          id?: string
        }
        Update: {
          account_id?: string | null
          account_name?: string
          campaign_name?: string
          content?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_notes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_updates: {
        Row: {
          account_id: string | null
          account_name: string
          campaign_name: string
          category: Database["public"]["Enums"]["update_category"]
          created_at: string
          details: string | null
          id: string
          image_url: string | null
          link_url: string | null
          title: string | null
        }
        Insert: {
          account_id?: string | null
          account_name: string
          campaign_name: string
          category?: Database["public"]["Enums"]["update_category"]
          created_at?: string
          details?: string | null
          id?: string
          image_url?: string | null
          link_url?: string | null
          title?: string | null
        }
        Update: {
          account_id?: string | null
          account_name?: string
          campaign_name?: string
          category?: Database["public"]["Enums"]["update_category"]
          created_at?: string
          details?: string | null
          id?: string
          image_url?: string | null
          link_url?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_updates_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      creatives: {
        Row: {
          account_id: string | null
          account_name: string
          batch_name: string
          created_at: string
          file_name: string
          file_type: string
          file_url: string
          id: string
          launch_date: string | null
          notes: string | null
          status: string
        }
        Insert: {
          account_id?: string | null
          account_name: string
          batch_name?: string
          created_at?: string
          file_name: string
          file_type?: string
          file_url: string
          id?: string
          launch_date?: string | null
          notes?: string | null
          status?: string
        }
        Update: {
          account_id?: string | null
          account_name?: string
          batch_name?: string
          created_at?: string
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          launch_date?: string | null
          notes?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "creatives_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ghl_conversions: {
        Row: {
          "Ad Name": string | null
          appointment_status: string | null
          appointment_time: string | null
          contact_address: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: number | null
          created_on: string
          deal_value: number | null
          ghl_contact_id: string
          location_id: string | null
          tecrm_id: string | null
          type: string | null
        }
        Insert: {
          "Ad Name"?: string | null
          appointment_status?: string | null
          appointment_time?: string | null
          contact_address?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: number | null
          created_on: string
          deal_value?: number | null
          ghl_contact_id: string
          location_id?: string | null
          tecrm_id?: string | null
          type?: string | null
        }
        Update: {
          "Ad Name"?: string | null
          appointment_status?: string | null
          appointment_time?: string | null
          contact_address?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: number | null
          created_on?: string
          deal_value?: number | null
          ghl_contact_id?: string
          location_id?: string | null
          tecrm_id?: string | null
          type?: string | null
        }
        Relationships: []
      }
      account_features: {
        Row: {
          id: string
          account_id: string
          call_center_enabled: boolean
          updated_at: string
        }
        Insert: {
          id?: string
          account_id: string
          call_center_enabled?: boolean
          updated_at?: string
        }
        Update: {
          id?: string
          account_id?: string
          call_center_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_features_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      call_center_setters: {
        Row: {
          id: string
          account_id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          account_id: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          account_id?: string
          name?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_center_setters_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      call_center_metrics: {
        Row: {
          id: string
          setter_id: string
          account_id: string
          metric_date: string
          calls_made: number
          appointments_set: number
          installs_generated: number
          unique_leads: number
          updated_at: string
        }
        Insert: {
          id?: string
          setter_id: string
          account_id: string
          metric_date: string
          calls_made?: number
          appointments_set?: number
          installs_generated?: number
          unique_leads?: number
          updated_at?: string
        }
        Update: {
          id?: string
          setter_id?: string
          account_id?: string
          metric_date?: string
          calls_made?: number
          appointments_set?: number
          installs_generated?: number
          unique_leads?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_center_metrics_setter_id_fkey"
            columns: ["setter_id"]
            isOneToOne: false
            referencedRelation: "call_center_setters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_center_metrics_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      call_center_incentives: {
        Row: {
          id: string
          account_id: string
          title: string
          description: string | null
          metric_type: string
          target_value: number
          bonus_amount: number | null
          bonus_description: string | null
          deadline: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          account_id: string
          title: string
          description?: string | null
          metric_type: string
          target_value: number
          bonus_amount?: number | null
          bonus_description?: string | null
          deadline: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          account_id?: string
          title?: string
          description?: string | null
          metric_type?: string
          target_value?: number
          bonus_amount?: number | null
          bonus_description?: string | null
          deadline?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_center_incentives_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          default_campaigns: Json
          enabled_kpis: Json
          hidden_accounts: Json
          id: string
          updated_at: string
          visible_kpis: Json
        }
        Insert: {
          default_campaigns?: Json
          enabled_kpis?: Json
          hidden_accounts?: Json
          id?: string
          updated_at?: string
          visible_kpis?: Json
        }
        Update: {
          default_campaigns?: Json
          enabled_kpis?: Json
          hidden_accounts?: Json
          id?: string
          updated_at?: string
          visible_kpis?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      update_category:
        | "budget_change"
        | "creative_swap"
        | "audience_update"
        | "bid_change"
        | "status_change"
        | "other"
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
    Enums: {
      update_category: [
        "budget_change",
        "creative_swap",
        "audience_update",
        "bid_change",
        "status_change",
        "other",
      ],
    },
  },
} as const
