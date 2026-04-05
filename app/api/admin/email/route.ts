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

    // Helper: merge form values with saved DB config (for when password is omitted)
    const resolveSmtpConfig = async (body: any) => {
      let { host, port, user, pass } = body;
      const from = body.from;
      // If password not provided, try to use saved config
      if (!pass) {
        const rows = await prisma.systemConfig.findMany({
          where: { key: { in: [...SMTP_KEYS] } },
        });
        const saved = Object.fromEntries(rows.map(r => [r.key, r.value]));
        if (!host) host = saved['SMTP_HOST'];
        if (!port) port = saved['SMTP_PORT'];
        if (!user) user = saved['SMTP_USER'];
        if (!pass) pass = saved['SMTP_PASS'];
        if (!from && !body.from) body.from = saved['SMTP_FROM'];
      }
      if (!host || !user || !pass) return null;
      return {
        host,
        port: parseInt(port || '587'),
        user,
        pass,
        from: from || body.from || user,
        secure: parseInt(port || '587') === 465,
      };
    };

    // ---------- Test connection ----------
    if (action === 'test') {
      const cfg = await resolveSmtpConfig(body);
      if (!cfg) {
        return NextResponse.json({ error: 'Host, user, and password are required (or save a configuration first)' }, { status: 400 });
      }
      const result = await testSmtpConnection(cfg);
      return NextResponse.json(result);
    }

    // ---------- Send test email ----------
    if (action === 'send_test') {
      const { recipient } = body;
      if (!recipient) {
        return NextResponse.json({ error: 'Recipient email is required' }, { status: 400 });
      }
      const cfg = await resolveSmtpConfig(body);
      if (!cfg) {
        return NextResponse.json({ error: 'SMTP credentials are required (or save a configuration first)' }, { status: 400 });
      }
      const result = await sendTestEmail(cfg, recipient);
      return NextResponse.json(result);
    }

    // ---------- Save config ----------
    if (action === 'save') {
      const { host, port, user, from } = body;
      let { pass } = body;

      if (!host || !user) {
        return NextResponse.json({ error: 'Host and user are required' }, { status: 400 });
      }

      // If no password provided, try to use the saved one
      if (!pass) {
        const savedPass = await prisma.systemConfig.findUnique({ where: { key: 'SMTP_PASS' } });
        if (savedPass?.value) {
          pass = savedPass.value;
        } else {
          return NextResponse.json({ error: 'Password is required' }, { status: 400 });
        }
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
