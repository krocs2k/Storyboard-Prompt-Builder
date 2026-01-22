import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

// For static export, we need to use the base authOptions
// The dynamic Google config is fetched at runtime in the callbacks
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
