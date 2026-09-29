"use client";

import { tournamentApiPath } from '@/lib/tournaments';
import { useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { resetConfirmation } from '@/lib/reset-confirmation';
import type { Tournament } from '@/lib/tournament';

export default function ResetTournament<T extends { revision: number } = Tournament>({ tournamentId, revision, demo, disabled, onReset,
  title = demo ? '演示赛事维护' : '第一届赛事维护',
  summary = '将三个组的全部 48 场比赛恢复为待开始。请勿在正式比赛进行中使用。',
  buttonLabel = demo ? '重置演示赛事' : '重置第一届赛事',
  dialogTitle = demo ? '重置演示赛事？' : '重置第一届八猫杯？',
  dialogDescription = '这会清空暹罗、狸花、布偶三个组的选曲、Ban 曲、比分、轮空及晋级结果，恢复最初对阵。选手、rating、曲库和管理员设置保持不变。',
}: {
  tournamentId: string;
  revision: number;
  demo: boolean;
  disabled: boolean;
  onReset: (tournament: T) => void;
  title?: string;
  summary?: string;
  buttonLabel?: string;
  dialogTitle?: string;
  dialogDescription?: string;
}) {
  const [open, setOpen] = useState(false);
  const [expectedRevision, setExpectedRevision] = useState(revision);
  const [confirmation, setConfirmation] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  const phrase = resetConfirmation(demo, tournamentId);
  const changed = revision !== expectedRevision;

  async function submit() {
    if (locked.current || changed || confirmation !== phrase || disabled || error) return;
    locked.current = true;
    setPending(true);
    try {
      const response = await fetch(tournamentApiPath(tournamentId) + '/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation, revision: expectedRevision }),
      });
      const data = await response.json() as { error?: string; tournament: T };
      if (!response.ok) throw new Error(data.error || '重置失败，请关闭窗口后重新检查赛况。');
      onReset(data.tournament);
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '请求中断，请先检查赛况，再决定是否重试。');
    } finally {
      setPending(false);
      locked.current = false;
    }
  }

  return (
    <div className="tournament-reset">
      <h3>{title}</h3>
      <p>{summary}</p>
      <button className="reset-button" disabled={disabled} onClick={() => {
        setExpectedRevision(revision);
        setConfirmation('');
        setError('');
        setOpen(true);
      }}><RotateCcw size={16} />{buttonLabel}</button>
      <AlertDialog open={open} onOpenChange={(value) => { if (!locked.current) setOpen(value); }}>
        <AlertDialogContent className="reset-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>{dialogDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <p className="reset-backup-note">系统会先保存完整赛况备份。恢复备份需要维护人员操作，页面没有撤销按钮。</p>
          <label htmlFor="reset-confirmation">请输入「{phrase}」确认</label>
          <input id="reset-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={pending} autoComplete="off" spellCheck={false} />
          {(error || (changed && !pending)) && <p role="alert" className="reset-error">{error || '赛况已更新，请取消后重新查看，再确认重置。'}</p>}
          <AlertDialogFooter>
            <button className="secondary-button" disabled={pending} onClick={() => setOpen(false)}>取消</button>
            <button className="reset-button" disabled={pending || disabled || changed || !!error || confirmation !== phrase} onClick={() => void submit()}>{pending ? '正在备份并重置…' : '备份并重置赛事'}</button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
