export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
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
          company_name: string | null
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
          pool_size: number
          pool_type: string
          service_days: string[] | null
          service_frequency: string | null
          service_notes: string | null
          service_rate: number | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          company_name?: string | null
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
          pool_size: number
          pool_type: string
          service_days?: string[] | null
          service_frequency?: string | null
          service_notes?: string | null
          service_rate?: number | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          company_name?: string | null
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
          pool_size?: number
          pool_type?: string
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
            foreignKeyName: "clients_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
          alkalinity_level: number | null
          calcium_hardness_level: number | null
          chemicals_added: string | null
          chlorine_level: number | null
          client_id: string | null
          cost: number | null
          created_at: string | null
          cyanuric_acid_level: number | null
          duration: number | null
          id: string
          notes: string | null
          ph_level: number | null
          service_date: string
          services_performed: string | null
          status: string | null
          technician_id: string | null
          updated_at: string | null
        }
        Insert: {
          alkalinity_level?: number | null
          calcium_hardness_level?: number | null
          chemicals_added?: string | null
          chlorine_level?: number | null
          client_id?: string | null
          cost?: number | null
          created_at?: string | null
          cyanuric_acid_level?: number | null
          duration?: number | null
          id?: string
          notes?: string | null
          ph_level?: number | null
          service_date: string
          services_performed?: string | null
          status?: string | null
          technician_id?: string | null
          updated_at?: string | null
        }
        Update: {
          alkalinity_level?: number | null
          calcium_hardness_level?: number | null
          chemicals_added?: string | null
          chlorine_level?: number | null
          client_id?: string | null
          cost?: number | null
          created_at?: string | null
          cyanuric_acid_level?: number | null
          duration?: number | null
          id?: string
          notes?: string | null
          ph_level?: number | null
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
      users: {
        Row: {
          address: string | null
          address_validated: boolean | null
          city: string | null
          country: string | null
          created_at: string | null
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          must_change_password: boolean | null
          name: string
          password: string
          phone: string | null
          role: string
          state: string | null
          street_address: string | null
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          address_validated?: boolean | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          email: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          must_change_password?: boolean | null
          name: string
          password: string
          phone?: string | null
          role: string
          state?: string | null
          street_address?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          address_validated?: boolean | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          must_change_password?: boolean | null
          name?: string
          password?: string
          phone?: string | null
          role?: string
          state?: string | null
          street_address?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_current_user_role: {
        Args: Record<PropertyKey, never>
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
