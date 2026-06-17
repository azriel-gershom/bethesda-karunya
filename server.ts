import express from "express";
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { db } from "./src/db/index.js";
import { users, visitors, visits } from "./src/db/schema.js";
import { eq, desc, sql } from "drizzle-orm";
import { createServer } from "http";
import { Server } from "socket.io";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_for_dev";

function requireRole(allowedRoles: string[]) {
  return (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (!allowedRoles.includes(decoded.role)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      req.user = decoded;
      next();
    } catch (err) {
      return res.status(401).json({ error: "Invalid token" });
    }
  };
}

// Ensure default users exist
async function seedUsers() {
  try {
    const existingAdmins = await db.select().from(users).where(eq(users.role, 'ADMIN'));
    if (existingAdmins.length === 0) {
      const hash = await bcrypt.hash('admin123', 10);
      await db.insert(users).values({
        name: 'Super Admin',
        email: 'admin', // we will use email as username
        passwordHash: hash,
        role: 'ADMIN'
      });
      console.log('Seeded ADMIN user');
    }
    
    const existingReceptionists = await db.select().from(users).where(eq(users.role, 'RECEPTIONIST'));
    if (existingReceptionists.length === 0) {
      const hash = await bcrypt.hash('reception123', 10);
      await db.insert(users).values({
        name: 'Front Desk',
        email: 'reception',
        passwordHash: hash,
        role: 'RECEPTIONIST'
      });
      console.log('Seeded RECEPTIONIST user');
    }

    const existingCounselorP = await db.select().from(users).where(eq(users.role, 'COUNSELOR_YOUNG_PARTNER'));
    if (existingCounselorP.length === 0) {
      const hash = await bcrypt.hash('counselor123', 10);
      await db.insert(users).values({
        name: 'Young Partner Counselor',
        email: 'counselor_yp',
        passwordHash: hash,
        role: 'COUNSELOR_YOUNG_PARTNER',
        assignedRoom: 'Young Partner Plan'
      });
      console.log('Seeded COUNSELOR_YOUNG_PARTNER user');
    }

    const existingCounselorB = await db.select().from(users).where(eq(users.role, 'COUNSELOR_BUSINESS'));
    if (existingCounselorB.length === 0) {
      const hash = await bcrypt.hash('counselor123', 10);
      await db.insert(users).values({
        name: 'Business Blessing Counselor',
        email: 'counselor_bb',
        passwordHash: hash,
        role: 'COUNSELOR_BUSINESS',
        assignedRoom: 'Business Blessing'
      });
      console.log('Seeded COUNSELOR_BUSINESS user');
    }
  } catch (err) {
    console.error('Failed to seed users', err);
  }
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "*",
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    }
  });

  io.on("connection", (socket) => {
    console.log("Client connected", socket.id);
    socket.on("disconnect", () => {
      console.log("Client disconnected", socket.id);
    });
  });

  // Add standard middlewares
  app.use(cors({
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  }));
  app.use(express.json());

  // API endpoints
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
      const user = result[0];

      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = jwt.sign(
        { id: user.id, role: user.role, name: user.name },
        JWT_SECRET,
        { expiresIn: "8h" }
      );

      res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/health", async (req, res) => {
    let dbStatus = "not connected";
    try {
      // Light check to DB
      const result = await db.execute('SELECT 1 as result');
      if (result) dbStatus = "connected";
    } catch (e) {
      console.error(e);
      dbStatus = "error";
    }
    
    res.json({ status: "ok", dbStatus });
  });

  // 1. Create a POST /api/visitors endpoint
  app.post("/api/visitors", requireRole(["RECEPTIONIST", "ADMIN"]), async (req, res) => {
    try {
      const { name, phone, age, region, purpose, prayerRequest, assignedPlan } = req.body;

      if (!name || !phone || !purpose) {
         return res.status(400).json({ error: "Missing required fields: name, phone, purpose" });
      }

      const result = await db.transaction(async (tx) => {
        // Check if visitor already exists based on unique phone
        const existingVisitors = await tx
          .select()
          .from(visitors)
          .where(eq(visitors.phone, phone))
          .limit(1);

        let visitorId: number;

        if (existingVisitors.length > 0) {
          visitorId = existingVisitors[0].id;
          // Mark them as returning and optionally update other basic details
          await tx
            .update(visitors)
            .set({ 
              isReturning: true,
              age: age ?? existingVisitors[0].age,
              region: region ?? existingVisitors[0].region
            })
            .where(eq(visitors.id, visitorId));
        } else {
          // Create new visitor
          const newVisitor = await tx
            .insert(visitors)
            .values({
              name,
              phone,
              age,
              region,
              isReturning: false,
            })
            .returning({ id: visitors.id });
            
          visitorId = newVisitor[0].id;
        }

        // Insert the actual context of this visit
        const newVisit = await tx
          .insert(visits)
          .values({
            visitorId,
            purpose,
            prayerRequest,
            assignedPlan,
            status: "WAITING"
          })
          .returning();

        return { 
          visitorId, 
          visitId: newVisit[0].id,
          status: newVisit[0].status,
          checkInTime: newVisit[0].checkInTime,
          isReturning: existingVisitors.length > 0
        };
      });

      io.emit("VisitorAdded", {
        visitId: result.visitId,
        purpose,
        prayerRequest,
        assignedPlan,
        status: result.status,
        checkInTime: result.checkInTime,
        visitor: {
           id: result.visitorId,
           name,
           phone,
           age,
           region,
           isReturning: result.isReturning
        }
      });

      res.status(201).json({ success: true, ...result });

    } catch (error) {
      console.error("Error creating visitor entry:", error);
      res.status(500).json({ error: "Internal server error while processing visitor intake." });
    }
  });

  // 2. Create a GET /api/queue endpoint
  app.get("/api/queue", requireRole(["RECEPTIONIST", "COUNSELOR_YOUNG_PARTNER", "COUNSELOR_BUSINESS", "ADMIN"]), async (req, res) => {
    try {
      // Fetch visits with 'WAITING' status, combined with visitor info
      const queue = await db
        .select({
          visitId: visits.id,
          purpose: visits.purpose,
          prayerRequest: visits.prayerRequest,
          assignedPlan: visits.assignedPlan,
          status: visits.status,
          checkInTime: visits.checkInTime,
          visitor: {
             id: visitors.id,
             name: visitors.name,
             phone: visitors.phone,
             age: visitors.age,
             region: visitors.region,
             isReturning: visitors.isReturning
          }
        })
        .from(visits)
        .innerJoin(visitors, eq(visits.visitorId, visitors.id))
        .where(eq(visits.status, 'WAITING'))
        .orderBy(desc(visits.checkInTime));

      res.status(200).json({ success: true, data: queue });
    } catch (error) {
      console.error("Error fetching wait queue:", error);
      res.status(500).json({ error: "Internal server error fetching queue." });
    }
  });

  // 3. Create a PUT /api/visits/:id/complete endpoint
  app.put("/api/visits/:id/complete", requireRole(["COUNSELOR_YOUNG_PARTNER", "COUNSELOR_BUSINESS", "ADMIN"]), async (req, res) => {
    try {
      const { id } = req.params;
      const visitId = parseInt(id, 10);
      
      const updatedVisit = await db
        .update(visits)
        .set({ status: 'COMPLETED', completionTime: new Date() })
        .where(eq(visits.id, visitId))
        .returning();

      if (updatedVisit.length === 0) {
        return res.status(404).json({ error: "Visit not found" });
      }

      io.emit("VisitorCompleted", { visitId: updatedVisit[0].id });

      res.status(200).json({ success: true, data: updatedVisit[0] });
    } catch (error) {
      console.error("Error completing visit:", error);
      res.status(500).json({ error: "Internal server error completing visit." });
    }
  });

  // 4. Create a GET /api/stats endpoint
  app.get("/api/stats", requireRole(["ADMIN"]), async (req, res) => {
    try {
      // 1. Total Visitors Today
      const visitorsCounts = await db.select({ count: sql`count(*)`.mapWith(Number) }).from(visitors);
      const totalVisitors = visitorsCounts[0]?.count || 0;

      // 2. Queue Status Counts
      const statusCounts = await db.select({
        status: visits.status,
        count: sql`count(*)`.mapWith(Number)
      }).from(visits).groupBy(visits.status);

      let activeWaiting = 0;
      let completedSessions = 0;
      statusCounts.forEach((s: any) => {
        if (s.status === 'WAITING') activeWaiting += s.count;
        if (s.status === 'COMPLETED') completedSessions += s.count;
      });

      // 3. Demographics - Region
      const regionStatsRaw = await db.select({
        region: visitors.region,
        count: sql`count(*)`.mapWith(Number)
      }).from(visitors).groupBy(visitors.region);
      const regionStats = regionStatsRaw.map((s: any) => ({ name: s.region || 'Unknown', value: s.count }));

      // 4. Demographics - Age
      const ageStatsRaw = await db.select({
        age: visitors.age
      }).from(visitors);
      
      const ageBrackets = { '18-25': 0, '26-40': 0, '41-60': 0, '60+': 0, 'Unknown': 0 };
      ageStatsRaw.forEach((v: any) => {
         const age = v.age;
         if (age === null || age === undefined) ageBrackets['Unknown']++;
         else if (age >= 18 && age <= 25) ageBrackets['18-25']++;
         else if (age >= 26 && age <= 40) ageBrackets['26-40']++;
         else if (age >= 41 && age <= 60) ageBrackets['41-60']++;
         else if (age > 60) ageBrackets['60+']++;
         else ageBrackets['Unknown']++;
      });
      const ageStats = Object.keys(ageBrackets).map(name => ({ name, value: ageBrackets[name as keyof typeof ageBrackets] })).filter(b => b.value > 0);

      // 5. Plan Distribution
      const planStatsRaw = await db.select({
        plan: visits.assignedPlan,
        count: sql`count(*)`.mapWith(Number)
      }).from(visits).groupBy(visits.assignedPlan);
      const planStats = planStatsRaw.map((s: any) => ({ name: s.plan || 'Unassigned', value: s.count }));

      // Mock Average Wait Time for now
      const averageWaitTime = "12m";

      res.status(200).json({
        success: true,
        data: {
          metrics: {
            totalVisitors,
            activeWaiting,
            completedSessions,
            averageWaitTime
          },
          regionStats,
          ageStats,
          planStats
        }
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: "Internal server error fetching stats." });
    }
  });

  // Vite middleware for development (MUST be after API routes)
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // NOTE: For real-time functionality (WebSockets/SignalR), we will attach
  // the appropriate server upgrade handlers here in subsequent tasks.

  httpServer.listen(PORT, "0.0.0.0", async () => {
    await seedUsers();
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
