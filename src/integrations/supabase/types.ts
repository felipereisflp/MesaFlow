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
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          created_at: string
          curr_hash: string
          entity_id: string | null
          entity_type: string
          event_id: string
          new_state_summary: Json | null
          prev_hash: string | null
          previous_state_summary: Json | null
          reason: string | null
          result: string
          tenant_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          curr_hash: string
          entity_id?: string | null
          entity_type: string
          event_id?: string
          new_state_summary?: Json | null
          prev_hash?: string | null
          previous_state_summary?: Json | null
          reason?: string | null
          result?: string
          tenant_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          curr_hash?: string
          entity_id?: string | null
          entity_type?: string
          event_id?: string
          new_state_summary?: Json | null
          prev_hash?: string | null
          previous_state_summary?: Json | null
          reason?: string | null
          result?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          tenant_id: string
          updated_at: string
          visible: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
          visible?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_sessions: {
        Row: {
          created_at: string
          dining_session_id: string
          expires_at: string
          id: string
          tenant_id: string
          token: string
        }
        Insert: {
          created_at?: string
          dining_session_id: string
          expires_at?: string
          id?: string
          tenant_id: string
          token: string
        }
        Update: {
          created_at?: string
          dining_session_id?: string
          expires_at?: string
          id?: string
          tenant_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_sessions_dining_session_id_fkey"
            columns: ["dining_session_id"]
            isOneToOne: false
            referencedRelation: "dining_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      dining_sessions: {
        Row: {
          closed_at: string | null
          created_at: string
          discount_total: number
          id: string
          items_total: number
          opened_at: string
          paid_total: number
          service_fee: number
          status: string
          table_id: string
          tenant_id: string
          updated_at: string
          version: number
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          discount_total?: number
          id?: string
          items_total?: number
          opened_at?: string
          paid_total?: number
          service_fee?: number
          status?: string
          table_id: string
          tenant_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          discount_total?: number
          id?: string
          items_total?: number
          opened_at?: string
          paid_total?: number
          service_fee?: number
          status?: string
          table_id?: string
          tenant_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "dining_sessions_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "venue_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dining_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      modifiers: {
        Row: {
          created_at: string
          id: string
          name: string
          price_delta: number
          product_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          price_delta?: number
          product_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          price_delta?: number
          product_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "modifiers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modifiers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      nfc_tags: {
        Row: {
          created_at: string
          id: string
          label: string | null
          status: string
          table_id: string
          tenant_id: string
          token: string
          token_version: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          status?: string
          table_id: string
          tenant_id: string
          token: string
          token_version?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          status?: string
          table_id?: string
          tenant_id?: string
          token?: string
          token_version?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nfc_tags_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "venue_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfc_tags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          cancel_reason: string | null
          charged: boolean
          created_at: string
          dining_session_id: string
          id: string
          modifiers_snapshot: Json
          name_snapshot: string
          note: string | null
          order_id: string
          product_id: string | null
          quantity: number
          station: Database["public"]["Enums"]["station"]
          status: string
          tenant_id: string
          unit_price_snapshot: number
          updated_at: string
        }
        Insert: {
          cancel_reason?: string | null
          charged?: boolean
          created_at?: string
          dining_session_id: string
          id?: string
          modifiers_snapshot?: Json
          name_snapshot: string
          note?: string | null
          order_id: string
          product_id?: string | null
          quantity?: number
          station: Database["public"]["Enums"]["station"]
          status?: string
          tenant_id: string
          unit_price_snapshot: number
          updated_at?: string
        }
        Update: {
          cancel_reason?: string | null
          charged?: boolean
          created_at?: string
          dining_session_id?: string
          id?: string
          modifiers_snapshot?: Json
          name_snapshot?: string
          note?: string | null
          order_id?: string
          product_id?: string | null
          quantity?: number
          station?: Database["public"]["Enums"]["station"]
          status?: string
          tenant_id?: string
          unit_price_snapshot?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_dining_session_id_fkey"
            columns: ["dining_session_id"]
            isOneToOne: false
            referencedRelation: "dining_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          created_by: string | null
          dining_session_id: string
          id: string
          idempotency_key: string | null
          note: string | null
          origin: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dining_session_id: string
          id?: string
          idempotency_key?: string | null
          note?: string | null
          origin?: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dining_session_id?: string
          id?: string
          idempotency_key?: string | null
          note?: string | null
          origin?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_dining_session_id_fkey"
            columns: ["dining_session_id"]
            isOneToOne: false
            referencedRelation: "dining_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          dining_session_id: string
          id: string
          method: string
          note: string | null
          registered_by: string | null
          source: string
          status: string
          tenant_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          dining_session_id: string
          id?: string
          method: string
          note?: string | null
          registered_by?: string | null
          source?: string
          status?: string
          tenant_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          dining_session_id?: string
          id?: string
          method?: string
          note?: string | null
          registered_by?: string | null
          source?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_dining_session_id_fkey"
            columns: ["dining_session_id"]
            isOneToOne: false
            referencedRelation: "dining_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          archived: boolean
          available: boolean
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          price: number
          sort_order: number
          station: Database["public"]["Enums"]["station"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          available?: boolean
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          price: number
          sort_order?: number
          station?: Database["public"]["Enums"]["station"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          available?: boolean
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          sort_order?: number
          station?: Database["public"]["Enums"]["station"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          full_name: string
          id: string
          phone: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          full_name?: string
          id: string
          phone?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          created_at: string
          detail: Json
          id: string
          ip: string | null
          kind: string
          tenant_id: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          detail?: Json
          id?: string
          ip?: string | null
          kind: string
          tenant_id?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          detail?: Json
          id?: string
          ip?: string | null
          kind?: string
          tenant_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          brand_color: string
          created_at: string
          currency: string
          id: string
          legal_name: string | null
          logo_url: string | null
          name: string
          service_fee_enabled: boolean
          service_fee_pct: number
          status: string
          tax_id: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          brand_color?: string
          created_at?: string
          currency?: string
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name: string
          service_fee_enabled?: boolean
          service_fee_pct?: number
          status?: string
          tax_id?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          brand_color?: string
          created_at?: string
          currency?: string
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          service_fee_enabled?: boolean
          service_fee_pct?: number
          status?: string
          tax_id?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_tables: {
        Row: {
          active: boolean
          area: string | null
          created_at: string
          display_code: string
          id: string
          seats: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          area?: string | null
          created_at?: string
          display_code: string
          id?: string
          seats?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          area?: string | null
          created_at?: string
          display_code?: string
          id?: string
          seats?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_tables_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_tenant_id: { Args: never; Returns: string }
      has_any_role: {
        Args: { _roles: Database["public"]["Enums"]["app_role"][] }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "owner"
        | "admin"
        | "gerente"
        | "caixa"
        | "garcom"
        | "cozinha"
        | "bar"
        | "auditor"
      station: "cozinha" | "bar"
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
    Enums: {
      app_role: [
        "owner",
        "admin",
        "gerente",
        "caixa",
        "garcom",
        "cozinha",
        "bar",
        "auditor",
      ],
      station: ["cozinha", "bar"],
    },
  },
} as const
