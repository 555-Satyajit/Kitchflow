const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    await prisma.$executeRawUnsafe('ALTER PUBLICATION supabase_realtime ADD TABLE orders;');
    console.log('orders added to supabase_realtime');
  } catch (e) {
    console.log('orders notice:', e.message);
  }

  try {
    await prisma.$executeRawUnsafe('ALTER PUBLICATION supabase_realtime ADD TABLE order_items;');
    console.log('order_items added to supabase_realtime');
  } catch (e) {
    console.log('order_items notice:', e.message);
  }

  try {
    await prisma.$executeRawUnsafe('ALTER TABLE orders REPLICA IDENTITY FULL;');
    await prisma.$executeRawUnsafe('ALTER TABLE order_items REPLICA IDENTITY FULL;');
    console.log('Replica identity set to FULL');
  } catch (e) {
    console.log('replica identity notice:', e.message);
  }
}

run().finally(() => prisma.$disconnect());
