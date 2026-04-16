import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { full_name, email, phone, password } = await request.json();

    if (!full_name || !email || !password) {
      return NextResponse.json(
        { error: 'Full name, email, and password are required' },
        { status: 400 }
      );
    }

    // Use service role to create user
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        phone,
        role: 'student',
      },
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    if (authData.user) {
      // Create profile
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: authData.user.id,
          full_name,
          email,
          phone,
          role: 'student',
          is_paid: false,
        });

      if (profileError) {
        console.error('Profile creation error:', profileError);
      }
    }

    return NextResponse.json({
      success: true,
      user_id: authData.user?.id,
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
