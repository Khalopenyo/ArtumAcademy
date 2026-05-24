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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
