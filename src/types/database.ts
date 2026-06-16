/**
 * Этот файл будет автоматически сгенерирован командой:
 *   npm run db:types
 *
 * Не редактируй его вручную — изменения перетрутся.
 * Запускай команду после каждой миграции БД.
 *
 * Plan-04 (FOUND-05) NOTE: Docker is currently absent on the ship machine
 * (see plan-06-SUMMARY.md "Verification Gaps"), so `npm run db:types`
 * cannot run. The `audit_log` table type definitions below are MANUAL
 * placeholders matching `supabase/migrations/20260524000001_add_audit_log.sql`
 * verbatim. As soon as a developer with Docker runs `npm run db:reset &&
 * npm run db:types`, this file will be auto-regenerated from the live DB
 * schema; the regenerated types will supersede the hand-written placeholder
 * (column names + nullability already match the migration source-of-truth,
 * so the regen should be a no-op diff).
 *
 * Plan-06 (AUTH-03, AUTH-10) UPDATE: same Docker-absent fallback applies.
 * Hand-patched `user_consents` and `rate_limit_log` table types to match
 * supabase/migrations/20260525000001_add_user_consents.sql and
 * supabase/migrations/20260525000002_add_rate_limit_log.sql verbatim.
 * Also added the `consent_purpose` enum to Database.public.Enums.
 * TODO: regenerate via `npm run db:types` when Docker is available — the
 * regen should be a no-op diff against the schema captured here.
 *
 * Plan-04 (P2 LAND-02) NOTE: courses + modules + lessons types are hand-patched
 * here following the same Docker-absent fallback pattern as the P1 audit_log
 * entry. Source-of-truth: supabase/migrations/20260522000001_init_base_tables.sql.
 * As soon as a developer with Docker runs `npm run db:reset && npm run db:types`,
 * this file regenerates from the live DB schema and supersedes the hand-written
 * placeholders; the regen should be a no-op diff (column names + nullability
 * already match the migration verbatim).
 *
 * TODO: regenerate via `npm run db:types` (alias for `supabase gen types ...`)
 *       when Docker is available locally.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      reviews: {
        Row: {
          id: string;
          course_id: string;
          user_id: string;
          author_name: string;
          rating: number;
          body: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          course_id: string;
          user_id: string;
          author_name?: string;
          rating: number;
          body?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          course_id?: string;
          user_id?: string;
          author_name?: string;
          rating?: number;
          body?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          body: string;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type?: string;
          title: string;
          body?: string;
          read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          title?: string;
          body?: string;
          read?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      cases: {
        Row: {
          id: string;
          title: string;
          student_name: string;
          description: string;
          result: string;
          category: string;
          cover_url: string | null;
          video_url: string | null;
          published: boolean;
          order_index: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          student_name?: string;
          description?: string;
          result?: string;
          category: string;
          cover_url?: string | null;
          video_url?: string | null;
          published?: boolean;
          order_index?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          student_name?: string;
          description?: string;
          result?: string;
          category?: string;
          cover_url?: string | null;
          video_url?: string | null;
          published?: boolean;
          order_index?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: string;
          user_id: string | null;
          action: string;
          entity_type: string | null;
          entity_id: string | null;
          meta: Json;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          action: string;
          entity_type?: string | null;
          entity_id?: string | null;
          meta?: Json;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          action?: string;
          entity_type?: string | null;
          entity_id?: string | null;
          meta?: Json;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      user_consents: {
        Row: {
          id: string;
          user_id: string;
          purpose: Database['public']['Enums']['consent_purpose'];
          policy_version: string;
          ip: string | null;
          user_agent: string | null;
          accepted_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          purpose: Database['public']['Enums']['consent_purpose'];
          policy_version: string;
          ip?: string | null;
          user_agent?: string | null;
          accepted_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          purpose?: Database['public']['Enums']['consent_purpose'];
          policy_version?: string;
          ip?: string | null;
          user_agent?: string | null;
          accepted_at?: string;
        };
        Relationships: [];
      };
      rate_limit_log: {
        Row: {
          id: number;
          key: string;
          action: string;
          attempted_at: string;
        };
        Insert: {
          id?: number;
          key: string;
          action: string;
          attempted_at?: string;
        };
        Update: {
          id?: number;
          key?: string;
          action?: string;
          attempted_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          name: string;
          initials: string;
          is_admin: boolean;
          registered_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          initials?: string;
          is_admin?: boolean;
          registered_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          initials?: string;
          is_admin?: boolean;
        };
        Relationships: [];
      };
      courses: {
        Row: {
          id: string;
          slug: string;
          title: string;
          short_description: string;
          long_description: string;
          category: 'ai' | 'photo' | 'video' | 'editing' | 'design' | 'visual' | 'copy';
          students_count: number;
          price_minor: number;
          cover_gradient: string;
          cover_url: string | null;
          published: boolean;
          order_index: number;
          author_name: string | null;
          author_title: string | null;
          author_bio: string | null;
          author_avatar_url: string | null;
          learning_outcomes: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          short_description?: string;
          long_description?: string;
          category: 'ai' | 'photo' | 'video' | 'editing' | 'design' | 'visual' | 'copy';
          students_count?: number;
          price_minor?: number;
          cover_gradient?: string;
          cover_url?: string | null;
          published?: boolean;
          order_index?: number;
          author_name?: string | null;
          author_title?: string | null;
          author_bio?: string | null;
          author_avatar_url?: string | null;
          learning_outcomes?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          title?: string;
          short_description?: string;
          long_description?: string;
          category?: 'ai' | 'photo' | 'video' | 'editing' | 'design' | 'visual' | 'copy';
          students_count?: number;
          price_minor?: number;
          cover_gradient?: string;
          cover_url?: string | null;
          published?: boolean;
          order_index?: number;
          author_name?: string | null;
          author_title?: string | null;
          author_bio?: string | null;
          author_avatar_url?: string | null;
          learning_outcomes?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      modules: {
        Row: {
          id: string;
          course_id: string;
          title: string;
          description: string;
          order_index: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          course_id: string;
          title: string;
          description?: string;
          order_index?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          course_id?: string;
          title?: string;
          description?: string;
          order_index?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      lessons: {
        Row: {
          id: string;
          module_id: string;
          title: string;
          duration_sec: number;
          video_url: string | null;
          content: string | null;
          preview: boolean;
          order_index: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          module_id: string;
          title: string;
          duration_sec?: number;
          video_url?: string | null;
          content?: string | null;
          preview?: boolean;
          order_index?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          module_id?: string;
          title?: string;
          duration_sec?: number;
          video_url?: string | null;
          content?: string | null;
          preview?: boolean;
          order_index?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      // ─── Artum commerce (migration 20260602000001) ───────────────
      payments: {
        Row: {
          id: string;
          user_id: string;
          course_id: string | null;
          amount_minor: number;
          paid_at: string;
          method: 'card' | 'sbp' | 'subscription';
          status: 'pending' | 'succeeded' | 'canceled' | 'refunded';
          created_at: string;
          provider: string | null;
          provider_payment_id: string | null;
          confirmation_url: string | null;
          discount_minor: number;
          promocode: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          course_id?: string | null;
          amount_minor: number;
          paid_at?: string;
          method: 'card' | 'sbp' | 'subscription';
          status?: 'pending' | 'succeeded' | 'canceled' | 'refunded';
          created_at?: string;
          provider?: string | null;
          provider_payment_id?: string | null;
          confirmation_url?: string | null;
          discount_minor?: number;
          promocode?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          course_id?: string | null;
          amount_minor?: number;
          paid_at?: string;
          method?: 'card' | 'sbp' | 'subscription';
          status?: 'pending' | 'succeeded' | 'canceled' | 'refunded';
          provider?: string | null;
          provider_payment_id?: string | null;
          confirmation_url?: string | null;
          discount_minor?: number;
          promocode?: string | null;
        };
        Relationships: [];
      };
      webhook_events: {
        Row: {
          id: string;
          provider: string;
          external_id: string;
          event_type: string | null;
          payload: Record<string, unknown>;
          processed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          provider: string;
          external_id: string;
          event_type?: string | null;
          payload?: Record<string, unknown>;
          processed_at?: string | null;
          created_at?: string;
        };
        Update: {
          processed_at?: string | null;
          event_type?: string | null;
        };
        Relationships: [];
      };
      purchases: {
        Row: {
          user_id: string;
          course_id: string;
          bought_at: string;
          amount_minor: number;
          discount_minor: number;
          payment_id: string | null;
        };
        Insert: {
          user_id: string;
          course_id: string;
          bought_at?: string;
          amount_minor: number;
          discount_minor?: number;
          payment_id?: string | null;
        };
        Update: {
          user_id?: string;
          course_id?: string;
          bought_at?: string;
          amount_minor?: number;
          discount_minor?: number;
          payment_id?: string | null;
        };
        Relationships: [];
      };
      lesson_progress: {
        Row: {
          user_id: string;
          lesson_id: string;
          completed_at: string;
        };
        Insert: {
          user_id: string;
          lesson_id: string;
          completed_at?: string;
        };
        Update: {
          user_id?: string;
          lesson_id?: string;
          completed_at?: string;
        };
        Relationships: [];
      };
      lesson_watch_position: {
        Row: {
          user_id: string;
          lesson_id: string;
          position_sec: number;
          duration_sec: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          lesson_id: string;
          position_sec?: number;
          duration_sec?: number;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          lesson_id?: string;
          position_sec?: number;
          duration_sec?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      certificates: {
        Row: {
          id: string;
          user_id: string;
          course_id: string;
          verification_number: string;
          student_name: string;
          issued_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          course_id: string;
          verification_number: string;
          student_name: string;
          issued_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          course_id?: string;
          verification_number?: string;
          student_name?: string;
          issued_at?: string;
        };
        Relationships: [];
      };
      wishlist: {
        Row: {
          user_id: string;
          course_id: string;
          added_at: string;
        };
        Insert: {
          user_id: string;
          course_id: string;
          added_at?: string;
        };
        Update: {
          user_id?: string;
          course_id?: string;
          added_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          tier: 'all_courses';
          plan_id: string | null;
          is_all_courses: boolean;
          started_at: string;
          expires_at: string;
          amount_minor: number;
          period: 'monthly' | 'yearly';
          cancelled: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          tier?: 'all_courses';
          plan_id?: string | null;
          is_all_courses?: boolean;
          started_at?: string;
          expires_at: string;
          amount_minor: number;
          period: 'monthly' | 'yearly';
          cancelled?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          tier?: 'all_courses';
          plan_id?: string | null;
          is_all_courses?: boolean;
          started_at?: string;
          expires_at?: string;
          amount_minor?: number;
          period?: 'monthly' | 'yearly';
          cancelled?: boolean;
        };
        Relationships: [];
      };
      subscription_plans: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string;
          price_monthly_minor: number;
          price_yearly_minor: number;
          is_all_courses: boolean;
          published: boolean;
          order_index: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description?: string;
          price_monthly_minor?: number;
          price_yearly_minor?: number;
          is_all_courses?: boolean;
          published?: boolean;
          order_index?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          description?: string;
          price_monthly_minor?: number;
          price_yearly_minor?: number;
          is_all_courses?: boolean;
          published?: boolean;
          order_index?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      subscription_plan_courses: {
        Row: {
          plan_id: string;
          course_id: string;
        };
        Insert: {
          plan_id: string;
          course_id: string;
        };
        Update: {
          plan_id?: string;
          course_id?: string;
        };
        Relationships: [];
      };
      subscription_courses: {
        Row: {
          subscription_id: string;
          course_id: string;
        };
        Insert: {
          subscription_id: string;
          course_id: string;
        };
        Update: {
          subscription_id?: string;
          course_id?: string;
        };
        Relationships: [];
      };
      promocodes: {
        Row: {
          id: string;
          code: string;
          type: 'percent' | 'fixed';
          value: number;
          valid_until: string | null;
          uses_left: number | null;
          note: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          type: 'percent' | 'fixed';
          value: number;
          valid_until?: string | null;
          uses_left?: number | null;
          note?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          type?: 'percent' | 'fixed';
          value?: number;
          valid_until?: string | null;
          uses_left?: number | null;
          note?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      rate_limit_log_cleanup: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      user_consents_no_update: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      maybe_issue_certificate: {
        Args: { p_user_id: string; p_lesson_id: string };
        Returns: string | null;
      };
    };
    Enums: {
      consent_purpose: 'pdn_processing' | 'oferta';
    };
  };
}
