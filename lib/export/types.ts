export type ExportProvenance = {
  filter: string;
  sort: string;
  asOf: string;
  population: string;
};

export type ExportReady = {
  ok: true;
  href: string;
  provenance: ExportProvenance;
  /** Readings that failed while another reading in this export still loaded. */
  failures: string[];
};

export type ExportUnavailable = {
  ok: false;
  message: string;
};

export type ExportModel = ExportReady | ExportUnavailable;

export type BuiltExport =
  | { model: ExportReady; csv: string }
  | { model: ExportUnavailable; csv: null };
