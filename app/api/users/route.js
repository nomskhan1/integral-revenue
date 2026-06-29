const bcrypt = require("bcryptjs");
const prisma = require("../../../lib/db");
const { getSessionFromRequest } = require("../../../lib/auth");

async function GET(req) {
  const session = getSessionFromRequest(req);
  if (!session) return new Response(JSON.stringify({ error: "Not signed in." }), { status: 401 });

  if (!["SUPER_ADMIN", "ADMIN", "GARAGE_MANAGER"].includes(session.role)) {
    return new Response(JSON.stringify({ error: "Not allowed." }), { status: 403 });
  }

  // Super Admin's role is now narrowly scoped: create Admins and manage
  // garages only, so they only ever see Admin accounts here — not the
  // operational (Garage Manager/Employee) accounts or anything revenue-
  // related. Garage Managers only see accounts at their own garage. Admin
  // sees everyone except Super Admin.
  let where = {};
  if (session.role === "GARAGE_MANAGER") {
    where = { garageId: session.garageId };
  } else if (session.role === "SUPER_ADMIN") {
    where = { role: "ADMIN" };
  } else if (session.role === "ADMIN") {
    where = { role: { not: "SUPER_ADMIN" } };
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      createdAt: true,
      garage: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return new Response(JSON.stringify(users), { status: 200 });
}

async function POST(req) {
  const session = getSessionFromRequest(req);
  if (!session) return new Response(JSON.stringify({ error: "Not signed in." }), { status: 401 });

  const body = await req.json();
  const { username, password, name } = body || {};
  let { role, garageId } = body || {};

  // Permission rules:
  // - Super Admin can ONLY create Admin accounts (and manage garages —
  //   that's handled in a separate endpoint). They no longer see or touch
  //   garage-level operations or revenue at all.
  // - Admin can create Garage Manager and Employee, but not Admin/Super Admin.
  // - Garage Manager can only create Employee, and only for their own garage.
  if (session.role === "GARAGE_MANAGER") {
    if (role !== "EMPLOYEE") {
      return new Response(JSON.stringify({ error: "Garage Managers can only create Employee accounts." }), {
        status: 403,
      });
    }
    garageId = session.garageId;
  } else if (session.role === "ADMIN") {
    if (!["GARAGE_MANAGER", "EMPLOYEE"].includes(role)) {
      return new Response(
        JSON.stringify({ error: "Admins can only create Garage Manager or Employee accounts." }),
        { status: 403 }
      );
    }
  } else if (session.role === "SUPER_ADMIN") {
    if (role !== "ADMIN") {
      return new Response(JSON.stringify({ error: "Super Admin can only create Admin accounts." }), {
        status: 403,
      });
    }
  } else {
    return new Response(JSON.stringify({ error: "Not allowed." }), { status: 403 });
  }

  if (!username || !password || !name || !["SUPER_ADMIN", "ADMIN", "GARAGE_MANAGER", "EMPLOYEE"].includes(role)) {
    return new Response(
      JSON.stringify({ error: "Name, username, password, and a valid role are required." }),
      { status: 400 }
    );
  }

  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && !garageId) {
    return new Response(JSON.stringify({ error: "Please select a garage for this account." }), {
      status: 400,
    });
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return new Response(JSON.stringify({ error: "That username is already taken." }), {
      status: 409,
    });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { username, passwordHash, name, role, garageId: garageId || null },
  });

  return new Response(
    JSON.stringify({ id: user.id, username: user.username, name: user.name, role: user.role }),
    { status: 201 }
  );
}

module.exports = { GET, POST };
