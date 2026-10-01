"use client";
import { useState } from 'react';
import type { GroupId, Player, Tournament } from '@/lib/tournament';
import type { PlayerAction } from '@/lib/player-management';
import { reserves } from '@/lib/player-management';
import PlayerRating from './player-rating';
import * as st from './styles';

type Props = {
  tournament: Tournament; group: GroupId; disabled: boolean;
  onSave: (action: PlayerAction, revision: number) => Promise<boolean>;
};
export default function PlayerManager({ tournament, group, disabled, onSave }: Props) {
  const [draft, setDraft] = useState<{ player: Player | null; name: string; rating: string; revision: number } | null>(null);
  const bench = new Set(reserves(tournament, group).map(p => p.id));
  return <section className={st.playerManager} aria-label="选手资料管理">
    <div className={st.playerManagerHeading}><h2 className={st.sectionTitle}>选手资料</h2>
      <button className={st.secondaryButton} disabled={disabled || !!draft} onClick={() => setDraft({ player: null, name: '', rating: '', revision: tournament.revision })}>新增替补选手</button>
    </div>
    <p className={st.muted}>修改姓名或 rating 后即时保存到云端。新增选手进入本组替补区，可打开首轮比赛详情安排上场。</p>
    {draft && <form className={st.playerEditForm} onSubmit={async e => {
      e.preventDefault();
      const action: PlayerAction = draft.player
        ? { type: 'edit', id: draft.player.id, name: draft.name, rating: Number(draft.rating) }
        : { type: 'add', group, name: draft.name, rating: Number(draft.rating) };
      if (await onSave(action, draft.revision)) setDraft(null);
    }}>
      <h3>{draft.player ? `编辑 ${draft.player.name}` : '新增本组替补'}</h3>
      <label className={st.playerEditLabel}>选手姓名<input className={st.playerEditInput} required maxLength={60} value={draft.name} disabled={disabled} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
      <label className={st.playerEditLabel}>Rating<input className={st.playerEditInput} required type="number" min="0" max="100" step="0.01" value={draft.rating} disabled={disabled} onChange={e => setDraft({ ...draft, rating: e.target.value })} /></label>
      {draft.revision !== tournament.revision && <p role="status">赛事已更新。请取消编辑后重新打开，避免覆盖其他工作人员的修改。</p>}
      <div className={st.playerFormActions}><button className={st.primaryButton} disabled={disabled || draft.revision !== tournament.revision} type="submit">保存资料</button>
        <button className={st.secondaryButton} disabled={disabled} type="button" onClick={() => setDraft(null)}>取消</button></div>
    </form>}
    <div className={st.rosterList}>{tournament.rosters[group].map(p => <div className={st.rosterRow} key={p.id}>
      <span className={st.rosterProfile}><b>{p.name}</b><PlayerRating rating={p.rating} /></span>
      <span className={`${st.muted} shrink-0`}>{bench.has(p.id) ? '替补' : '正赛'}</span>
      <button className={st.secondaryButton} disabled={disabled || !!draft} aria-label={`编辑选手 ${p.name}`} onClick={() => setDraft({ player: p, name: p.name, rating: p.rating.toFixed(2), revision: tournament.revision })}>编辑</button>
    </div>)}</div>
  </section>;
}
