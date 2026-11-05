export const UPLOAD_PATH = "/dashboard/upload";

export const UPLOAD_PAGE = {
  titleLead: "Upload a catalog or",
  titleTail: "file",
  backLabel: "Back to dashboard",
  lead: "Stage a catalog file or a MAP file. A repeated key is marked as a duplicate and stays out of the pending set.",
  approveLine: "Approved here means the file is accepted. It does not change the live catalog yet.",
  kindLegend: "What is in this file?",
  catalog: "Catalog",
  map: "MAP",
  mapDesc:
    "Minimum Advertised Price: the lowest price a retail partner has agreed to display publicly. Partners get around it by bundling a cheap accessory and discounting the pair.",
  nameLabel: "Your name",
  fileLabel: "CSV or TSV file",
  saveLabel: "Save pending rows",
  approveLabel: "Approve",
  notAvailable: "Not available*",
  notAvailableSaved: "The staging table is not in the database yet, so this file has no saved copy.",
  notAvailableStaged: "The staging table is not in the database yet, so this file is checked against itself only.",
} as const;

export function uploadPageStrings(): string[] {
  return Object.values(UPLOAD_PAGE);
}
