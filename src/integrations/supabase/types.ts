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
          blob_sha: string | null
          created_at: string | null
          id: string
          label: string
          page_title: string | null
          repo: string | null
          repo_path: string | null
          source: string
          synced_at: string | null
          url: string
        }
        Insert: {
          account_name: string
          blob_sha?: string | null
          created_at?: string | null
          id?: string
          label: string
          page_title?: string | null
          repo?: string | null
          repo_path?: string | null
          source?: string
          synced_at?: string | null
          url: string
        }
        Update: {
          account_name?: string
          blob_sha?: string | null
          created_at?: string | null
          id?: string
          label?: string
          page_title?: string | null
          repo?: string | null
          repo_path?: string | null
          source?: string
          synced_at?: string | null
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
          gdrive_folder_url: string | null
          ghl_location_id: string | null
          id: string
          report_token: string
        }
        Insert: {
          account_name: string
          created_at?: string
          fb_ad_account_id?: string | null
          gdrive_folder_url?: string | null
          ghl_location_id?: string | null
          id?: string
          report_token?: string
        }
        Update: {
          account_name?: string
          created_at?: string
          fb_ad_account_id?: string | null
          gdrive_folder_url?: string | null
          ghl_location_id?: string | null
          id?: string
          report_token?: string
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
          cancelled_at: string | null
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
          onboarded_at: string | null
          onboarding_data: Json | null
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
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
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
          cancelled_at?: string | null
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
          onboarded_at?: string | null
          onboarding_data?: Json | null
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
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
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
          cancelled_at?: string | null
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
          onboarded_at?: string | null
          onboarding_data?: Json | null
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
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
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
      creative_options: {
        Row: {
          id: string
          type: string
          value: string
          created_at: string
        }
        Insert: {
          id?: string
          type: string
          value: string
          created_at?: string
        }
        Update: {
          id?: string
          type?: string
          value?: string
          created_at?: string
        }
        Relationships: []
      }
      creative_request_comments: {
        Row: {
          author: string
          body: string
          created_at: string
          id: string
          request_id: string
        }
        Insert: {
          author: string
          body: string
          created_at?: string
          id?: string
          request_id: string
        }
        Update: {
          author?: string
          body?: string
          created_at?: string
          id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_request_comments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "creative_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_requests: {
        Row: {
          account_name: string
          ad_angle: string
          ad_type: string
          assigned_to: string | null
          created_at: string
          created_by: string | null
          gdrive_folder_url: string | null
          id: string
          is_template: boolean
          notes: string | null
          offer_type: string
          status: string
          template_name: string
          updated_at: string
        }
        Insert: {
          account_name: string
          ad_angle: string
          ad_type: string
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          gdrive_folder_url?: string | null
          id?: string
          is_template?: boolean
          notes?: string | null
          offer_type: string
          status?: string
          template_name: string
          updated_at?: string
        }
        Update: {
          account_name?: string
          ad_angle?: string
          ad_type?: string
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          gdrive_folder_url?: string | null
          id?: string
          is_template?: boolean
          notes?: string | null
          offer_type?: string
          status?: string
          template_name?: string
          updated_at?: string
        }
        Relationships: []
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
          ad_angle: string | null
          batch_name: string
          created_at: string
          file_name: string
          file_type: string
          file_url: string
          id: string
          launch_date: string | null
          notes: string | null
          offer_type: string | null
          status: string
          video_part: string | null
        }
        Insert: {
          account_id?: string | null
          account_name: string
          ad_angle?: string | null
          batch_name?: string
          created_at?: string
          file_name: string
          file_type?: string
          file_url: string
          id?: string
          launch_date?: string | null
          notes?: string | null
          offer_type?: string | null
          status?: string
          video_part?: string | null
        }
        Update: {
          account_id?: string | null
          account_name?: string
          ad_angle?: string | null
          batch_name?: string
          created_at?: string
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          launch_date?: string | null
          notes?: string | null
          offer_type?: string | null
          status?: string
          video_part?: string | null
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
      funnel_sites: {
        Row: {
          account_id: string
          created_at: string
          domain: string
          id: string
          repo: string
          root_dir: string
        }
        Insert: {
          account_id: string
          created_at?: string
          domain: string
          id?: string
          repo?: string
          root_dir: string
        }
        Update: {
          account_id?: string
          created_at?: string
          domain?: string
          id?: string
          repo?: string
          root_dir?: string
        }
        Relationships: [
          {
            foreignKeyName: "funnel_sites_account_id_fkey"
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
      github_client_rules: {
        Row: {
          account_id: string
          created_at: string
          id: string
          kind: string
          pattern: string
          repo: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          kind: string
          pattern: string
          repo?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          kind?: string
          pattern?: string
          repo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "github_client_rules_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      github_commit_accounts: {
        Row: {
          account_id: string
          matched_by: string
          repo: string
          sha: string
        }
        Insert: {
          account_id: string
          matched_by: string
          repo: string
          sha: string
        }
        Update: {
          account_id?: string
          matched_by?: string
          repo?: string
          sha?: string
        }
        Relationships: [
          {
            foreignKeyName: "github_commit_accounts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "github_commit_accounts_repo_sha_fkey"
            columns: ["repo", "sha"]
            isOneToOne: false
            referencedRelation: "github_commits"
            referencedColumns: ["repo", "sha"]
          },
        ]
      }
      github_commits: {
        Row: {
          additions: number | null
          author_login: string | null
          author_name: string | null
          body: string | null
          claude_coauthored: boolean
          committed_at: string
          deletions: number | null
          files: string[]
          html_url: string | null
          repo: string
          sha: string
          source: string
          subject: string
          synced_at: string
        }
        Insert: {
          additions?: number | null
          author_login?: string | null
          author_name?: string | null
          body?: string | null
          claude_coauthored?: boolean
          committed_at: string
          deletions?: number | null
          files?: string[]
          html_url?: string | null
          repo: string
          sha: string
          source?: string
          subject: string
          synced_at?: string
        }
        Update: {
          additions?: number | null
          author_login?: string | null
          author_name?: string | null
          body?: string | null
          claude_coauthored?: boolean
          committed_at?: string
          deletions?: number | null
          files?: string[]
          html_url?: string | null
          repo?: string
          sha?: string
          source?: string
          subject?: string
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "github_commits_repo_fkey"
            columns: ["repo"]
            isOneToOne: false
            referencedRelation: "github_repos"
            referencedColumns: ["full_name"]
          },
        ]
      }
      github_repos: {
        Row: {
          archived: boolean
          default_branch: string | null
          description: string | null
          full_name: string
          html_url: string | null
          is_private: boolean | null
          pushed_at: string | null
          synced_at: string
        }
        Insert: {
          archived?: boolean
          default_branch?: string | null
          description?: string | null
          full_name: string
          html_url?: string | null
          is_private?: boolean | null
          pushed_at?: string | null
          synced_at?: string
        }
        Update: {
          archived?: boolean
          default_branch?: string | null
          description?: string | null
          full_name?: string
          html_url?: string | null
          is_private?: boolean | null
          pushed_at?: string | null
          synced_at?: string
        }
        Relationships: []
      }
      github_sync_runs: {
        Row: {
          counts: Json | null
          error: string | null
          finished_at: string | null
          id: number
          ok: boolean | null
          started_at: string
        }
        Insert: {
          counts?: Json | null
          error?: string | null
          finished_at?: string | null
          id?: number
          ok?: boolean | null
          started_at?: string
        }
        Update: {
          counts?: Json | null
          error?: string | null
          finished_at?: string | null
          id?: number
          ok?: boolean | null
          started_at?: string
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
      stripe_customers: {
        Row: {
          account_id: string | null
          client_id: string | null
          created_at: string | null
          deleted: boolean
          delinquent: boolean | null
          email: string | null
          id: string
          name: string | null
          phone: string | null
          synced_at: string
        }
        Insert: {
          account_id?: string | null
          client_id?: string | null
          created_at?: string | null
          deleted?: boolean
          delinquent?: boolean | null
          email?: string | null
          id: string
          name?: string | null
          phone?: string | null
          synced_at?: string
        }
        Update: {
          account_id?: string | null
          client_id?: string | null
          created_at?: string | null
          deleted?: boolean
          delinquent?: boolean | null
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_customers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_customers_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_invoices: {
        Row: {
          amount_due: number | null
          amount_paid: number | null
          amount_remaining: number | null
          attempt_count: number | null
          billing_reason: string | null
          created_at: string | null
          currency: string | null
          customer_id: string | null
          hosted_invoice_url: string | null
          id: string
          lines: Json
          next_payment_attempt: string | null
          number: string | null
          paid_at: string | null
          status: string | null
          subscription_id: string | null
          synced_at: string
        }
        Insert: {
          amount_due?: number | null
          amount_paid?: number | null
          amount_remaining?: number | null
          attempt_count?: number | null
          billing_reason?: string | null
          created_at?: string | null
          currency?: string | null
          customer_id?: string | null
          hosted_invoice_url?: string | null
          id: string
          lines?: Json
          next_payment_attempt?: string | null
          number?: string | null
          paid_at?: string | null
          status?: string | null
          subscription_id?: string | null
          synced_at?: string
        }
        Update: {
          amount_due?: number | null
          amount_paid?: number | null
          amount_remaining?: number | null
          attempt_count?: number | null
          billing_reason?: string | null
          created_at?: string | null
          currency?: string | null
          customer_id?: string | null
          hosted_invoice_url?: string | null
          id?: string
          lines?: Json
          next_payment_attempt?: string | null
          number?: string | null
          paid_at?: string | null
          status?: string | null
          subscription_id?: string | null
          synced_at?: string
        }
        Relationships: []
      }
      stripe_payments: {
        Row: {
          amount: number
          amount_refunded: number
          charge_id: string | null
          created_at: string | null
          currency: string | null
          customer_id: string | null
          description: string | null
          disputed: boolean
          id: string
          invoice_id: string | null
          paid_at: string
          synced_at: string
        }
        Insert: {
          amount: number
          amount_refunded?: number
          charge_id?: string | null
          created_at?: string | null
          currency?: string | null
          customer_id?: string | null
          description?: string | null
          disputed?: boolean
          id: string
          invoice_id?: string | null
          paid_at: string
          synced_at?: string
        }
        Update: {
          amount?: number
          amount_refunded?: number
          charge_id?: string | null
          created_at?: string | null
          currency?: string | null
          customer_id?: string | null
          description?: string | null
          disputed?: boolean
          id?: string
          invoice_id?: string | null
          paid_at?: string
          synced_at?: string
        }
        Relationships: []
      }
      stripe_subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          canceled_at: string | null
          collection_paused: boolean
          created_at: string | null
          currency: string | null
          current_period_end: string | null
          customer_id: string
          ended_at: string | null
          id: string
          items: Json
          mrr_cents: number
          pause_behavior: string | null
          pause_resumes_at: string | null
          started_at: string | null
          status: string
          synced_at: string
          trial_end: string | null
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          collection_paused?: boolean
          created_at?: string | null
          currency?: string | null
          current_period_end?: string | null
          customer_id: string
          ended_at?: string | null
          id: string
          items?: Json
          mrr_cents?: number
          pause_behavior?: string | null
          pause_resumes_at?: string | null
          started_at?: string | null
          status: string
          synced_at?: string
          trial_end?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean | null
          canceled_at?: string | null
          collection_paused?: boolean
          created_at?: string | null
          currency?: string | null
          current_period_end?: string | null
          customer_id?: string
          ended_at?: string | null
          id?: string
          items?: Json
          mrr_cents?: number
          pause_behavior?: string | null
          pause_resumes_at?: string | null
          started_at?: string | null
          status?: string
          synced_at?: string
          trial_end?: string | null
        }
        Relationships: []
      }
      stripe_sync_runs: {
        Row: {
          counts: Json | null
          error: string | null
          finished_at: string | null
          id: number
          ok: boolean | null
          started_at: string
        }
        Insert: {
          counts?: Json | null
          error?: string | null
          finished_at?: string | null
          id?: number
          ok?: boolean | null
          started_at?: string
        }
        Update: {
          counts?: Json | null
          error?: string | null
          finished_at?: string | null
          id?: number
          ok?: boolean | null
          started_at?: string
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
          assigned_to: string | null
          category: string | null
          completed: boolean
          created_at: string
          description: string | null
          description_attachments: Json
          due_date: string | null
          id: string
          priority: string
          stage: string
          title: string
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          assigned_to?: string | null
          category?: string | null
          completed?: boolean
          created_at?: string
          description?: string | null
          description_attachments?: Json
          due_date?: string | null
          id?: string
          priority?: string
          stage?: string
          title: string
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          assigned_to?: string | null
          category?: string | null
          completed?: boolean
          created_at?: string
          description?: string | null
          description_attachments?: Json
          due_date?: string | null
          id?: string
          priority?: string
          stage?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          created_at: string
          id: string
          name: string
          position: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      github_token_status: { Args: never; Returns: Json }
      is_admin: { Args: never; Returns: boolean }
      report_account_id: { Args: never; Returns: string }
      report_account_name: { Args: never; Returns: string }
      set_github_token: { Args: { token: string }; Returns: undefined }
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
