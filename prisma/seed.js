// Seeds the database with a Super Admin, Admin, Garage Manager, Employee, and a sample garage.
// Run with: npm run db:seed

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const garage = await prisma.garage.upsert({
    where: { id: "demo-garage-1" },
    update: {},
    create: {
      id: "demo-garage-1",
      name: "Downtown Garage",
      address: "200 Main St",
      hourlyRate: 5,
    },
  });

  const superAdminPass = await bcrypt.hash("superadmin123", 10);
  const adminPass = await bcrypt.hash("admin123", 10);
  const managerPass = await bcrypt.hash("manager123", 10);
  const employeePass = await bcrypt.hash("employee123", 10);

  await prisma.user.upsert({
    where: { username: "superadmin" },
    update: {},
    create: {
      username: "superadmin",
      passwordHash: superAdminPass,
      name: "Sam Owner",
      role: "SUPER_ADMIN",
    },
  });

  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      passwordHash: adminPass,
      name: "Avery Admin",
      role: "ADMIN",
    },
  });

  await prisma.user.upsert({
    where: { username: "manager" },
    update: { garageId: garage.id },
    create: {
      username: "manager",
      passwordHash: managerPass,
      name: "Morgan Manager",
      role: "GARAGE_MANAGER",
      garageId: garage.id,
    },
  });

  await prisma.user.upsert({
    where: { username: "employee" },
    update: { garageId: garage.id },
    create: {
      username: "employee",
      passwordHash: employeePass,
      name: "Eli Employee",
      role: "EMPLOYEE",
      garageId: garage.id,
    },
  });

  console.log("Seeded:");
  console.log("  Garage -> " + garage.name);
  console.log("  Super Admin -> username: superadmin / password: superadmin123");
  console.log("  Admin -> username: admin / password: admin123");
  console.log("  Garage Manager -> username: manager / password: manager123 (" + garage.name + ")");
  console.log("  Employee -> username: employee / password: employee123 (" + garage.name + ")");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
