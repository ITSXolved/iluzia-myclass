import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// We need to use service role key to bypass RLS for server-side operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, data } = body;

    if (!type || !data || !data.id) {
      return NextResponse.json({ error: 'Missing type or data.id' }, { status: 400 });
    }

    let tableName = '';
    let payload: Record<string, any> = { ...data, synced_at: new Date().toISOString() };

    // Determine table and format payload based on type
    switch (type) {
      case 'class':
        tableName = 'xr_classes';
        payload = {
          id: data.id,
          name: data.name,
          grade: data.grade,
          description: data.description,
          is_active: data.is_active !== undefined ? data.is_active : true,
          synced_at: payload.synced_at
        };
        break;
      case 'subject':
        tableName = 'xr_subjects';
        payload = {
          id: data.id,
          class_id: data.class_id,
          name: data.name,
          code: data.code,
          description: data.description,
          is_active: data.is_active !== undefined ? data.is_active : true,
          synced_at: payload.synced_at
        };
        break;
      case 'chapter':
        tableName = 'xr_chapters';
        payload = {
          id: data.id,
          subject_id: data.subject_id,
          name: data.name,
          is_active: data.is_active !== undefined ? data.is_active : true,
          synced_at: payload.synced_at
        };
        break;
      case 'topic':
        tableName = 'xr_topics';
        payload = {
          id: data.id,
          chapter_id: data.chapter_id,
          name: data.name,
          content_url: data.content_url,
          synced_at: payload.synced_at
        };
        break;
      default:
        return NextResponse.json({ error: 'Invalid entity type' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from(tableName)
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, message: `Synced ${type} ${data.id} successfully.` });
  } catch (error) {
    console.error('Error in /api/xr/sync:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
