/**
 * Этот файл будет автоматически сгенерирован командой:
 *   npm run db:types
 *
 * Не редактируй его вручную — изменения перетрутся.
 * Запускай команду после каждой миграции БД.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
