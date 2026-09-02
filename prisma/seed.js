const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const COLUMN_NAMES = ['Column 1', 'Column 2', 'Column 3', 'Column 4', 'Column 5', 'The Nomads'];
const DEMO_PASSWORD = 'password123';

async function main() {
  const columns = {};
  for (const name of COLUMN_NAMES) {
    columns[name] = await prisma.column.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const demoColumn = columns['The Nomads'];
  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 12);

  const demoUser = await prisma.user.upsert({
    where: { id: 'demo-user' },
    update: { columnId: demoColumn.id, password: hashedPassword, role: 'ADMIN' },
    create: {
      id: 'demo-user',
      name: 'Demo User',
      email: 'demo@example.com',
      password: hashedPassword,
      role: 'ADMIN',
      columnId: demoColumn.id,
    },
  });

  const memberUser = await prisma.user.upsert({
    where: { id: 'demo-member' },
    update: { columnId: demoColumn.id, password: hashedPassword, role: 'MEMBER' },
    create: {
      id: 'demo-member',
      name: 'Demo Member',
      email: 'member@example.com',
      password: hashedPassword,
      role: 'MEMBER',
      columnId: demoColumn.id,
    },
  });

  console.log('Seeded columns:', Object.keys(columns));
  console.log('Seeded admin user:', demoUser.id, '-> column:', demoColumn.id);
  console.log('Seeded member user:', memberUser.id, '-> column:', demoColumn.id);
  console.log(`Admin login: ${demoUser.email} / ${DEMO_PASSWORD}`);
  console.log(`Member login: ${memberUser.email} / ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
