/**
 * XR AI Content API — Channel Partner Integration
 *
 * Base URL:    https://www.xraitechnolab.com  (MUST use www)
 * Partner ID:  cp_partner_102
 *
 * Flow:  Token → Classes → Subjects → Chapters → Topics → Player
 *
 * Token:      expires ~24 h, reusable across calls
 * Content URL: presigned_url expires ~1 h — always fetch fresh before playing
 */

const BASE_URL = 'https://www.xraitechnolab.com';
const PARTNER_ID = 'cp_partner_102';

/* ── Token cache ── */
let tokenCache: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(user?: {
  user_name?: string;
  user_email?: string;
  user_phone?: string;
  user_organization?: string;
}): Promise<string> {
  // Reuse if still valid (5-min buffer)
  if (tokenCache && tokenCache.expiresAt > Date.now() + 5 * 60_000) {
    return tokenCache.token;
  }

  const res = await fetch(`${BASE_URL}/api/v1/access-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      partner_id: PARTNER_ID,
      user_id: PARTNER_ID,
      class: '10',
      subject: 'Physics',
      chapter: 'Mechanics',
      topic: 'Force',
      request_time: new Date().toISOString(),
      user_name: user?.user_name ?? 'Iluzia Student',
      user_email: user?.user_email ?? '',
      user_phone: user?.user_phone ?? '',
      user_organization: user?.user_organization ?? 'Iluzia Lab',
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token request failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  const token: string = data.access_token;

  // Cache for ~23 h (tokens last ~24 h)
  tokenCache = { token, expiresAt: Date.now() + 23 * 3600_000 };
  return token;
}

/** Force a fresh token (e.g. after a 401) */
export function clearTokenCache() {
  tokenCache = null;
}

/* ── Helpers ── */
async function apiGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    // No caching — presigned URLs must be fresh
    cache: 'no-store',
  });

  if (res.status === 401) {
    // Token expired — clear cache so caller can retry
    clearTokenCache();
    throw new Error('Token expired — please retry');
  }

  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }

  return res.json();
}

/* ── Content APIs ── */

export interface XRClass {
  id: number;
  name: string;
  grade: string;
  description: string;
  is_active: boolean;
}

export interface XRSubject {
  id: number;
  class_id: number;
  name: string;
  code: string | null;
  description: string | null;
  is_active: boolean;
}

export interface XRChapter {
  id: number;
  subject_id: number;
  name: string;
  is_active?: boolean;
}

export interface XRTopic {
  id: number;
  name: string;
  chapter_id: number;
  content_url: string;
  presigned_url: string;
}

/** GET /classes — all available classes */
export function getClasses(token: string) {
  return apiGet<XRClass[]>(
    '/3dexperiential-learning/api/content/classes',
    token,
  );
}

/** GET /subjects?class_id=… — lazy: called when user clicks a class */
export function getSubjects(token: string, classId: number | string) {
  return apiGet<XRSubject[]>(
    `/3dexperiential-learning/api/content/subjects?class_id=${classId}`,
    token,
  );
}

/** GET /chapters?subject_id=… — lazy: called when user clicks a subject */
export function getChapters(token: string, subjectId: number | string) {
  return apiGet<XRChapter[]>(
    `/3dexperiential-learning/api/content/chapters?subject_id=${subjectId}`,
    token,
  );
}

/** GET /topics?chapter_id=… — lazy: called when user clicks a chapter.
 *  Returns topics with fresh presigned_url / content_url.
 *  ⚠ presigned_url expires after ~1 h — always re-fetch before playing. */
export function getTopics(token: string, chapterId: number | string) {
  return apiGet<XRTopic[]>(
    `/3dexperiential-learning/api/content/topics?chapter_id=${chapterId}`,
    token,
  );
}

/** Build the player page URL.
 *  The player page loads Unity WebGL and calls:
 *    SendMessage("VeekshaLibraryBehaviourController","LoadContentFilePath", url) */
export function getPlayerUrl(contentUrl: string): string {
  return `${BASE_URL}/3dexperiential-learning/player?content=${encodeURIComponent(contentUrl)}`;
}
