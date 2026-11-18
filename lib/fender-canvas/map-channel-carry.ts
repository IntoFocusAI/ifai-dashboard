import { retailListingHeadCountQuery, type RetailCarryChannel } from "@/lib/canvasData";
import type { ChannelCarry, ChannelCarryMap } from "@/lib/fender-canvas/map-reading-status";
import { retailerRecheckDays } from "@/lib/fender-canvas/row-stale";

/** Channel line name, count key, and the client-settings retailer key (null: every client has it). */
const CARRY_CHANNELS: ReadonlyArray<{ name: string; channel: RetailCarryChannel; setting: string | null }> = [
  { name: "Amazon", channel: "amazon", setting: null },
  { name: "Walmart", channel: "walmart", setting: "walmart" },
  { name: "Musician's Friend", channel: "musiciansfriend", setting: "musiciansfriend" },
];

async function carryFor(channel: RetailCarryChannel): Promise<ChannelCarry | null> {
  try {
    const [carried, priced] = await Promise.all([
      retailListingHeadCountQuery({ carriedBy: channel }),
      retailListingHeadCountQuery({ carriedBy: channel, priced: channel }),
    ]);
    if (carried.error || priced.error || carried.count == null || priced.count == null) return null;
    return { carried: carried.count, missing: Math.max(0, carried.count - priced.count) };
  } catch {
    return null;
  }
}

/**
 * Per retailer the client's settings list: the listings it carries, and how many of those have no
 * price read. Listings a retailer does not carry are neither counted nor missing.
 */
export async function loadChannelCarry(): Promise<ChannelCarryMap> {
  const wanted = CARRY_CHANNELS.filter((entry) => entry.setting == null || retailerRecheckDays(entry.setting) != null);
  const reads = await Promise.all(wanted.map((entry) => carryFor(entry.channel)));
  return Object.fromEntries(wanted.map((entry, index) => [entry.name, reads[index]]));
}
