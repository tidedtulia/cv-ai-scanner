/** Fills `{name}` placeholders: format('{years}+ years', { years: 2 }) → '2+ years'. Unknown ones stay as-is. */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, key: string) => (key in values ? String(values[key]) : placeholder));
}
