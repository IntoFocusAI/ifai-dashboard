export type ExportProvenance = {
  filter: string;
  sort: string;
  asOf: string;
  population: string;
};

/** One table row. `key` is the React key the on-screen row uses (ASIN or page URL). */
export type ExportRow = { key: string; cells: string[] };

/** Every row one on-screen table can show, read on the server with the table's own query. */
export type ExportSource = {
  table: string;
  header: string[];
  rows: ExportRow[];
  /** The filter the read itself applies, e.g. "Priced below MAP." Null when it applies none. */
  filter: string | null;
  /** The order the table shows before a column header is clicked. */
  sort: string;
  population: string;
  asOf: string;
  /** Set-aside check whose Done and set-aside chips fill a last "Status" column. */
  setAsideCheck?: string;
};

export type SourceRead = { ok: true; source: ExportSource } | { ok: false; message: string };

/** What the browser had on screen when Download CSV was clicked. */
export type ShownRequest = {
  /** Row keys on screen, in screen order. Null downloads every row in the read's own order. */
  keys: string[] | null;
  search: string;
  /** Plain sort sentence, e.g. "MAP, highest first". Null when no header was clicked. */
  sort: string | null;
  /** Plain words for a view filter the table sits under, when its view supplies them. */
  filter: string | null;
};
