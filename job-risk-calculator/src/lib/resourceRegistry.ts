import type { ResourceRegistry, ResourceRegistryEntry } from '../types'

let cached: ResourceRegistry | null = null

export async function loadResourceRegistry(): Promise<ResourceRegistry> {
  if (cached) return cached
  const mod = (await import('../data/resources.json')) as
    | { default: ResourceRegistry }
    | ResourceRegistry
  cached = 'default' in mod ? mod.default : (mod as ResourceRegistry)
  return cached
}

export function filterRegistryForProfile(
  registry: ResourceRegistryEntry[],
  socMajorGroup: string,
  cap: number,
): ResourceRegistryEntry[] {
  const matching = registry.filter((entry) =>
    entry.occupational_families.includes(socMajorGroup),
  )
  if (matching.length >= 4) return matching.slice(0, cap)
  const byBreadth = [...registry].sort(
    (a, b) => b.occupational_families.length - a.occupational_families.length,
  )
  const seen = new Set(matching.map((e) => e.id))
  for (const entry of byBreadth) {
    if (matching.length >= cap) break
    if (seen.has(entry.id)) continue
    matching.push(entry)
    seen.add(entry.id)
  }
  return matching.slice(0, cap)
}

export function resolveRegistryId(
  registry: ResourceRegistryEntry[],
  id: string,
): ResourceRegistryEntry | null {
  return registry.find((entry) => entry.id === id) ?? null
}
