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

    if (!type || !data) {
      return NextResponse.json({ error: 'Missing type or data' }, { status: 400 });
    }

    const isArray = Array.isArray(data);
    const items = isArray ? data : [data];
    
    if (items.length === 0) {
      return NextResponse.json({ success: true, message: 'No items to sync.' });
    }

    let tableName = '';
    const payloads: Record<string, any>[] = [];
    const now = new Date().toISOString();

    items.forEach(item => {
      let payload: Record<string, any> = { ...item, synced_at: now };
      switch (type) {
        case 'class':
          tableName = 'xr_classes';
          payload = {
            id: item.id,
            name: item.name,
            grade: item.grade,
            description: item.description,
            is_active: item.is_active !== undefined ? item.is_active : true,
            synced_at: now
          };
          break;
        case 'subject':
          tableName = 'xr_subjects';
          payload = {
            id: item.id,
            class_id: item.class_id,
            name: item.name,
            code: item.code,
            description: item.description,
            is_active: item.is_active !== undefined ? item.is_active : true,
            synced_at: now
          };
          break;
        case 'chapter':
          tableName = 'xr_chapters';
          payload = {
            id: item.id,
            subject_id: item.subject_id,
            name: item.name,
            is_active: item.is_active !== undefined ? item.is_active : true,
            synced_at: now
          };
          break;
        case 'topic':
          tableName = 'xr_topics';
          payload = {
            id: item.id,
            chapter_id: item.chapter_id,
            name: item.name,
            content_url: item.content_url,
            synced_at: now
          };
          break;
      }
      payloads.push(payload);
    });

    if (!tableName) {
      return NextResponse.json({ error: 'Invalid entity type' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from(tableName)
      .upsert(payloads, { onConflict: 'id' });

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, message: `Synced ${items.length} ${type}(s) successfully.` });
  } catch (error) {
    console.error('Error in /api/xr/sync:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
