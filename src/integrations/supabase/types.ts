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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      api_rate_limits: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          identifier: string
          request_count: number
          window_start: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          identifier: string
          request_count?: number
          window_start?: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          identifier?: string
          request_count?: number
          window_start?: string
        }
        Relationships: []
      }
      chemical_calculations: {
        Row: {
          calculated_date: string | null
          chemical_recommendations: Json
          client_id: string | null
          created_at: string | null
          id: string
          pool_size: number
          pool_type: string
          technician_id: string | null
          test_results: Json
        }
        Insert: {
          calculated_date?: string | null
          chemical_recommendations: Json
          client_id?: string | null
          created_at?: string | null
          id?: string
          pool_size: number
          pool_type: string
          technician_id?: string | null
          test_results: Json
        }
        Update: {
          calculated_date?: string | null
          chemical_recommendations?: Json
          client_id?: string | null
          created_at?: string | null
          id?: string
          pool_size?: number
          pool_type?: string
          technician_id?: string | null
          test_results?: Json
        }
        Relationships: [
          {
            foreignKeyName: "chemical_calculations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chemical_calculations_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      client_invitations: {
        Row: {
          access_count: number | null
          client_id: string
          created_at: string
          created_by: string | null
          email: string | null
          email_encrypted: string | null
          expires_at: string
          id: string
          last_access_at: string | null
          last_access_ip: unknown | null
          phone: string | null
          phone_encrypted: string | null
          token: string
          token_hash: string | null
          used_at: string | null
        }
        Insert: {
          access_count?: number | null
          client_id: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          email_encrypted?: string | null
          expires_at?: string
          id?: string
          last_access_at?: string | null
          last_access_ip?: unknown | null
          phone?: string | null
          phone_encrypted?: string | null
          token: string
          token_hash?: string | null
          used_at?: string | null
        }
        Update: {
          access_count?: number | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          email_encrypted?: string | null
          expires_at?: string
          id?: string
          last_access_at?: string | null
          last_access_ip?: unknown | null
          phone?: string | null
          phone_encrypted?: string | null
          token?: string
          token_hash?: string | null
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_invitations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_invitations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      client_tech_messages: {
        Row: {
          client_id: string
          created_at: string
          id: string
          message: string
          message_type: string | null
          read_at: string | null
          sender_id: string
          technician_id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          message: string
          message_type?: string | null
          read_at?: string | null
          sender_id: string
          technician_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          message?: string
          message_type?: string | null
          read_at?: string | null
          sender_id?: string
          technician_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_users: {
        Row: {
          client_id: string
          created_at: string
          id: string
          is_primary: boolean | null
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          is_primary?: boolean | null
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean | null
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_users_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          assigned_technician_id: string | null
          company_name: string | null
          contact_address: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          customer: string
          id: string
          in_balance: boolean | null
          included_services: string[] | null
          is_multi_property: boolean | null
          join_date: string | null
          last_service_date: string | null
          liner_type: string | null
          next_service_date: string | null
          notification_method: string | null
          notify_on_assignment: boolean | null
          notify_on_confirmation: boolean | null
          pool_image_uploaded_at: string | null
          pool_image_url: string | null
          pool_size: number
          pool_type: string
          qb_customer_id: string | null
          qb_invoice_link: string | null
          service_days: string[] | null
          service_frequency: string | null
          service_notes: string | null
          service_rate: number | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          assigned_technician_id?: string | null
          company_name?: string | null
          contact_address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          customer: string
          id?: string
          in_balance?: boolean | null
          included_services?: string[] | null
          is_multi_property?: boolean | null
          join_date?: string | null
          last_service_date?: string | null
          liner_type?: string | null
          next_service_date?: string | null
          notification_method?: string | null
          notify_on_assignment?: boolean | null
          notify_on_confirmation?: boolean | null
          pool_image_uploaded_at?: string | null
          pool_image_url?: string | null
          pool_size: number
          pool_type: string
          qb_customer_id?: string | null
          qb_invoice_link?: string | null
          service_days?: string[] | null
          service_frequency?: string | null
          service_notes?: string | null
          service_rate?: number | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          assigned_technician_id?: string | null
          company_name?: string | null
          contact_address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          customer?: string
          id?: string
          in_balance?: boolean | null
          included_services?: string[] | null
          is_multi_property?: boolean | null
          join_date?: string | null
          last_service_date?: string | null
          liner_type?: string | null
          next_service_date?: string | null
          notification_method?: string | null
          notify_on_assignment?: boolean | null
          notify_on_confirmation?: boolean | null
          pool_image_uploaded_at?: string | null
          pool_image_url?: string | null
          pool_size?: number
          pool_type?: string
          qb_customer_id?: string | null
          qb_invoice_link?: string | null
          service_days?: string[] | null
          service_frequency?: string | null
          service_notes?: string | null
          service_rate?: number | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_assigned_technician_id_fkey"
            columns: ["assigned_technician_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      invitation_access_log: {
        Row: {
          access_type: string | null
          accessed_at: string | null
          accessor_ip: string | null
          accessor_user_agent: string | null
          id: string
          invitation_id: string | null
          success: boolean | null
        }
        Insert: {
          access_type?: string | null
          accessed_at?: string | null
          accessor_ip?: string | null
          accessor_user_agent?: string | null
          id?: string
          invitation_id?: string | null
          success?: boolean | null
        }
        Update: {
          access_type?: string | null
          accessed_at?: string | null
          accessor_ip?: string | null
          accessor_user_agent?: string | null
          id?: string
          invitation_id?: string | null
          success?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "invitation_access_log_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "client_invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      password_reset_attempts: {
        Row: {
          created_at: string
          id: string
          identifier_hash: string
          ip: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          identifier_hash: string
          ip?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          identifier_hash?: string
          ip?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          client_id: string | null
          created_at: string
          customer_name: string
          id: string
          rating: number
          review_text: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          client_id?: string | null
          created_at?: string
          customer_name: string
          id?: string
          rating: number
          review_text: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          client_id?: string | null
          created_at?: string
          customer_name?: string
          id?: string
          rating?: number
          review_text?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      security_audit_log: {
        Row: {
          actor_id: string | null
          created_at: string | null
          event_type: string
          id: string
          ip_address: unknown | null
          new_values: Json | null
          old_values: Json | null
          target_table: string | null
          target_user_id: string | null
          user_agent: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string | null
          event_type: string
          id?: string
          ip_address?: unknown | null
          new_values?: Json | null
          old_values?: Json | null
          target_table?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string | null
          event_type?: string
          id?: string
          ip_address?: unknown | null
          new_values?: Json | null
          old_values?: Json | null
          target_table?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      security_events: {
        Row: {
          created_at: string
          endpoint: string | null
          event_type: string
          id: string
          ip_address: unknown | null
          payload: Json | null
          session_id: string | null
          severity: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          endpoint?: string | null
          event_type: string
          id?: string
          ip_address?: unknown | null
          payload?: Json | null
          session_id?: string | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          endpoint?: string | null
          event_type?: string
          id?: string
          ip_address?: unknown | null
          payload?: Json | null
          session_id?: string | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      service_requests: {
        Row: {
          address_validated: boolean | null
          assigned_technician_id: string | null
          city: string | null
          client_id: string | null
          completed_date: string | null
          contact_address: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          contact_title: string | null
          country: string | null
          created_at: string | null
          description: string
          id: string
          pool_size: string | null
          pool_type: string | null
          preferred_date: string | null
          priority: string | null
          request_type: string
          requested_date: string | null
          state: string | null
          status: string | null
          street_address: string | null
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          address_validated?: boolean | null
          assigned_technician_id?: string | null
          city?: string | null
          client_id?: string | null
          completed_date?: string | null
          contact_address?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_title?: string | null
          country?: string | null
          created_at?: string | null
          description: string
          id?: string
          pool_size?: string | null
          pool_type?: string | null
          preferred_date?: string | null
          priority?: string | null
          request_type: string
          requested_date?: string | null
          state?: string | null
          status?: string | null
          street_address?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Update: {
          address_validated?: boolean | null
          assigned_technician_id?: string | null
          city?: string | null
          client_id?: string | null
          completed_date?: string | null
          contact_address?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_title?: string | null
          country?: string | null
          created_at?: string | null
          description?: string
          id?: string
          pool_size?: string | null
          pool_type?: string | null
          preferred_date?: string | null
          priority?: string | null
          request_type?: string
          requested_date?: string | null
          state?: string | null
          status?: string | null
          street_address?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_assigned_technician_id_fkey"
            columns: ["assigned_technician_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          actions: Json | null
          after_photo_url: string | null
          alkalinity_level: number | null
          before_photo_url: string | null
          calcium_hardness_level: number | null
          chemicals_added: string | null
          chlorine_level: number | null
          client_id: string | null
          cost: number | null
          created_at: string | null
          cyanuric_acid_level: number | null
          duration: number | null
          duration_minutes: number | null
          id: string
          message_preview: string | null
          notes: string | null
          performed_at: string
          ph_level: number | null
          readings: Json | null
          service_date: string
          services_performed: string | null
          status: string | null
          technician_id: string | null
          updated_at: string | null
        }
        Insert: {
          actions?: Json | null
          after_photo_url?: string | null
          alkalinity_level?: number | null
          before_photo_url?: string | null
          calcium_hardness_level?: number | null
          chemicals_added?: string | null
          chlorine_level?: number | null
          client_id?: string | null
          cost?: number | null
          created_at?: string | null
          cyanuric_acid_level?: number | null
          duration?: number | null
          duration_minutes?: number | null
          id?: string
          message_preview?: string | null
          notes?: string | null
          performed_at?: string
          ph_level?: number | null
          readings?: Json | null
          service_date?: string
          services_performed?: string | null
          status?: string | null
          technician_id?: string | null
          updated_at?: string | null
        }
        Update: {
          actions?: Json | null
          after_photo_url?: string | null
          alkalinity_level?: number | null
          before_photo_url?: string | null
          calcium_hardness_level?: number | null
          chemicals_added?: string | null
          chlorine_level?: number | null
          client_id?: string | null
          cost?: number | null
          created_at?: string | null
          cyanuric_acid_level?: number | null
          duration?: number | null
          duration_minutes?: number | null
          id?: string
          message_preview?: string | null
          notes?: string | null
          performed_at?: string
          ph_level?: number | null
          readings?: Json | null
          service_date?: string
          services_performed?: string | null
          status?: string | null
          technician_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "services_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_logins: {
        Row: {
          created_at: string
          id: string
          ip_address: string | null
          login_time: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: string | null
          login_time?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string | null
          login_time?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_migration_status: {
        Row: {
          auth_user_id: string | null
          email: string
          migrated_at: string | null
          user_id: string
        }
        Insert: {
          auth_user_id?: string | null
          email: string
          migrated_at?: string | null
          user_id: string
        }
        Update: {
          auth_user_id?: string | null
          email?: string
          migrated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          address: string | null
          address_validated: boolean | null
          can_create_clients: boolean | null
          can_manage_services: boolean | null
          can_view_reports: boolean | null
          city: string | null
          country: string | null
          created_at: string | null
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          login: string
          must_change_password: boolean | null
          name: string
          needs_auth_migration: boolean | null
          phone: string | null
          profile_image_url: string | null
          role: string
          state: string | null
          status: string
          street_address: string | null
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          address_validated?: boolean | null
          can_create_clients?: boolean | null
          can_manage_services?: boolean | null
          can_view_reports?: boolean | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          email: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          login: string
          must_change_password?: boolean | null
          name: string
          needs_auth_migration?: boolean | null
          phone?: string | null
          profile_image_url?: string | null
          role: string
          state?: string | null
          status?: string
          street_address?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          address_validated?: boolean | null
          can_create_clients?: boolean | null
          can_manage_services?: boolean | null
          can_view_reports?: boolean | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          login?: string
          must_change_password?: boolean | null
          name?: string
          needs_auth_migration?: boolean | null
          phone?: string | null
          profile_image_url?: string | null
          role?: string
          state?: string | null
          status?: string
          street_address?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      invitation_summary_admin: {
        Row: {
          access_count: number | null
          client_id: string | null
          created_at: string | null
          customer: string | null
          email_masked: string | null
          expires_at: string | null
          id: string | null
          last_accessed: string | null
          phone_masked: string | null
          status: string | null
          used_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_access_message: {
        Args: { admin_reason: string; message_id: string }
        Returns: Json
      }
      admin_get_invitation_security_summary: {
        Args: { admin_reason: string }
        Returns: {
          access_count: number
          client_id: string
          created_at: string
          customer: string
          email_masked: string
          expires_at: string
          id: string
          last_accessed: string
          phone_masked: string
          status: string
          used_at: string
        }[]
      }
      admin_get_service_requests_with_contact_info: {
        Args: { admin_reason: string }
        Returns: {
          city: string
          client_id: string
          contact_address: string
          contact_email: string
          contact_name: string
          contact_phone: string
          created_at: string
          description: string
          id: string
          request_type: string
          state: string
          status: string
          street_address: string
          zip_code: string
        }[]
      }
      admin_lookup_user: {
        Args: { lookup_email: string; lookup_reason: string }
        Returns: Json
      }
      admin_search_users: {
        Args: { search_reason: string; search_term: string }
        Returns: Json
      }
      admin_view_message: {
        Args: { message_id: string; reason: string }
        Returns: Json
      }
      allow_password_reset_request: {
        Args: { p_identifier: string }
        Returns: boolean
      }
      check_rate_limit: {
        Args: {
          p_endpoint: string
          p_identifier: string
          p_max_requests?: number
          p_window_minutes?: number
        }
        Returns: boolean
      }
      check_rate_limit_enhanced: {
        Args: {
          p_endpoint: string
          p_identifier: string
          p_log_violations?: boolean
          p_max_requests?: number
          p_window_minutes?: number
        }
        Returns: boolean
      }
      cleanup_expired_invitations: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_old_invitations: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      get_all_technicians: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_at: string
          email: string
          id: string
          login: string
          name: string
          phone: string
        }[]
      }
      get_client_invite_payload: {
        Args: { invite_token: string }
        Returns: Json
      }
      get_client_invite_payload_secure: {
        Args: {
          accessor_ip?: string
          accessor_user_agent?: string
          invite_token: string
        }
        Returns: Json
      }
      get_current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_email_by_login: {
        Args: { login_input: string }
        Returns: string
      }
      get_user_login_data: {
        Args: { login_input: string }
        Returns: {
          login: string
          must_change_password: boolean
          name: string
          role: string
          user_id: string
        }[]
      }
      get_user_public_info: {
        Args: { user_id: string }
        Returns: Json
      }
      hash_invitation_token: {
        Args: { token_input: string }
        Returns: string
      }
      log_security_event: {
        Args: {
          p_event_type: string
          p_new_values?: Json
          p_old_values?: Json
          p_target_table?: string
          p_target_user_id?: string
        }
        Returns: undefined
      }
      log_security_event_enhanced: {
        Args: {
          p_endpoint?: string
          p_event_type: string
          p_payload?: Json
          p_session_id?: string
          p_severity?: string
          p_user_id?: string
        }
        Returns: undefined
      }
      mark_invitation_used: {
        Args: {
          accessor_ip?: string
          accessor_user_agent?: string
          invite_token: string
        }
        Returns: boolean
      }
      secure_admin_user_lookup: {
        Args: { admin_reason: string; lookup_email: string }
        Returns: Json
      }
      security_health_check: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      validate_invitation_token: {
        Args: { token_input: string }
        Returns: string
      }
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
