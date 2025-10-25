export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  public: {
    Tables: {
      branches: {
        Row: {
          address: string | null;
          commercial_registration: string | null;
          company_name: string | null;
          created_at: string;
          id: string;
          name: string;
          phone: string | null;
          tax_number: string | null;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          commercial_registration?: string | null;
          company_name?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          phone?: string | null;
          tax_number?: string | null;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          commercial_registration?: string | null;
          company_name?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          phone?: string | null;
          tax_number?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          branch_id: string;
          created_at: string;
          full_name: string;
          id: string;
          id_number: string | null;
          notes: string | null;
          phone: string;
          updated_at: string;
        };
        Insert: {
          branch_id: string;
          created_at?: string;
          full_name: string;
          id?: string;
          id_number?: string | null;
          notes?: string | null;
          phone: string;
          updated_at?: string;
        };
        Update: {
          branch_id?: string;
          created_at?: string;
          full_name?: string;
          id?: string;
          id_number?: string | null;
          notes?: string | null;
          phone?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customers_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          }
        ];
      };
      equipment: {
        Row: {
          branch_id: string;
          category: string | null;
          code: string;
          created_at: string;
          daily_rate: number;
          id: string;
          name: string;
          notes: string | null;
          status: Database["public"]["Enums"]["equipment_status"];
          updated_at: string;
        };
        Insert: {
          branch_id: string;
          category?: string | null;
          code: string;
          created_at?: string;
          daily_rate: number;
          id?: string;
          name: string;
          notes?: string | null;
          status?: Database["public"]["Enums"]["equipment_status"];
          updated_at?: string;
        };
        Update: {
          branch_id?: string;
          category?: string | null;
          code?: string;
          created_at?: string;
          daily_rate?: number;
          id?: string;
          name?: string;
          notes?: string | null;
          status?: Database["public"]["Enums"]["equipment_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "equipment_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          }
        ];
      };
      invoices: {
        Row: {
          created_at: string;
          id: string;
          invoice_number: string;
          rental_id: string;
          total_amount: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          invoice_number: string;
          rental_id: string;
          total_amount: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          invoice_number?: string;
          rental_id?: string;
          total_amount?: number;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_rental_id_fkey";
            columns: ["rental_id"];
            isOneToOne: false;
            referencedRelation: "rentals";
            referencedColumns: ["id"];
          }
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string;
          id: string;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          full_name: string;
          id: string;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          full_name?: string;
          id?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      rental_items: {
        Row: {
          amount: number | null;
          created_at: string | null;
          days_count: number | null;
          equipment_id: string;
          id: string;
          notes: string | null;
          rental_id: string;
          return_date: string | null;
          start_date: string;
          updated_at: string | null;
        };
        Insert: {
          amount?: number | null;
          created_at?: string | null;
          days_count?: number | null;
          equipment_id: string;
          id?: string;
          notes?: string | null;
          rental_id: string;
          return_date?: string | null;
          start_date: string;
          updated_at?: string | null;
        };
        Update: {
          amount?: number | null;
          created_at?: string | null;
          days_count?: number | null;
          equipment_id?: string;
          id?: string;
          notes?: string | null;
          rental_id?: string;
          return_date?: string | null;
          start_date?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "rental_items_equipment_id_fkey";
            columns: ["equipment_id"];
            isOneToOne: false;
            referencedRelation: "equipment";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rental_items_rental_id_fkey";
            columns: ["rental_id"];
            isOneToOne: false;
            referencedRelation: "rentals";
            referencedColumns: ["id"];
          }
        ];
      };
      rentals: {
        Row: {
          branch_id: string;
          created_at: string;
          created_by: string;
          customer_id: string;
          days_count: number | null;
          end_date: string | null;
          equipment_id: string;
          expected_end_date: string | null;
          id: string;
          is_fixed_duration: boolean | null;
          notes: string | null;
          rental_type: Database["public"]["Enums"]["rental_type"] | null;
          start_date: string;
          status: Database["public"]["Enums"]["rental_status"];
          total_amount: number | null;
          updated_at: string;
        };
        Insert: {
          branch_id: string;
          created_at?: string;
          created_by: string;
          customer_id: string;
          days_count?: number | null;
          end_date?: string | null;
          equipment_id: string;
          expected_end_date?: string | null;
          id?: string;
          is_fixed_duration?: boolean | null;
          notes?: string | null;
          rental_type?: Database["public"]["Enums"]["rental_type"] | null;
          start_date: string;
          status?: Database["public"]["Enums"]["rental_status"];
          total_amount?: number | null;
          updated_at?: string;
        };
        Update: {
          branch_id?: string;
          created_at?: string;
          created_by?: string;
          customer_id?: string;
          days_count?: number | null;
          end_date?: string | null;
          equipment_id?: string;
          expected_end_date?: string | null;
          id?: string;
          is_fixed_duration?: boolean | null;
          notes?: string | null;
          rental_type?: Database["public"]["Enums"]["rental_type"] | null;
          start_date?: string;
          status?: Database["public"]["Enums"]["rental_status"];
          total_amount?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rentals_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rentals_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rentals_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rentals_equipment_id_fkey";
            columns: ["equipment_id"];
            isOneToOne: false;
            referencedRelation: "equipment";
            referencedColumns: ["id"];
          }
        ];
      };
      user_roles: {
        Row: {
          branch_id: string | null;
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          branch_id?: string | null;
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          branch_id?: string | null;
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_user_branch: { Args: { _user_id: string }; Returns: string };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "branch_manager" | "employee";
      equipment_status: "available" | "rented" | "maintenance";
      rental_status: "active" | "completed";
      rental_type: "daily" | "monthly";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
      DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] &
      DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R;
    }
    ? R
    : never
  : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I;
    }
    ? I
    : never
  : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U;
    }
    ? U
    : never
  : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "branch_manager", "employee"],
      equipment_status: ["available", "rented", "maintenance"],
      rental_status: ["active", "completed"],
      rental_type: ["daily", "monthly"],
    },
  },
} as const;
