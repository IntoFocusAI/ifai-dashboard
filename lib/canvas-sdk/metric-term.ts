/** Definition-tooltip attributes for a slot or picker term, or none when there is nothing to explain. */
export function metricTermAttrs(title: string, desc: string | null | undefined) {
  return desc ? { "data-ifai-tooltip-title": title, "data-ifai-tooltip-desc": desc } : {};
}
