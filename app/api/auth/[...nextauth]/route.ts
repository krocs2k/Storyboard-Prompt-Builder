import NextAuth from 'next-auth';
import { NextRequest } from 'next/server';
import { getAuthOptionsWithGoogle } from '@/lib/auth';

// Dynamic handler that loads Google SSO config from database
async function handler(req: NextRequest, context: { params: { nextauth: string[] } }) {
  const authOptions = await getAuthOptionsWithGoogle();
  return NextAuth(req, context, authOptions);
}

export { handler as GET, handler as POST };
