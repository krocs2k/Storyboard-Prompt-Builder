export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { testSmtpConnection, sendTestEmail, invalidateSmtpCache } from '@/lib/email';

const SMTP_KEYS = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'] as const;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rows = await prisma.systemConfig.findMany({
      where: { key: { in: [...SMTP_KEYS] } },
    });
    const cfg = Object.fromEntries(rows.map(r => [r.key, r.value]));

    const configured = !!(cfg['SMTP_HOST'] && cfg['SMTP_USER'] && cfg['SMTP_PASS']);
    return NextResponse.json({
      configured,
      host: cfg['SMTP_HOST'] || null,
      port: cfg['SMTP_PORT'] || '587',
      user: cfg['SMTP_USER'] || null,
      from: cfg['SMTP_FROM'] || cfg['SMTP_USER'] || null,
      // Never return password
      hasPassword: !!cfg['SMTP_PASS'],
    });
  } catch (err) {
    console.error('Email config GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string }).role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action } = body;

    // ---------- Test connection ----------
    if (action === 'test') {
      const { host, port, user, pass } = body;
      if (!host || !user || !pass) {
        return NextResponse.json({ error: 'Host, user, and password are required' }, { status: 400 });
      }
      const result = await testSmtpConnection({
        host, port: parseInt(port || '587'), user, pass,
        from: body.from || user, secure: parseInt(port || '587') === 465,
      });
      return NextResponse.json(result);
    }

    // ---------- Send test email ----------
    if (action === 'send_test') {
      const { host, port, user, pass, from, recipient } = body;
      if (!host || !user || !pass || !recipient) {
        return NextResponse.json({ error: 'All fields and recipient are required' }, { status: 400 });
      }
      const result = await sendTestEmail(
        { host, port: parseInt(port || '587'), user, pass, from: from || user, secure: parseInt(port || '587') === 465 },
        recipient,
      );
      return NextResponse.json(result);
    }

    // ---------- Save config ----------
    if (action === 'save') {
      const { host, port, user, pass, from } = body;
      if (!host || !user || !pass) {
        return NextResponse.json({ error: 'Host, user, and password are required' }, { status: 400 });
      }

      // Test before saving
      const testResult = await testSmtpConnection({
        host, port: parseInt(port || '587'), user, pass,
        from: from || user, secure: parseInt(port || '587') === 465,
      });
      if (!testResult.success) {
        return NextResponse.json({ error: `Connection failed: ${testResult.error}` }, { status: 400 });
      }

      // Upsert all keys
      const values: Record<string, string> = {
        SMTP_HOST: host,
        SMTP_PORT: String(port || '587'),
        SMTP_USER: user,
        SMTP_PASS: pass,
        SMTP_FROM: from || user,
      };
      for (const [key, value] of Object.entries(values)) {
        await prisma.systemConfig.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        });
      }

      invalidateSmtpCache();
      return NextResponse.json({ success: true });
    }

    // ---------- Delete config ----------
    if (action === 'delete') {
      await prisma.systemConfig.deleteMany({
        where: { key: { in: [...SMTP_KEYS] } },
      });
      invalidateSmtpCache();
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    console.error('Email config POST error:', err);
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }
}
