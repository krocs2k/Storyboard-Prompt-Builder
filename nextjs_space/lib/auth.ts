import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { prisma } from './db';

// Function to get Google SSO config from database
async function getGoogleConfig() {
  try {
    const clientIdConfig = await prisma.systemConfig.findUnique({
      where: { key: 'GOOGLE_CLIENT_ID' }
    });
    const clientSecretConfig = await prisma.systemConfig.findUnique({
      where: { key: 'GOOGLE_CLIENT_SECRET' }
    });
    const enabledConfig = await prisma.systemConfig.findUnique({
      where: { key: 'GOOGLE_SSO_ENABLED' }
    });

    return {
      clientId: clientIdConfig?.value || process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: clientSecretConfig?.value || process.env.GOOGLE_CLIENT_SECRET || '',
      enabled: enabledConfig?.value === 'true'
    };
  } catch {
    return {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      enabled: false
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

// Build providers array dynamically
function getProviders() {
  const providers: NextAuthOptions['providers'] = [
    CredentialsProvider({
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
          role: user.role
        };
      }
    })
  ];

  // Add Google provider if configured via environment variables
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET
      })
    );
  }

  return providers;
}

export const authOptions: NextAuthOptions = {
  adapter: customPrismaAdapter(),
  providers: getProviders(),
  session: {
    strategy: 'jwt'
  },
  callbacks: {
    async signIn({ user, account }) {
      // For OAuth sign in, check if user is active
      if (account?.provider === 'google') {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! }
        });

        if (existingUser && !existingUser.isActive) {
          return '/login?error=Your account is pending approval by an administrator';
        }
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role || 'user';
      }
      
      // Handle session update
      if (trigger === 'update' && session) {
        token.name = session.name;
      }
      
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    }
  },
  pages: {
    signIn: '/login',
    error: '/login'
  }
};

// Dynamic auth options with Google provider from database
export async function getAuthOptions(): Promise<NextAuthOptions> {
  const googleConfig = await getGoogleConfig();
  
  const providers: NextAuthOptions['providers'] = [...authOptions.providers];
  
  // Add Google provider from database config if enabled and not already added via env vars
  if (googleConfig.enabled && googleConfig.clientId && googleConfig.clientSecret) {
    // Check if Google provider already exists from env vars
    const hasGoogleProvider = providers.some(
      p => 'id' in p && p.id === 'google'
    );
    
    if (!hasGoogleProvider) {
      providers.push(
        GoogleProvider({
          clientId: googleConfig.clientId,
          clientSecret: googleConfig.clientSecret
        })
      );
    }
  }
  
  return {
    ...authOptions,
    providers
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
    };
  }
  
  interface User {
    role?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
  }
}
