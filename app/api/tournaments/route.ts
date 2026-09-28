import { tournaments } from '@/lib/tournaments';
export function GET() {
  return Response.json({ tournaments });
}
