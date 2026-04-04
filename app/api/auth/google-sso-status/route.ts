import { NextResponse } from 'next/server';
import { getGoogleConfig } from '@/lib/auth';

// Force dynamic to always read from database
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const googleConfig = await getGoogleConfig();
    return NextResponse.json({ enabled: googleConfig.enabled });
  } catch {
    return NextResponse.json({ enabled: false });
  }
}
