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
      courses: {
        Row: {
          id: string;
          slug: string;
          title: string;
          description: string | null;
          cover_url: string | null;
          order_index: number;
          published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: string;
          description?: string | null;
          cover_url?: string | null;
          order_index?: number;
          published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          title?: string;
          description?: string | null;
          cover_url?: string | null;
          order_index?: number;
          published?: boolean;
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
          description: string | null;
          order_index: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          course_id: string;
          title: string;
          description?: string | null;
          order_index?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          course_id?: string;
          title?: string;
          description?: string | null;
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
          description: string | null;
          video_id: string | null;
          duration_sec: number;
          order_index: number;
          is_preview: boolean;
          published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          module_id: string;
          title: string;
          description?: string | null;
          video_id?: string | null;
          duration_sec?: number;
          order_index?: number;
          is_preview?: boolean;
          published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          module_id?: string;
          title?: string;
          description?: string | null;
          video_id?: string | null;
          duration_sec?: number;
          order_index?: number;
          is_preview?: boolean;
          published?: boolean;
          created_at?: string;
          updated_at?: string;
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
    };
    Enums: {
      consent_purpose: 'pdn_processing' | 'oferta';
    };
  };
}
