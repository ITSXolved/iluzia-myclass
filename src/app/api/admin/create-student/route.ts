import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { full_name, username, phone, password } = await request.json();

    if (!full_name || !username || !password) {
      return NextResponse.json(
        { error: 'Full name, username, and password are required' },
        { status: 400 }
      );
    }

    const cleanUsername = username.toLowerCase().trim();

    if (!/^[a-z0-9_]{3,30}$/.test(cleanUsername)) {
      return NextResponse.json(
        { error: 'Username must be 3–30 characters: letters, numbers, underscores only' },
        { status: 400 }
      );
    }

    // Internal email derived from username — never shown to the student
    const internalEmail = `${cleanUsername}@iluzia.myclass`;

    // Use service role to create user (bypasses RLS)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Create auth user with internal email
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: internalEmail,
      password,
      email_confirm: true,
      user_metadata: {
        username: cleanUsername,
        full_name,
        phone: phone ?? '',
        role: 'student',
      },
    });

    if (authError) {
      const msg = authError.message.includes('already registered')
        ? 'Username is already taken'
        : authError.message;
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    if (authData.user) {
      // Update profile with username — trigger creates the row, we update username field.
      // Using admin client so this bypasses RLS safely.
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({ username: cleanUsername, email: internalEmail, phone: phone ?? '' })
        .eq('id', authData.user.id);

      if (profileError) {
        console.error('Profile update error:', profileError);
      }
    }

    return NextResponse.json({
      success: true,
      user_id: authData.user?.id,
      username: cleanUsername,
      message: 'Student account created successfully',
    });
  } catch (error) {
    console.error('Create student error:', error);
    return NextResponse.json(
      { error: 'Failed to create student account' },
      { status: 500 }
    );
  }
}
