import playerData from "../data/players.json";

export type GroupId = keyof typeof playerData;
export type Player = {
  id: string;
  name: string;
  seed: number;
  rating: number;
};

export const rosters: Record<GroupId, Player[]> = playerData;
const playersById = new Map(
  Object.values(rosters).flat().map((player) => [player.id, player]),
);

export function resolvePlayer(player: Pick<Player, "id" | "seed">): Player {
  const profile = playersById.get(player.id);
  if (!profile) throw new Error(`Unknown player ID: ${player.id}`);
  return { ...profile, seed: player.seed };
}
