import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, getTopics, clearTokenCache } from '@/lib/xrai-api';

export const dynamic = 'force-dynamic';

/**
 * GET /api/xr/topics?chapter_id=…
 * Also optional: ?topic_id=… to get a single fresh topic URL
 *
 * Topics are always fetched fresh (no cache) because presigned_url
 * expires after ~1 hour.
 */
export async function GET(request: NextRequest) {
  const chapterId = request.nextUrl.searchParams.get('chapter_id');
  if (!chapterId) return NextResponse.json({ error: 'chapter_id required' }, { status: 400 });

  try {
    let token = await getAccessToken();
    try {
      const topics = await getTopics(token, chapterId);
      return NextResponse.json(topics);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('expired')) {
        clearTokenCache();
        token = await getAccessToken();
        const topics = await getTopics(token, chapterId);
        return NextResponse.json(topics);
      }
      throw err;
    }
  } catch (error) {
    console.error('GET /api/xr/topics error:', error);
    return NextResponse.json({ error: 'Failed to fetch topics' }, { status: 500 });
  }
}
