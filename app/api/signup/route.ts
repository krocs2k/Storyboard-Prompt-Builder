import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { sendVerificationEmail } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Check if public signup is disabled
    const signupConfig = await prisma.systemConfig.findUnique({
      where: { key: 'SIGNUP_DISABLED' },
    });
    if (signupConfig?.value === 'true') {
      return NextResponse.json(
        { error: 'Public registration is currently disabled. Please contact an administrator for an invitation.' },
        { status: 403 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 400 }
      );
    }

    // Check if this is the first user - make them admin
    const userCount = await prisma.user.count();
    const isFirstUser = userCount === 0;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user (inactive by default)
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null,
        isActive: isFirstUser, // First user is auto-activated
        role: isFirstUser ? 'admin' : 'user'
      }
    });

    // Generate verification token
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token,
        expires,
        type: 'email'
      }
    });

    // Send verification email
    await sendVerificationEmail(email, token, name);

    return NextResponse.json({
      success: true,
      message: isFirstUser 
        ? 'Account created! Please check your email to verify your account. As the first user, you have been granted admin privileges.'
        : 'Account created! Please check your email to verify your account. After verification, an administrator will need to approve your account.'
    });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}
