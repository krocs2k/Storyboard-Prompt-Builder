import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

interface SystemConfig {
  key: string;
  value: string;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const configs = await prisma.systemConfig.findMany({
      where: {
        key: {
          in: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_SSO_ENABLED']
        }
      }
    });

    const configMap: Record<string, string> = {};
    configs.forEach((c: SystemConfig) => {
      configMap[c.key] = c.value;
    });

    return NextResponse.json({
      clientId: configMap['GOOGLE_CLIENT_ID'] || '',
      clientSecretSet: !!configMap['GOOGLE_CLIENT_SECRET'],
      enabled: configMap['GOOGLE_SSO_ENABLED'] === 'true'
    });
  } catch (error) {
    console.error('Failed to fetch Google SSO config:', error);
    return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { clientId, clientSecret, enabled } = await request.json();

    // Update or create configs
    const updates = [];

    if (clientId !== undefined) {
      updates.push(
        prisma.systemConfig.upsert({
          where: { key: 'GOOGLE_CLIENT_ID' },
          create: { key: 'GOOGLE_CLIENT_ID', value: clientId },
          update: { value: clientId }
        })
      );
    }

    if (clientSecret !== undefined && clientSecret !== '') {
      updates.push(
        prisma.systemConfig.upsert({
          where: { key: 'GOOGLE_CLIENT_SECRET' },
          create: { key: 'GOOGLE_CLIENT_SECRET', value: clientSecret },
          update: { value: clientSecret }
        })
      );
    }

    if (enabled !== undefined) {
      updates.push(
        prisma.systemConfig.upsert({
          where: { key: 'GOOGLE_SSO_ENABLED' },
          create: { key: 'GOOGLE_SSO_ENABLED', value: String(enabled) },
          update: { value: String(enabled) }
        })
      );
    }

    await prisma.$transaction(updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update Google SSO config:', error);
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
  }
}
