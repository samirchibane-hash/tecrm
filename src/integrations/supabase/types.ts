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
      account_features: {
        Row: {
          account_id: string
          call_center_enabled: boolean
          id: string
          updated_at: string
        }
        Insert: {
          account_id: string
          call_center_enabled?: boolean
          id?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          call_center_enabled?: boolean
          id?: string
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
      account_links: {
        Row: {
          account_name: string
          created_at: string | null
          id: string
          label: string
          url: string
        }
        Insert: {
          account_name: string
          created_at?: string | null
          id?: string
          label: string
          url: string
        }
        Update: {
          account_name?: string
          created_at?: string | null
          id?: string
          label?: string
          url?: string
        }
        Relationships: []
      }
      account_poc: {
        Row: {
          account_id: string
          created_at: string
          email: string
          id: string
          name: string
        }
        Insert: {
          account_id: string
          created_at?: string
          email: string
          id?: string
          name: string
        }
        Update: {
          account_id?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      accounts: {
        Row: {
          account_name: string
          created_at: string
          fb_ad_account_id: string | null
          ghl_location_id: string | null
          id: string
        }
        Insert: {
          account_name: string
          created_at?: string
          fb_ad_account_id?: string | null
          ghl_location_id?: string | null
          id?: string
        }
        Update: {
          account_name?: string
          created_at?: string
          fb_ad_account_id?: string | null
          ghl_location_id?: string | null
          id?: string
        }
        Relationships: []
      }
      call_center_incentives: {
        Row: {
          account_id: string
          bonus_amount: number | null
          bonus_description: string | null
          created_at: string
          deadline: string
          description: string | null
          id: string
          is_active: boolean
          metric_type: string
          participant_ids: Json | null
          target_type: string
          target_value: number | null
          title: string
          updated_at: string
        }
        Insert: {
          account_id: string
          bonus_amount?: number | null
          bonus_description?: string | null
          created_at?: string
          deadline: string
          description?: string | null
          id?: string
          is_active?: boolean
          metric_type: string
          participant_ids?: Json | null
          target_type?: string
          target_value?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          bonus_amount?: number | null
          bonus_description?: string | null
          created_at?: string
          deadline?: string
          description?: string | null
          id?: string
          is_active?: boolean
          metric_type?: string
          participant_ids?: Json | null
          target_type?: string
          target_value?: number | null
          title?: string
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
      call_center_metrics: {
        Row: {
          account_id: string
          appointments_set: number
          calls_made: number
          id: string
          installs_generated: number
          metric_date: string
          setter_id: string
          unique_leads: number
          updated_at: string
        }
        Insert: {
          account_id: string
          appointments_set?: number
          calls_made?: number
          id?: string
          installs_generated?: number
          metric_date: string
          setter_id: string
          unique_leads?: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          appointments_set?: number
          calls_made?: number
          id?: string
          installs_generated?: number
          metric_date?: string
          setter_id?: string
          unique_leads?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_center_metrics_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_center_metrics_setter_id_fkey"
            columns: ["setter_id"]
            isOneToOne: false
            referencedRelation: "call_center_setters"
            referencedColumns: ["id"]
          },
        ]
      }
      call_center_setters: {
        Row: {
          account_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          name?: string
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
          emailed_at: string | null
          id: string
          image_url: string | null
          link_url: string | null
          status: string
          title: string | null
        }
        Insert: {
          account_id?: string | null
          account_name: string
          campaign_name: string
          category?: Database["public"]["Enums"]["update_category"]
          created_at?: string
          details?: string | null
          emailed_at?: string | null
          id?: string
          image_url?: string | null
          link_url?: string | null
          status?: string
          title?: string | null
        }
        Update: {
          account_id?: string | null
          account_name?: string
          campaign_name?: string
          category?: Database["public"]["Enums"]["update_category"]
          created_at?: string
          details?: string | null
          emailed_at?: string | null
          id?: string
          image_url?: string | null
          link_url?: string | null
          status?: string
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
      clients: {
        Row: {
          account_id: string | null
          ad_budget: string | null
          additional_notes: string | null
          amount_paid: number | null
          brands: Json | null
          business_email: string | null
          business_hours: Json | null
          business_name: string | null
          business_phone: string | null
          business_type: string | null
          city: string | null
          currency: string | null
          ein: string | null
          email: string | null
          facebook_url: string | null
          full_name: string | null
          gdrive_folder_url: string | null
          has_facebook: boolean | null
          id: string
          legal_business_name: string | null
          offers: Json | null
          onboarding_link: string | null
          owner_cell: string | null
          owner_email: string | null
          owner_name: string | null
          phone: string | null
          plan: string | null
          service: string | null
          service_area: string | null
          session_id: string
          state: string | null
          status: string | null
          submitted_at: string | null
          website_url: string | null
        }
        Insert: {
          account_id?: string | null
          ad_budget?: string | null
          additional_notes?: string | null
          amount_paid?: number | null
          brands?: Json | null
          business_email?: string | null
          business_hours?: Json | null
          business_name?: string | null
          business_phone?: string | null
          business_type?: string | null
          city?: string | null
          currency?: string | null
          ein?: string | null
          email?: string | null
          facebook_url?: string | null
          full_name?: string | null
          gdrive_folder_url?: string | null
          has_facebook?: boolean | null
          id?: string
          legal_business_name?: string | null
          offers?: Json | null
          onboarding_link?: string | null
          owner_cell?: string | null
          owner_email?: string | null
          owner_name?: string | null
          phone?: string | null
          plan?: string | null
          service?: string | null
          service_area?: string | null
          session_id: string
          state?: string | null
          status?: string | null
          submitted_at?: string | null
          website_url?: string | null
        }
        Update: {
          account_id?: string | null
          ad_budget?: string | null
          additional_notes?: string | null
          amount_paid?: number | null
          brands?: Json | null
          business_email?: string | null
          business_hours?: Json | null
          business_name?: string | null
          business_phone?: string | null
          business_type?: string | null
          city?: string | null
          currency?: string | null
          ein?: string | null
          email?: string | null
          facebook_url?: string | null
          full_name?: string | null
          gdrive_folder_url?: string | null
          has_facebook?: boolean | null
          id?: string
          legal_business_name?: string | null
          offers?: Json | null
          onboarding_link?: string | null
          owner_cell?: string | null
          owner_email?: string | null
          owner_name?: string | null
          phone?: string | null
          plan?: string | null
          service?: string | null
          service_area?: string | null
          session_id?: string
          state?: string | null
          status?: string | null
          submitted_at?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_batches: {
        Row: {
          account_name: string
          ad_angle: string
          ad_type: string
          created_at: string
          file_count: number
          gdrive_folder_id: string | null
          gdrive_folder_url: string | null
          id: string
          notes: string | null
          offer_type: string
          template_name: string
        }
        Insert: {
          account_name: string
          ad_angle: string
          ad_type: string
          created_at?: string
          file_count?: number
          gdrive_folder_id?: string | null
          gdrive_folder_url?: string | null
          id?: string
          notes?: string | null
          offer_type: string
          template_name: string
        }
        Update: {
          account_name?: string
          ad_angle?: string
          ad_type?: string
          created_at?: string
          file_count?: number
          gdrive_folder_id?: string | null
          gdrive_folder_url?: string | null
          id?: string
          notes?: string | null
          offer_type?: string
          template_name?: string
        }
        Relationships: []
      }
      creative_uploads: {
        Row: {
          batch_id: string
          created_at: string
          file_name: string
          file_size: number | null
          gdrive_file_id: string | null
          gdrive_view_url: string | null
          id: string
          mime_type: string | null
          storage_path: string | null
          storage_url: string | null
        }
        Insert: {
          batch_id: string
          created_at?: string
          file_name: string
          file_size?: number | null
          gdrive_file_id?: string | null
          gdrive_view_url?: string | null
          id?: string
          mime_type?: string | null
          storage_path?: string | null
          storage_url?: string | null
        }
        Update: {
          batch_id?: string
          created_at?: string
          file_name?: string
          file_size?: number | null
          gdrive_file_id?: string | null
          gdrive_view_url?: string | null
          id?: string
          mime_type?: string | null
          storage_path?: string | null
          storage_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creative_uploads_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "creative_batches"
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
      onboarding_comments: {
        Row: {
          author: string
          client_id: string
          content: string
          created_at: string
          id: string
        }
        Insert: {
          author: string
          client_id: string
          content: string
          created_at?: string
          id?: string
        }
        Update: {
          author?: string
          client_id?: string
          content?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      onboarding_progress: {
        Row: {
          client_id: string
          completed: boolean
          completed_at: string | null
          id: string
          item_key: string
          updated_at: string
        }
        Insert: {
          client_id: string
          completed?: boolean
          completed_at?: string | null
          id?: string
          item_key: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          completed?: boolean
          completed_at?: string | null
          id?: string
          item_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          default_campaigns: Json
          enabled_kpis: Json
          hidden_accounts: Json
          id: string
          onboarding_checklists: Json | null
          updated_at: string
          visible_kpis: Json
        }
        Insert: {
          default_campaigns?: Json
          enabled_kpis?: Json
          hidden_accounts?: Json
          id?: string
          onboarding_checklists?: Json | null
          updated_at?: string
          visible_kpis?: Json
        }
        Update: {
          default_campaigns?: Json
          enabled_kpis?: Json
          hidden_accounts?: Json
          id?: string
          onboarding_checklists?: Json | null
          updated_at?: string
          visible_kpis?: Json
        }
        Relationships: []
      }
      task_comments: {
        Row: {
          attachments: Json
          body: string
          created_at: string
          id: string
          task_id: string
        }
        Insert: {
          attachments?: Json
          body?: string
          created_at?: string
          id?: string
          task_id: string
        }
        Update: {
          attachments?: Json
          body?: string
          created_at?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          account_name: string | null
          completed: boolean
          created_at: string
          due_date: string | null
          id: string
          priority: string
          title: string
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          completed?: boolean
          created_at?: string
          due_date?: string | null
          id?: string
          priority?: string
          title: string
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          completed?: boolean
          created_at?: string
          due_date?: string | null
          id?: string
          priority?: string
          title?: string
          updated_at?: string
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
