const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

/** Natural order, so "Street 2" comes before "Street 10". */
export function compareNames(a: string, b: string): number {
  return collator.compare(a, b);
}

export function sortByName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => compareNames(a.name, b.name));
}
