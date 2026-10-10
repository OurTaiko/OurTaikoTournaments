import 'server-only';
import { RuleError } from './rules';

/** Public SSO nicknames only. Login usernames are never display fallbacks. */
export async function organizerNicknames(usernames: readonly string[]): Promise<string[]> {
  if (!usernames.length) return [];
  const unavailable = () => new RuleError('暂时无法获取主办方昵称，请稍后重试。', 503);
  try {
    const { SSO_ISSUER, SSO_CLIENT_ID, SSO_CLIENT_SECRET } = process.env;
    if (!SSO_ISSUER || !SSO_CLIENT_ID || !SSO_CLIENT_SECRET) throw unavailable();
    const issuer = new URL(SSO_ISSUER);
    const local = issuer.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(issuer.hostname);
    if ((issuer.protocol !== 'https:' && !local) || issuer.username || issuer.password || issuer.search || issuer.hash)
      throw unavailable();
    const response = await fetch(new URL('/internal/v1/users/lookup', issuer), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Service-ID': SSO_CLIENT_ID, 'X-Service-Key': SSO_CLIENT_SECRET },
      body: JSON.stringify({ usernames }),
      // Only public nicknames may be cached. Permission introspection remains no-store.
      next: { revalidate: 60 }, redirect: 'error', signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw unavailable();
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object' || !('users' in body) || !Array.isArray(body.users)) throw unavailable();
    const names = new Map<string, string>();
    for (const user of body.users) {
      if (user && typeof user.username === 'string' && usernames.includes(user.username) &&
        typeof user.nickname === 'string' && user.nickname.trim()) names.set(user.username, user.nickname);
    }
    return usernames.map(username => {
      const nickname = names.get(username);
      if (!nickname) throw unavailable();
      return nickname;
    });
  } catch {
    // Never expose upstream errors, configuration or account usernames in the response.
    throw unavailable();
  }
}
