import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, getChapters, clearTokenCache } from '@/lib/xrai-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const subjectId = request.nextUrl.searchParams.get('subject_id');
  if (!subjectId) return NextResponse.json({ error: 'subject_id required' }, { status: 400 });

  try {
    let token = await getAccessToken();
    try {
      const chapters = await getChapters(token, subjectId);
      return NextResponse.json(chapters);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('expired')) {
        clearTokenCache();
        token = await getAccessToken();
        const chapters = await getChapters(token, subjectId);
        return NextResponse.json(chapters);
      }
      throw err;
    }
  } catch (error) {
    console.error('GET /api/xr/chapters error:', error);
    return NextResponse.json({ error: 'Failed to fetch chapters' }, { status: 500 });
  }
}
