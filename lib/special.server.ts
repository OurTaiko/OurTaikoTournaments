import type { GroupId } from "./tournament";
// Never import this module into a client component. Reveal only with a published match.
export const designated: Record<GroupId, { final: string; third: string }> = {
  siamese: { third: "脑浆炸裂GIRL", final: "六兆年零一夜物语" },
  tabby: { third: "尽兴的魔法使", final: "Aloft in the wind（里谱面）" },
  ragdoll: { third: "When Enemies Collapse（里谱面）", final: "Valsqotch" },
};
