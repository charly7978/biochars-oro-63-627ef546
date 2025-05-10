export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      calibration_records: {
        Row: {
          created_at: string | null
          diastolic: number
          glucose: number
          heart_rate: number
          id: string
          quality: number
          spo2: number
          systolic: number
          timestamp: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          diastolic: number
          glucose: number
          heart_rate: number
          id?: string
          quality: number
          spo2: number
          systolic: number
          timestamp: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          diastolic?: number
          glucose?: number
          heart_rate?: number
          id?: string
          quality?: number
          spo2?: number
          systolic?: number
          timestamp?: number
          user_id?: string
        }
        Relationships: []
      }
      calibration_settings: {
        Row: {
          created_at: string
          diastolic_reference: number | null
          id: string
          is_active: boolean | null
          last_calibration_date: string | null
          perfusion_index: number | null
          quality_threshold: number | null
          red_threshold_max: number | null
          red_threshold_min: number | null
          stability_threshold: number | null
          status: Database["public"]["Enums"]["calibration_status"] | null
          systolic_reference: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          diastolic_reference?: number | null
          id?: string
          is_active?: boolean | null
          last_calibration_date?: string | null
          perfusion_index?: number | null
          quality_threshold?: number | null
          red_threshold_max?: number | null
          red_threshold_min?: number | null
          stability_threshold?: number | null
          status?: Database["public"]["Enums"]["calibration_status"] | null
          systolic_reference?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          diastolic_reference?: number | null
          id?: string
          is_active?: boolean | null
          last_calibration_date?: string | null
          perfusion_index?: number | null
          quality_threshold?: number | null
          red_threshold_max?: number | null
          red_threshold_min?: number | null
          stability_threshold?: number | null
          status?: Database["public"]["Enums"]["calibration_status"] | null
          systolic_reference?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calibration_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      measurements: {
        Row: {
          arrhythmia_count: number
          created_at: string
          diastolic: number
          heart_rate: number
          id: string
          measured_at: string
          quality: number
          spo2: number
          systolic: number
          user_id: string
        }
        Insert: {
          arrhythmia_count: number
          created_at?: string
          diastolic: number
          heart_rate: number
          id?: string
          measured_at?: string
          quality: number
          spo2: number
          systolic: number
          user_id: string
        }
        Update: {
          arrhythmia_count?: number
          created_at?: string
          diastolic?: number
          heart_rate?: number
          id?: string
          measured_at?: string
          quality?: number
          spo2?: number
          systolic?: number
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
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
      calibration_status: "pending" | "in_progress" | "completed" | "failed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      calibration_status: ["pending", "in_progress", "completed", "failed"],
    },
  },
} as const
