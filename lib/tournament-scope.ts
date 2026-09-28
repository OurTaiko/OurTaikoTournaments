import { RuleError } from './rules';
import { HACHICATS_TOURNAMENT_ID } from './tournaments';

/** Server registry. Public IDs never become database keys directly. */
const definitions = {
  [HACHICATS_TOURNAMENT_ID]: {
    storageId: 'edition-1',
    demoStorageId: 'demo',
    format: 'hachicats-single-elimination',
    authorization: 'existing-hachicats-sso-role',
  },
} as const;

export type TournamentScope = Readonly<{
  tournamentId: string;
  demo: boolean;
}>;

export function resolveTournamentScope(tournamentId: string, demo: boolean): TournamentScope {
  tournamentDefinition(tournamentId);
  return Object.freeze({ tournamentId, demo });
}

export function tournamentDefinition(tournamentId: string) {
  if (!Object.hasOwn(definitions, tournamentId)) throw new RuleError('赛事不存在。', 404);
  return definitions[tournamentId as keyof typeof definitions];
}

export function tournamentStorageId(scope: TournamentScope) {
  const definition = tournamentDefinition(scope.tournamentId);
  return scope.demo ? definition.demoStorageId : definition.storageId;
}

/** Compatibility only: old APIs and maintenance tools address this event. */
export function hachicatsScope(demo: boolean) {
  return resolveTournamentScope(HACHICATS_TOURNAMENT_ID, demo);
}
