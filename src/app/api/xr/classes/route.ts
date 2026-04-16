import { NextResponse } from 'next/server';
import { getAccessToken, getClasses, clearTokenCache } from '@/lib/xrai-api';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let token = await getAccessToken();
    try {
      const classes = await getClasses(token);
      return NextResponse.json(classes);
    } catch (err: unknown) {
      // Auto-retry once on token expired
      if (err instanceof Error && err.message.includes('expired')) {
        clearTokenCache();
        token = await getAccessToken();
        const classes = await getClasses(token);
        return NextResponse.json(classes);
      }
      throw err;
    }
  } catch (error) {
    console.error('GET /api/xr/classes error:', error);
    return NextResponse.json({ error: 'Failed to fetch classes' }, { status: 500 });
  }
}
