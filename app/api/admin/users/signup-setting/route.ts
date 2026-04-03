import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/db';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: 'SIGNUP_DISABLED' },
    });
    return NextResponse.json({ signupDisabled: config?.value === 'true' });
  } catch (error) {
    console.error('Error fetching signup setting:', error);
    return NextResponse.json({ signupDisabled: false });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { disabled } = await request.json();

    await prisma.systemConfig.upsert({
      where: { key: 'SIGNUP_DISABLED' },
      update: { value: disabled ? 'true' : 'false' },
      create: { key: 'SIGNUP_DISABLED', value: disabled ? 'true' : 'false' },
    });

    return NextResponse.json({ success: true, signupDisabled: disabled });
  } catch (error) {
    console.error('Error updating signup setting:', error);
    return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 });
  }
}
