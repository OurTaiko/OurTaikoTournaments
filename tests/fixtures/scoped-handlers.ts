// Exercise the actual Next.js scoped routes with the legacy test helper signatures.
import { GET as state } from '../../app/api/tournaments/[series]/[edition]/route';
import { GET as songs } from '../../app/api/tournaments/[series]/[edition]/songs/route';
import { GET as matchGet, POST as matchPost } from '../../app/api/tournaments/[series]/[edition]/matches/[id]/route';
import { POST as players } from '../../app/api/tournaments/[series]/[edition]/players/route';
import { POST as reset } from '../../app/api/tournaments/[series]/[edition]/reset/route';
const route = { series: 'hachicats', edition: '20260927' };
const context = () => ({ params: Promise.resolve(route) });
const request = () => new Request('http://127.0.0.1/api/tournaments/hachicats/20260927');
export const tournamentGET = () => state(request(), context());
export const songGET = () => songs(request(), context());
export const playerPOST = (req: Request) => players(req, context());
export const resetPOST = (req: Request) => reset(req, context());
export const matchGET = async (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  matchGet(req, { params: Promise.resolve({ ...(await params), ...route }) });
export const matchPOST = async (req: Request, { params }: { params: Promise<{ id: string }> }) =>
  matchPost(req, { params: Promise.resolve({ ...(await params), ...route }) });
