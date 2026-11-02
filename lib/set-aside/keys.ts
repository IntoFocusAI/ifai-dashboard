/** Fender pilot. Each client gets a row in public.set_aside_clients. */
export const FMIC_CLIENT_KEY = "fmic";

/** Rows in public.set_aside_checks wired into the dashboard so far. */
export const SET_ASIDE_CHECKS = {
  commandCenterQueue: "command_center_queue",
  amazonSpecs: "amazon_specs",
} as const;
