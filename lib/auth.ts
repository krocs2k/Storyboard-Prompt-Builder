import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { prisma } from './db';

// Function to get Google SSO config from database
export async function getGoogleConfig() {
  try {
    const configs = await prisma.systemConfig.findMany({
      where: {
        key: {
          in: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_SSO_ENABLED']
        }
      }
    });

    const configMap: Record<string, string> = {};
    configs.forEach((c) => {
      configMap[c.key] = c.value;
    });

    return {
      clientId: configMap['GOOGLE_CLIENT_ID'] || process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: configMap['GOOGLE_CLIENT_SECRET'] || process.env.GOOGLE_CLIENT_SECRET || '',
      enabled: configMap['GOOGLE_SSO_ENABLED'] === 'true' || 
               (!!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET)
    };
  } catch {
    return {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      enabled: !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET
    };
  }
}

// Create a custom adapter that handles our isActive and emailVerified fields
function customPrismaAdapter() {
  const adapter = PrismaAdapter(prisma);
  
  return {
    ...adapter,
    createUser: async (data: { name?: string | null; email: string; image?: string | null; emailVerified?: Date | null }) => {
      // Check if this is the first user - make them admin
      const userCount = await prisma.user.count();
      const isFirstUser = userCount === 0;
      
      const user = await prisma.user.create({
        data: {
          ...data,
          emailVerified: new Date(), // OAuth users are verified
          isActive: false, // All new users are inactive by default
          role: isFirstUser ? 'admin' : 'user'
        }
      });
      return user;
    }
  };
}

// Credentials provider (always available)
const credentialsProvider = CredentialsProvider({
  name: 'credentials',
  credentials: {
    email: { label: 'Email', type: 'email' },
    password: { label: 'Password', type: 'password' }
  },
  async authorize(credentials) {
    if (!credentials?.email || !credentials?.password) {
      throw new Error('Email and password required');
    }

    const user = await prisma.user.findUnique({
      where: { email: credentials.email }
    });

    if (!user || !user.password) {
      throw new Error('Invalid email or password');
    }

    const isValid = await bcrypt.compare(credentials.password, user.password);
    if (!isValid) {
      throw new Error('Invalid email or password');
    }

    if (!user.emailVerified) {
      throw new Error('Please verify your email before logging in');
    }

    if (!user.isActive) {
      throw new Error('Your account is pending approval by an administrator');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      role: user.role,
      isActive: user.isActive
    };
  }
});

// Build providers array with dynamic Google config
function getProviders(googleConfig?: { clientId: string; clientSecret: string; enabled: boolean }) {
  const providers: NextAuthOptions['providers'] = [credentialsProvider];

  // Add Google provider if configured
  if (googleConfig?.enabled && googleConfig.clientId && googleConfig.clientSecret) {
    providers.push(
      GoogleProvider({
        clientId: googleConfig.clientId,
        clientSecret: googleConfig.clientSecret,
        allowDangerousEmailAccountLinking: true
      })
    );
  }

  return providers;
}

// Base auth options without Google provider (for static imports)
export const authOptions: NextAuthOptions = {
  adapter: customPrismaAdapter(),
  providers: getProviders(),
  session: {
    strategy: 'jwt'
  },
  callbacks: {
    async signIn({ user, account }) {
      // For OAuth sign in, enforce signup and active checks
      if (account?.provider === 'google') {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
          include: { accounts: true }
        });

        if (!existingUser) {
          // This shouldn't happen because the adapter creates the user before signIn fires,
          // but guard against it just in case
          return '/login?error=Account not found';
        }

        // Check if this is a brand-new OAuth user (just created by the adapter)
        // Brand-new users have isActive=false and were just created
        const isNewUser = !existingUser.isActive && existingUser.accounts.length <= 1;
        
        if (isNewUser) {
          // Check if public registration is disabled
          const signupConfig = await prisma.systemConfig.findUnique({
            where: { key: 'SIGNUP_DISABLED' }
          });
          
          if (signupConfig?.value === 'true') {
            // Registration is disabled — delete the auto-created user and their linked account
            await prisma.account.deleteMany({ where: { userId: existingUser.id } });
            await prisma.user.delete({ where: { id: existingUser.id } });
            return '/login?error=Public registration is disabled. Please contact an administrator for an invitation.';
          }
          
          // Registration is open but new users still need admin approval
          return '/login?error=Your account has been created but requires administrator approval before you can sign in.';
        }

        // Existing user — check if active
        if (!existingUser.isActive) {
          return '/login?error=Your account is pending approval by an administrator';
        }
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role || 'user';
        token.isActive = (user as { isActive?: boolean }).isActive ?? true;
      }
      
      // Handle session update
      if (trigger === 'update' && session) {
        token.name = session.name;
        if (session.isActive !== undefined) {
          token.isActive = session.isActive;
        }
      }
      
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.isActive = token.isActive as boolean;
      }
      return session;
    }
  },
  pages: {
    signIn: '/login',
    error: '/login'
  }
};

// Dynamic auth options that loads Google config from database
export async function getAuthOptionsWithGoogle(): Promise<NextAuthOptions> {
  const googleConfig = await getGoogleConfig();
  
  return {
    ...authOptions,
    providers: getProviders(googleConfig)
  };
}



// Type augmentation for next-auth
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: string;
      isActive: boolean;
    };
  }
  
  interface User {
    role?: string;
    isActive?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
    isActive: boolean;
  }
}
