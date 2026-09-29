import { RuleError } from './rules';
import { CENTURYLINK_TOURNAMENT_ID, HACHICATS_TOURNAMENT_ID, tournaments, tournamentId } from './tournaments';

/** Server registry. Public IDs never become database keys directly. */
const definitions = {
  [HACHICATS_TOURNAMENT_ID]: {
    demoStorageId: 'demo',
    format: 'hachicats-single-elimination',
    authorization: 'existing-hachicats-sso-role',
  },
  // Explicitly granted: the same SSO client (OurTaikoTournament) admin role manages this event.
  [CENTURYLINK_TOURNAMENT_ID]: {
    demoStorageId: 'demo-centurylink',
    format: 'centurylink-double-elimination',
    authorization: 'ourtaiko-tournaments-sso-role',
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
  const event = tournaments.find(event => event.id === scope.tournamentId);
  if (!event || event.id !== tournamentId(event.seriesSlug, event.edition))
    throw new Error('Tournament ID must match its registered path');
  return scope.demo ? definition.demoStorageId : event.id;
}

export function isCenturyLinkScope(scope: TournamentScope) {
  return tournamentDefinition(scope.tournamentId).format === 'centurylink-double-elimination';
}

/** Compatibility only: old APIs and maintenance tools address this event. */
export function hachicatsScope(demo: boolean) {
  return resolveTournamentScope(HACHICATS_TOURNAMENT_ID, demo);
}
