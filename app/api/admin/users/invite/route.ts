import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { sendInviteEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { email } = await request.json();
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    // Check if user already exists and is active
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser?.isActive) {
      return NextResponse.json({ error: 'A user with this email already exists and is active' }, { status: 400 });
    }

    // Check for existing unused, non-expired invite
    const existingInvite = await prisma.inviteToken.findFirst({
      where: {
        email,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (existingInvite) {
      return NextResponse.json({ error: 'An active invitation already exists for this email' }, { status: 400 });
    }

    // Create invite token (48 hours expiry)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await prisma.inviteToken.create({
      data: {
        email,
        token,
        expiresAt,
        createdBy: (session.user as any).id,
      },
    });

    // Send invitation email
    const sent = await sendInviteEmail(email, token);
    if (!sent) {
      return NextResponse.json({ error: 'Failed to send invitation email' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: `Invitation sent to ${email}` });
  } catch (error) {
    console.error('Invite error:', error);
    return NextResponse.json({ error: 'Failed to send invitation' }, { status: 500 });
  }
}
