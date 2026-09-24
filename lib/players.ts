export type GroupId = "siamese" | "tabby" | "ragdoll";
export type Player = { id: string; name: string; seed: number; rating: number };
export type Rosters = Record<GroupId, Player[]>;

export function resolvePlayer(player: Pick<Player, "id" | "seed">, rosters: Rosters): Player {
  const profile = Object.values(rosters).flat().find(p => p.id === player.id);
  if (!profile) throw new Error("Unknown player ID");
  return { ...profile, seed: player.seed };
}
