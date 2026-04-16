import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, getSubjects, clearTokenCache } from '@/lib/xrai-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const classId = request.nextUrl.searchParams.get('class_id');
  if (!classId) return NextResponse.json({ error: 'class_id required' }, { status: 400 });

  try {
    let token = await getAccessToken();
    try {
      const subjects = await getSubjects(token, classId);
      return NextResponse.json(subjects);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('expired')) {
        clearTokenCache();
        token = await getAccessToken();
        const subjects = await getSubjects(token, classId);
        return NextResponse.json(subjects);
      }
      throw err;
    }
  } catch (error) {
    console.error('GET /api/xr/subjects error:', error);
    return NextResponse.json({ error: 'Failed to fetch subjects' }, { status: 500 });
  }
}
