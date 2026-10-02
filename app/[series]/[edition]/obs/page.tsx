import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ObsOverlay from "@/components/obs/obs-overlay";
import { tournamentApiPath, tournaments } from "@/lib/tournaments";
import { tournamentDefinition } from "@/lib/tournament-scope";

type Props = { params: Promise<{ series: string; edition: string }> };

export function generateStaticParams() {
  return tournaments.map(event => ({ series: event.seriesSlug, edition: event.edition }));
}

function eventFor(series: string, edition: string) {
  const event = tournaments.find(event => event.seriesSlug === series && event.edition === edition);
  if (!event) notFound();
  // Directory entries alone never enable an unregistered tournament backend.
  tournamentDefinition(event.id);
  return event;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { series, edition } = await params;
  const event = eventFor(series, edition);
  return { title: `${event.name} · OBS 对阵`, robots: { index: false, follow: false } };
}

export default async function ObsPage({ params }: Props) {
  const { series, edition } = await params;
  const event = eventFor(series, edition);
  return <ObsOverlay key={event.id} name={event.name} apiPath={event.archived ? null : tournamentApiPath(event.id)} />;
}
