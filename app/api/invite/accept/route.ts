import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Validate invite token
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const invite = await prisma.inviteToken.findUnique({ where: { token } });

    if (!invite) {
      return NextResponse.json({ error: 'Invalid invitation link' }, { status: 404 });
    }

    if (invite.usedAt) {
      return NextResponse.json({ error: 'This invitation has already been used' }, { status: 410 });
    }

    if (new Date() > invite.expiresAt) {
      return NextResponse.json({ error: 'This invitation has expired' }, { status: 410 });
    }

    return NextResponse.json({ valid: true, email: invite.email });
  } catch (error) {
    console.error('Invite validation error:', error);
    return NextResponse.json({ error: 'Failed to validate invitation' }, { status: 500 });
  }
}

// Accept invitation - create/activate user
export async function POST(request: Request) {
  try {
    const { token, password, name } = await request.json();

    if (!token || !password) {
      return NextResponse.json({ error: 'Token and password are required' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const invite = await prisma.inviteToken.findUnique({ where: { token } });

    if (!invite) {
      return NextResponse.json({ error: 'Invalid invitation link' }, { status: 404 });
    }

    if (invite.usedAt) {
      return NextResponse.json({ error: 'This invitation has already been used' }, { status: 410 });
    }

    if (new Date() > invite.expiresAt) {
      return NextResponse.json({ error: 'This invitation has expired' }, { status: 410 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Create or update user - invited users are auto-verified and auto-activated
    const existingUser = await prisma.user.findUnique({ where: { email: invite.email } });

    if (existingUser) {
      await prisma.user.update({
        where: { email: invite.email },
        data: {
          password: hashedPassword,
          name: name || existingUser.name,
          isActive: true,
          emailVerified: new Date(),
        },
      });
    } else {
      await prisma.user.create({
        data: {
          email: invite.email,
          password: hashedPassword,
          name: name || null,
          isActive: true,
          emailVerified: new Date(),
          role: 'user',
        },
      });
    }

    // Mark invite as used
    await prisma.inviteToken.update({
      where: { token },
      data: { usedAt: new Date() },
    });

    return NextResponse.json({ success: true, message: 'Account set up successfully! You can now log in.' });
  } catch (error) {
    console.error('Invite accept error:', error);
    return NextResponse.json({ error: 'Failed to set up account' }, { status: 500 });
  }
}
