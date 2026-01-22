import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface SystemConfig {
  key: string;
  value: string;
}

export async function GET() {
  try {
    // First check environment variables
    const envClientId = process.env.GOOGLE_CLIENT_ID;
    const envClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    
    if (envClientId && envClientSecret) {
      return NextResponse.json({ enabled: true });
    }

    // Then check database config
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
