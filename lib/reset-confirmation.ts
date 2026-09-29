import { CENTURYLINK_TOURNAMENT_ID } from './tournaments';

export const resetConfirmation = (demo: boolean, tournamentId?: string) =>
  demo ? '重置演示赛事' : tournamentId === CENTURYLINK_TOURNAMENT_ID ? '重置第二届世纪汇单店赛' : '重置第一届八猫杯';
