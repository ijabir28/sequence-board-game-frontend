import { ApiError, postJson, readJson, request } from './http';

export interface Profile {
  handle: string;
  name: string;
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("That handle and password don't match. Check them and try again.");
    this.name = 'InvalidCredentialsError';
  }
}

/**
 * POST /user/signin. Success is 200 with an empty body and sets the `connect.sid` cookie.
 * Failure is a 302 redirect, which `redirect: 'manual'` exposes as an opaque redirect.
 *
 * Only after a successful sign-in do we call GET /user/profile: without a session that
 * endpoint crashes the backend process.
 */
export async function signIn(handle: string, password: string): Promise<Profile> {
  const response = await postJson('/user/signin', { handle, password }, { redirect: 'manual' });
  if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
    throw new InvalidCredentialsError();
  }
  if (response.status !== 200) {
    throw new ApiError('server', `Sign-in failed with status ${response.status}. Try again.`, response.status);
  }
  const profile = await readJson<Profile>(await request('/user/profile'));
  if (!profile?.handle) throw new ApiError('unexpected', 'Signed in, but the server did not return your profile. Try signing in again.');
  return { handle: profile.handle, name: profile.name ?? profile.handle };
}
