export interface PreparedQuery {
  bind(...values: (string | number | null)[]): PreparedQuery;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<{ meta: { changes: number } }>;
}
export interface Database { prepare(sql: string): PreparedQuery }
