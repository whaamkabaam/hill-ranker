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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      allowed_users: {
        Row: {
          created_at: string | null
          email: string
          id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
        }
        Relationships: []
      }
      comparison_sessions: {
        Row: {
          average_vote_time_seconds: number | null
          completed_at: string | null
          completed_comparisons: number
          consistency_score: number | null
          id: string
          prompt_id: string
          quality_flags: string[] | null
          session_metadata: Json | null
          started_at: string
          total_comparisons: number
          transitivity_violations: number | null
          user_id: string
          vote_certainty: number | null
        }
        Insert: {
          average_vote_time_seconds?: number | null
          completed_at?: string | null
          completed_comparisons?: number
          consistency_score?: number | null
          id?: string
          prompt_id: string
          quality_flags?: string[] | null
          session_metadata?: Json | null
          started_at?: string
          total_comparisons?: number
          transitivity_violations?: number | null
          user_id: string
          vote_certainty?: number | null
        }
        Update: {
          average_vote_time_seconds?: number | null
          completed_at?: string | null
          completed_comparisons?: number
          consistency_score?: number | null
          id?: string
          prompt_id?: string
          quality_flags?: string[] | null
          session_metadata?: Json | null
          started_at?: string
          total_comparisons?: number
          transitivity_violations?: number | null
          user_id?: string
          vote_certainty?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "comparison_sessions_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      images: {
        Row: {
          created_at: string | null
          id: string
          image_url: string
          is_active: boolean | null
          is_placeholder: boolean | null
          model_name: string
          prompt_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_url: string
          is_active?: boolean | null
          is_placeholder?: boolean | null
          model_name: string
          prompt_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          image_url?: string
          is_active?: boolean | null
          is_placeholder?: boolean | null
          model_name?: string
          prompt_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "images_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "images_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          job_title: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          job_title?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          job_title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      prompt_completions: {
        Row: {
          completed_at: string | null
          id: string
          prompt_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          prompt_id: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          prompt_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompt_completions_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      prompts: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          is_placeholder: boolean | null
          order_index: number
          text: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_placeholder?: boolean | null
          order_index: number
          text: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_placeholder?: boolean | null
          order_index?: number
          text?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prompts_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rankings: {
        Row: {
          average_vote_time_seconds: number | null
          completion_time_seconds: number | null
          confidence_score: number | null
          consistency_score: number | null
          created_at: string | null
          first_id: string
          id: string
          prompt_id: string
          quality_flags: string[] | null
          rating_first: number
          rating_second: number
          rating_third: number
          second_id: string
          third_id: string
          transitivity_violations: number | null
          user_email: string
          user_id: string | null
          user_modified_order: boolean | null
          vote_certainty: number | null
        }
        Insert: {
          average_vote_time_seconds?: number | null
          completion_time_seconds?: number | null
          confidence_score?: number | null
          consistency_score?: number | null
          created_at?: string | null
          first_id: string
          id?: string
          prompt_id: string
          quality_flags?: string[] | null
          rating_first: number
          rating_second: number
          rating_third: number
          second_id: string
          third_id: string
          transitivity_violations?: number | null
          user_email: string
          user_id?: string | null
          user_modified_order?: boolean | null
          vote_certainty?: number | null
        }
        Update: {
          average_vote_time_seconds?: number | null
          completion_time_seconds?: number | null
          confidence_score?: number | null
          consistency_score?: number | null
          created_at?: string | null
          first_id?: string
          id?: string
          prompt_id?: string
          quality_flags?: string[] | null
          rating_first?: number
          rating_second?: number
          rating_third?: number
          second_id?: string
          third_id?: string
          transitivity_violations?: number | null
          user_email?: string
          user_id?: string | null
          user_modified_order?: boolean | null
          vote_certainty?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rankings_first_id_fkey"
            columns: ["first_id"]
            isOneToOne: false
            referencedRelation: "images"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rankings_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rankings_second_id_fkey"
            columns: ["second_id"]
            isOneToOne: false
            referencedRelation: "images"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rankings_third_id_fkey"
            columns: ["third_id"]
            isOneToOne: false
            referencedRelation: "images"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_requests: {
        Row: {
          created_at: string | null
          description: string
          id: string
          status: string | null
          tool_name: string
          updated_at: string | null
          use_case: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          status?: string | null
          tool_name: string
          updated_at?: string | null
          use_case?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          status?: string | null
          tool_name?: string
          updated_at?: string | null
          use_case?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      votes: {
        Row: {
          created_at: string | null
          id: string
          is_tie: boolean | null
          left_image_id: string
          prompt_id: string
          right_image_id: string
          user_email: string
          user_id: string | null
          winner_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_tie?: boolean | null
          left_image_id: string
          prompt_id: string
          right_image_id: string
          user_email: string
          user_id?: string | null
          winner_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_tie?: boolean | null
          left_image_id?: string
          prompt_id?: string
          right_image_id?: string
          user_email?: string
          user_id?: string | null
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "votes_left_image_id_fkey"
            columns: ["left_image_id"]
            isOneToOne: false
            referencedRelation: "images"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_right_image_id_fkey"
            columns: ["right_image_id"]
            isOneToOne: false
            referencedRelation: "images"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "images"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_email_allowed: {
        Args: { user_email: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
