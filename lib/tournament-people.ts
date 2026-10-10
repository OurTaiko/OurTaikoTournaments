import { z } from 'zod';

const username = z.string().min(1).max(24).regex(/^\S+$/u);
const peopleSchema = z.object({
  organizers: z.array(username).max(100),
  admins: z.array(username).max(100),
}).strict();

export type TournamentPeople = z.infer<typeof peopleSchema>;

export function parseTournamentPeople(value: unknown): TournamentPeople {
  const result = peopleSchema.safeParse(value);
  if (!result.success) throw new Error('赛事人员配置无效');
  return { organizers: [...new Set(result.data.organizers)], admins: [...new Set(result.data.admins)] };
}

/** Old records have no event-specific grants until explicitly configured. */
export function tournamentPeopleFromDocument(document: { organizers?: unknown; admins?: unknown }): TournamentPeople {
  return parseTournamentPeople({ organizers: document.organizers ?? [], admins: document.admins ?? [] });
}
