import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface SystemConfig {
  key: string;
  value: string;
}

export async function GET() {
  try {
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

    const enabled = configMap['GOOGLE_SSO_ENABLED'] === 'true' &&
      !!configMap['GOOGLE_CLIENT_ID'] &&
      !!configMap['GOOGLE_CLIENT_SECRET'];

    return NextResponse.json({ enabled });
  } catch {
    return NextResponse.json({ enabled: false });
  }
}
