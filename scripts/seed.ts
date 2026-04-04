import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create test admin user (hidden credentials)
  const testAdminEmail = 'john@doe.com';
  const testAdminPassword = 'johndoe123';
  
  const existingAdmin = await prisma.user.findUnique({
    where: { email: testAdminEmail }
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash(testAdminPassword, 12);
    
    await prisma.user.create({
      data: {
        email: testAdminEmail,
        password: hashedPassword,
        name: 'Test Admin',
        role: 'admin',
        isActive: true,
        emailVerified: new Date()
      }
    });
    
    console.log('Test admin user created');
  } else {
    console.log('Test admin user already exists');
  }

  // Create test user for automated testing
  const testUserEmail = 'test@email.com';
  const testUserPassword = 'password123';
  
  const existingTestUser = await prisma.user.findUnique({
    where: { email: testUserEmail }
  });

  if (!existingTestUser) {
    const hashedPassword = await bcrypt.hash(testUserPassword, 12);
    
    await prisma.user.create({
      data: {
        email: testUserEmail,
        password: hashedPassword,
        name: 'Test User',
        role: 'user',
        isActive: true,
        emailVerified: new Date()
      }
    });
    
    console.log('Test user created');
  } else {
    console.log('Test user already exists');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
