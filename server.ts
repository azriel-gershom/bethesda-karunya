import express from "express";
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { db } from "./src/db/index.js";
import { users, visitors, visits, volunteers, assignments, volunteerLanguages, volunteerAvailability } from "./src/db/schema.js";
import { eq, desc, sql, and, ne, inArray } from "drizzle-orm";
import { assignVolunteer, reassignVolunteer } from "./src/services/volunteerAssigner.js";
import { createServer } from "http";
import { Server } from "socket.io";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  ROLE_ADMIN,
  ROLE_EMPLOYEE,
  ROLE_VOLUNTEER,
  CAN_ADD_VISITORS,
  CAN_VIEW_QUEUE,
  CAN_COMPLETE_VISIT,
  CAN_VIEW_PRAYERS,
  CAN_VIEW_COUNSELING_CASES,
  ADMIN_ONLY,
  VOLUNTEER_SELF,
  COUNSELOR_SELF,
  CAN_EDIT_VOLUNTEER_PROFILE,
  isCounselor,
  getCounselorRoom,
  ALL_ROLES,
} from "./src/shared/roles.js";

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_for_dev";

// Extend Express Request type to include user from JWT middleware
declare global {
  namespace Express {
    interface Request {
      user?: { id: number; role: string; name: string };
    }
  }
}

// =============================================
// MIDDLEWARE: Role-Based Access Control
// =============================================
//
// How it works:
// 1. Every protected route calls requireRole(PERMISSION_SET).
// 2. The permission sets are defined in src/shared/roles.ts.
// 3. ADMIN is ALWAYS allowed — even if not in the permission set.
//    This guarantees admins can never be accidentally locked out.
//
// Examples:
//   app.get('/api/queue',  requireRole(CAN_VIEW_QUEUE),  handler);  // All staff
//   app.get('/api/stats',  requireRole(ADMIN_ONLY),       handler);  // Admin only
//   app.put('/api/volunteers/me/availability',
//           requireRole(VOLUNTEER_SELF), handler);                   // Volunteers only
// =============================================

/**
 * requireRole — Express middleware factory for role-based route protection.
 *
 * @param allowedRoles  A readonly array of role strings that may access this
 *                      route.  Import one of the pre-built permission sets
 *                      from src/shared/roles.ts (CAN_ADD_VISITORS, etc.).
 *
 * Behaviour:
 *   - Extracts and verifies the JWT from the Authorization header.
 *   - Checks decoded.role against allowedRoles.
 *   - ADMIN is implicitly allowed on EVERY route.
 *   - Attaches decoded user to req.user for downstream handlers.
 */
function requireRole(allowedRoles: readonly string[]) {
  return (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;

      // ADMIN always passes — they have unrestricted access.
      const isAllowed =
        decoded.role === ROLE_ADMIN || allowedRoles.includes(decoded.role);

      if (!isAllowed) {
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

    // Seed a default VOLUNTEER user
    const existingVolunteers = await db.select().from(users).where(eq(users.role, 'VOLUNTEER'));
    if (existingVolunteers.length === 0) {
      const hash = await bcrypt.hash('volunteer123', 10);
      const [newUser] = await db.insert(users).values({
        name: 'Test Volunteer',
        email: 'volunteer',
        passwordHash: hash,
        role: 'VOLUNTEER'
      }).returning();

      // Also create the volunteer profile
      // Also create the volunteer profile
      const [newVol] = await db.insert(volunteers).values({
        userId: newUser.id,
        fullName: 'Test Volunteer',
        phone: '123-456-7890',
        department: 'General',
        status: 'active',
        maxTasksPerDay: 5,
      }).returning();
      
      await db.insert(volunteerLanguages).values([
        { volunteerId: newVol.id, language: 'English' },
        { volunteerId: newVol.id, language: 'Hindi' }
      ]);
      console.log('Seeded VOLUNTEER user with profile');
    }

    // Seed a default EMPLOYEE user (new role — general staff)
    const existingEmployees = await db.select().from(users).where(eq(users.role, 'EMPLOYEE'));
    if (existingEmployees.length === 0) {
      const hash = await bcrypt.hash('employee123', 10);
      await db.insert(users).values({
        name: 'Staff Member',
        email: 'employee',
        passwordHash: hash,
        role: 'EMPLOYEE',
      });
      console.log('Seeded EMPLOYEE user');
    }

    // Seed a default generic COUNSELOR user (new role — room assigned via assignedRoom)
    const existingCounselors = await db.select().from(users).where(eq(users.role, 'COUNSELOR'));
    if (existingCounselors.length === 0) {
      const hash = await bcrypt.hash('counselor123', 10);
      await db.insert(users).values({
        name: 'General Counselor',
        email: 'counselor',
        passwordHash: hash,
        role: 'COUNSELOR',
        assignedRoom: 'General',
      });
      console.log('Seeded COUNSELOR user');
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
  // Visitor intake — Admin, Employee, Receptionist can add visitors
  app.post("/api/visitors", requireRole(CAN_ADD_VISITORS), async (req, res) => {
    try {
      const { name, phone, age, region, language, purpose, prayerRequest, assignedPlan } = req.body;

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
              region: region ?? existingVisitors[0].region,
              language: language ?? existingVisitors[0].language
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
              language,
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
           language,
           isReturning: result.isReturning
        }
      });

      // Auto-assign a volunteer if available
      let assignedVolunteer = null;
      let assignmentStatus = "UNASSIGNED";
      try {
        const assignment = await assignVolunteer({
          visitId: result.visitId,
          purpose,
          language: language || null,
        });
        if (assignment) {
          assignedVolunteer = assignment;
          assignmentStatus = "ASSIGNED";
          io.emit("VolunteerAssigned", {
            assignmentId: assignment.assignmentId,
            volunteerId: assignment.volunteerId,
            visitId: result.visitId,
            taskType: 'VISITOR_ENGAGEMENT',
          });
        }
      } catch (assignErr) {
        console.error("Auto-assignment failed (non-blocking):", assignErr);
      }

      res.status(201).json({ success: true, ...result, assignedVolunteer, assignmentStatus });

    } catch (error) {
      console.error("Error creating visitor entry:", error);
      res.status(500).json({ error: "Internal server error while processing visitor intake." });
    }
  });

  // 2. Create a GET /api/queue endpoint
  // Live queue — all staff roles need situational awareness
  app.get("/api/queue", requireRole(CAN_VIEW_QUEUE), async (req, res) => {
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
  // Complete a visit — counselors, volunteers (admin always allowed)
  app.put("/api/visits/:id/complete", requireRole(CAN_COMPLETE_VISIT), async (req, res) => {
    try {
      const { id } = req.params;
      const visitId = parseInt(id, 10);
      
      const updatedVisit = await db
        .update(visits)
        .set({ status: 'COMPLETED', completionTime: new Date(), handledBy: req.user.id })
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
  // Admin-only dashboard stats
  app.get("/api/stats", requireRole(ADMIN_ONLY), async (req, res) => {
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

  // =============================================
  // 5. USER MANAGEMENT ROUTES (Admin)
  // =============================================

  // List all users
  // Admin-only: list all users
  app.get("/api/users", requireRole(ADMIN_ONLY), async (req, res) => {
    try {
      const allUsers = await db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        assignedRoom: users.assignedRoom,
        createdAt: users.createdAt,
      }).from(users).orderBy(desc(users.createdAt));
      res.json({ success: true, data: allUsers });
    } catch (error) {
      console.error("Error listing users:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create a new user
  // Admin-only: create a new user
  app.post("/api/users", requireRole(ADMIN_ONLY), async (req, res) => {
    try {
      const { name, email, password, role, assignedRoom, languages, categories } = req.body;
      if (!name || !email || !password || !role) {
        return res.status(400).json({ error: "Missing required fields: name, email, password, role" });
      }

      const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existing.length > 0) {
        return res.status(409).json({ error: "A user with this email/username already exists" });
      }

      const hash = await bcrypt.hash(password, 10);
      const [newUser] = await db.insert(users).values({
        name,
        email,
        passwordHash: hash,
        role,
        assignedRoom: assignedRoom || null,
      }).returning();

      // If the role is VOLUNTEER, also create a volunteer profile
      if (role === 'VOLUNTEER') {
        const [newVol] = await db.insert(volunteers).values({
          userId: newUser.id,
          fullName: name,
          department: categories && categories.length > 0 ? categories[0] : 'General',
          status: 'active',
          maxTasksPerDay: 5,
        }).returning();
        
        if (languages && languages.length > 0) {
          await db.insert(volunteerLanguages).values(
            languages.map((l: string) => ({ volunteerId: newVol.id, language: l }))
          );
        }
      }

      res.status(201).json({ success: true, data: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role } });
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update user
  // Admin-only: update a user
  app.put("/api/users/:id", requireRole(ADMIN_ONLY), async (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);
      const { name, email, role, assignedRoom, password } = req.body;

      const updateData: any = {};
      if (name) updateData.name = name;
      if (email) updateData.email = email;
      if (role) updateData.role = role;
      if (assignedRoom !== undefined) updateData.assignedRoom = assignedRoom;
      if (password) updateData.passwordHash = await bcrypt.hash(password, 10);

      const [updated] = await db.update(users).set(updateData).where(eq(users.id, userId)).returning();
      if (!updated) return res.status(404).json({ error: "User not found" });

      res.json({ success: true, data: { id: updated.id, name: updated.name, email: updated.email, role: updated.role } });
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Delete user
  // Admin-only: delete a user
  app.delete("/api/users/:id", requireRole(ADMIN_ONLY), async (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);

      // Don't allow deleting yourself
      if (userId === req.user.id) {
        return res.status(400).json({ error: "Cannot delete your own account" });
      }

      // If volunteer, deactivate the profile
      const volProfiles = await db.select().from(volunteers).where(eq(volunteers.userId, userId));
      if (volProfiles.length > 0) {
        await db.update(volunteers).set({ status: 'inactive' }).where(eq(volunteers.userId, userId));
      }

      await db.delete(users).where(eq(users.id, userId));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // =============================================
  // 6. VOLUNTEER ROUTES
  // =============================================

  // List all volunteers (with user info)
  // Admin-only: list all volunteers
  app.get("/api/volunteers", requireRole(ADMIN_ONLY), async (req, res) => {
    try {
      const allVols = await db
        .select({
          id: volunteers.id,
          userId: volunteers.userId,
          name: users.name,
          email: users.email,
          department: volunteers.department,
          status: volunteers.status,
          maxTasksPerDay: volunteers.maxTasksPerDay,
          createdAt: volunteers.createdAt,
        })
        .from(volunteers)
        .innerJoin(users, eq(volunteers.userId, users.id))
        .orderBy(desc(volunteers.createdAt));

      const allLangs = await db.select().from(volunteerLanguages);
      const allAvail = await db.select().from(volunteerAvailability);

      const formattedVols = allVols.map(v => ({
        id: v.id,
        userId: v.userId,
        name: v.name,
        email: v.email,
        languages: allLangs.filter(l => l.volunteerId === v.id).map(l => l.language),
        categories: v.department ? [v.department] : [],
        isAvailable: allAvail.some(a => a.volunteerId === v.id && a.isAvailable),
        isActive: v.status === 'active',
        currentWorkload: 0,
        maxWorkload: v.maxTasksPerDay,
        notes: null,
        createdAt: v.createdAt
      }));

      res.json({ success: true, data: formattedVols });
    } catch (error) {
      console.error("Error listing volunteers:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Toggle own availability
  // Volunteer self-service: toggle availability
  app.put("/api/volunteers/me/availability", requireRole(VOLUNTEER_SELF), async (req, res) => {
    try {
      const { isAvailable } = req.body;
      const [vol] = await db.select().from(volunteers).where(eq(volunteers.userId, req.user.id));
      if (!vol) return res.status(404).json({ error: "Volunteer profile not found" });

      const today = new Date().getDay();
      await db.delete(volunteerAvailability).where(and(
        eq(volunteerAvailability.volunteerId, vol.id),
        eq(volunteerAvailability.dayOfWeek, today)
      ));
      
      if (isAvailable) {
         await db.insert(volunteerAvailability).values({
           volunteerId: vol.id,
           dayOfWeek: today,
           startTime: '00:00',
           endTime: '23:59',
           isAvailable: true
         });
      }

      io.emit("VolunteerStatusChanged", { volunteerId: vol.id, isAvailable: !!isAvailable });

      res.json({ success: true, data: { isAvailable: !!isAvailable } });
    } catch (error) {
      console.error("Error toggling availability:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update own profile (languages, categories)
  // Volunteer or admin: update volunteer profile
  app.put("/api/volunteers/me/profile", requireRole(CAN_EDIT_VOLUNTEER_PROFILE), async (req, res) => {
    try {
      const { languages: langs, categories: cats, notes: profileNotes } = req.body;
      const [vol] = await db.select().from(volunteers).where(eq(volunteers.userId, req.user.id));
      if (!vol) return res.status(404).json({ error: "Volunteer profile not found" });

      if (langs) {
        await db.delete(volunteerLanguages).where(eq(volunteerLanguages.volunteerId, vol.id));
        if (langs.length > 0) {
          await db.insert(volunteerLanguages).values(langs.map((l: string) => ({ volunteerId: vol.id, language: l })));
        }
      }
      if (cats && cats.length > 0) {
        await db.update(volunteers).set({ department: cats[0] }).where(eq(volunteers.id, vol.id));
      }

      res.json({ success: true, data: { success: true } });
    } catch (error) {
      console.error("Error updating volunteer profile:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get own assignments
  // Volunteer self-service: view own assignments
  app.get("/api/volunteers/me/assignments", requireRole(VOLUNTEER_SELF), async (req, res) => {
    try {
      const [vol] = await db.select().from(volunteers).where(eq(volunteers.userId, req.user.id));
      if (!vol) return res.status(404).json({ error: "Volunteer profile not found" });

      const assignmentsList = await db
        .select({
          id: assignments.id,
          visitId: assignments.visitId,
          status: assignments.assignmentStatus,
          notes: assignments.notes,
          assignedAt: assignments.assignedAt,
          completedAt: assignments.completedAt,
          visitorName: visitors.name,
          visitorPhone: visitors.phone,
          visitorLanguage: visitors.language,
          visitPurpose: visits.purpose,
          visitPrayerRequest: visits.prayerRequest,
          visitStatus: visits.status,
        })
        .from(assignments)
        .leftJoin(visits, eq(assignments.visitId, visits.id))
        .leftJoin(visitors, eq(visits.visitorId, visitors.id))
        .where(eq(assignments.volunteerId, vol.id))
        .orderBy(desc(assignments.assignedAt));

      const formattedAssignments = assignmentsList.map(a => ({
        ...a,
        taskType: 'VISITOR_ENGAGEMENT', // Legacy hardcode for frontend
        status: a.status.toUpperCase(),
        acceptedAt: a.assignedAt // Mocked for frontend
      }));

      res.json({ success: true, data: formattedAssignments });
    } catch (error) {
      console.error("Error fetching assignments:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Accept an assignment
  // Volunteer self-service: accept an assignment
  app.put("/api/assignments/:id/accept", requireRole(VOLUNTEER_SELF), async (req, res) => {
    try {
      const assignmentId = parseInt(req.params.id, 10);
      const [vol] = await db.select().from(volunteers).where(eq(volunteers.userId, req.user.id));
      if (!vol) return res.status(404).json({ error: "Volunteer profile not found" });

      const [assignment] = await db.select().from(assignments).where(eq(assignments.id, assignmentId));
      if (!assignment) return res.status(404).json({ error: "Assignment not found" });
      if (assignment.volunteerId !== vol.id) return res.status(403).json({ error: "Not your assignment" });

      const [updated] = await db
        .update(assignments)
        .set({ assignmentStatus: 'accepted' })
        .where(eq(assignments.id, assignmentId))
        .returning();

      // Update the visit status to IN_SESSION
      if (assignment.visitId) {
        await db.update(visits).set({ status: 'IN_SESSION', handledBy: req.user.id }).where(eq(visits.id, assignment.visitId));
      }

      io.emit("AssignmentAccepted", { assignmentId, volunteerId: vol.id });

      res.json({ success: true, data: updated });
    } catch (error) {
      console.error("Error accepting assignment:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Complete an assignment
  // Volunteer self-service: complete an assignment
  app.put("/api/assignments/:id/complete", requireRole(VOLUNTEER_SELF), async (req, res) => {
    try {
      const assignmentId = parseInt(req.params.id, 10);
      const { notes: completionNotes } = req.body;
      const [vol] = await db.select().from(volunteers).where(eq(volunteers.userId, req.user.id));
      if (!vol) return res.status(404).json({ error: "Volunteer profile not found" });

      const [assignment] = await db.select().from(assignments).where(eq(assignments.id, assignmentId));
      if (!assignment) return res.status(404).json({ error: "Assignment not found" });
      if (assignment.volunteerId !== vol.id) return res.status(403).json({ error: "Not your assignment" });

      const [updated] = await db
        .update(assignments)
        .set({ assignmentStatus: 'completed', completedAt: new Date(), notes: completionNotes || assignment.notes })
        .where(eq(assignments.id, assignmentId))
        .returning();

      // Complete the visit too
      if (assignment.visitId) {
        await db.update(visits).set({ status: 'COMPLETED', completionTime: new Date(), handledBy: req.user.id }).where(eq(visits.id, assignment.visitId));
        io.emit("VisitorCompleted", { visitId: assignment.visitId });
      }

      io.emit("AssignmentCompleted", { assignmentId, volunteerId: vol.id, visitId: assignment.visitId });

      res.json({ success: true, data: updated });
    } catch (error) {
      console.error("Error completing assignment:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Decline an assignment — triggers re-assignment
  // Volunteer self-service: decline an assignment (triggers re-assignment)
  app.put("/api/assignments/:id/decline", requireRole(VOLUNTEER_SELF), async (req, res) => {
    try {
      const assignmentId = parseInt(req.params.id, 10);
      const [vol] = await db.select().from(volunteers).where(eq(volunteers.userId, req.user.id));
      if (!vol) return res.status(404).json({ error: "Volunteer profile not found" });

      const [assignment] = await db.select().from(assignments).where(eq(assignments.id, assignmentId));
      if (!assignment) return res.status(404).json({ error: "Assignment not found" });
      if (assignment.volunteerId !== vol.id) return res.status(403).json({ error: "Not your assignment" });

      await db
        .update(assignments)
        .set({ assignmentStatus: 'reassigned' })
        .where(eq(assignments.id, assignmentId));

      io.emit("AssignmentDeclined", { assignmentId, volunteerId: vol.id });

      // Attempt re-assignment if visit is still active
      if (assignment.visitId) {
        // Gather all declined volunteer IDs for this visit
        const declined = await db
          .select({ volunteerId: assignments.volunteerId })
          .from(assignments)
          .where(and(
            eq(assignments.visitId, assignment.visitId),
            eq(assignments.assignmentStatus, 'reassigned')
          ));
        const excludeIds = declined.map(d => d.volunteerId);

        const [visit] = await db.select().from(visits).where(eq(visits.id, assignment.visitId));
        if (visit && visit.status === 'WAITING') {
          const [visitor] = await db.select().from(visitors).where(eq(visitors.id, visit.visitorId));
          const newAssignment = await reassignVolunteer(
            { visitId: visit.id, purpose: visit.purpose, language: visitor?.language },
            excludeIds
          );
          if (newAssignment) {
            io.emit("VolunteerAssigned", {
              assignmentId: newAssignment.assignmentId,
              volunteerId: newAssignment.volunteerId,
              visitId: assignment.visitId,
              taskType: 'VISITOR_ENGAGEMENT',
            });
          }
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error declining assignment:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // =============================================
  // 7. COUNSELOR ROUTES
  // =============================================
  //
  // These routes let counselors view and complete their assigned cases.
  // Permission: COUNSELOR_SELF — all counselor roles (COUNSELOR,
  // COUNSELOR_YOUNG_PARTNER, COUNSELOR_BUSINESS). Admin can also access
  // because requireRole() always lets ADMIN through.
  // =============================================

  /**
   * GET /api/counselor/me/cases
   *
   * Returns visits assigned to the logged-in counselor based on:
   *   - Legacy sub-roles: filters by the room implied by the role
   *     (e.g. COUNSELOR_YOUNG_PARTNER → 'Young Partner Plan').
   *   - Generic COUNSELOR role: filters by the user's assignedRoom field.
   *   - ADMIN: returns ALL waiting/in-session visits (no filter).
   *
   * Permissions: COUNSELOR_SELF (+ ADMIN implicitly)
   */
  app.get("/api/counselor/me/cases", requireRole(COUNSELOR_SELF), async (req, res) => {
    try {
      const userRole = req.user.role;

      // Determine which room/plan to filter by.
      // Legacy counselor sub-roles map to a fixed room.
      // Generic COUNSELOR uses the assignedRoom from their user record.
      let roomFilter: string | null = getCounselorRoom(userRole);

      if (!roomFilter && userRole !== ROLE_ADMIN) {
        // Generic COUNSELOR — look up their assignedRoom from the DB
        const [userRecord] = await db.select({ assignedRoom: users.assignedRoom })
          .from(users)
          .where(eq(users.id, req.user.id));
        roomFilter = userRecord?.assignedRoom ?? null;
      }

      // Build query: visits that are WAITING or IN_SESSION
      let query = db
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
            language: visitors.language,
            isReturning: visitors.isReturning,
          },
        })
        .from(visits)
        .innerJoin(visitors, eq(visits.visitorId, visitors.id))
        .where(
          roomFilter
            ? and(
                inArray(visits.status, ['WAITING', 'IN_SESSION']),
                eq(visits.assignedPlan, roomFilter)
              )
            : inArray(visits.status, ['WAITING', 'IN_SESSION'])
        )
        .orderBy(desc(visits.checkInTime));

      const cases = await query;
      res.json({ success: true, data: cases });
    } catch (error) {
      console.error("Error fetching counselor cases:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  /**
   * PUT /api/counselor/cases/:id/complete
   *
   * Marks a visit as COMPLETED. Sets handledBy to the current user.
   * Emits a VisitorCompleted socket event for real-time UI updates.
   *
   * Permissions: COUNSELOR_SELF (+ ADMIN implicitly)
   */
  app.put("/api/counselor/cases/:id/complete", requireRole(COUNSELOR_SELF), async (req, res) => {
    try {
      const visitId = parseInt(req.params.id, 10);

      const [updatedVisit] = await db
        .update(visits)
        .set({
          status: 'COMPLETED',
          completionTime: new Date(),
          handledBy: req.user.id,
        })
        .where(eq(visits.id, visitId))
        .returning();

      if (!updatedVisit) {
        return res.status(404).json({ error: "Visit not found" });
      }

      io.emit("VisitorCompleted", { visitId: updatedVisit.id });

      res.json({ success: true, data: updatedVisit });
    } catch (error) {
      console.error("Error completing counselor case:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // =============================================
  // 8. PRAYER REQUESTS
  // =============================================

  // Prayer requests — viewable by most staff
  app.get("/api/prayer-requests", requireRole(CAN_VIEW_PRAYERS), async (req, res) => {
    try {
      const prayerRequests = await db
        .select({
          visitId: visits.id,
          prayerRequest: visits.prayerRequest,
          purpose: visits.purpose,
          status: visits.status,
          checkInTime: visits.checkInTime,
          visitorName: visitors.name,
          visitorPhone: visitors.phone,
        })
        .from(visits)
        .innerJoin(visitors, eq(visits.visitorId, visitors.id))
        .where(sql`${visits.prayerRequest} IS NOT NULL AND ${visits.prayerRequest} != ''`)
        .orderBy(desc(visits.checkInTime));

      res.json({ success: true, data: prayerRequests });
    } catch (error) {
      console.error("Error fetching prayer requests:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // =============================================
  // 9. REPORTS
  // =============================================

  // Admin-only: comprehensive reports
  app.get("/api/reports", requireRole(ADMIN_ONLY), async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      // Visitor stats
      const totalVisitorsResult = await db.select({ count: sql`count(*)`.mapWith(Number) }).from(visitors);
      const totalVisitors = totalVisitorsResult[0]?.count || 0;

      // Visit stats
      const totalVisitsResult = await db.select({ count: sql`count(*)`.mapWith(Number) }).from(visits);
      const totalVisits = totalVisitsResult[0]?.count || 0;

      const completedResult = await db.select({ count: sql`count(*)`.mapWith(Number) }).from(visits).where(eq(visits.status, 'COMPLETED'));
      const completedVisits = completedResult[0]?.count || 0;

      // Volunteer stats
      const totalVolunteersResult = await db.select({ count: sql`count(*)`.mapWith(Number) }).from(volunteers);
      const totalVolunteers = totalVolunteersResult[0]?.count || 0;

      const activeVolunteersResult = await db.select({ count: sql`count(*)`.mapWith(Number) }).from(volunteers).where(eq(volunteers.status, 'active'));
      const activeVolunteers = activeVolunteersResult[0]?.count || 0;

      const totalAssignmentsResult = await db.select({ count: sql`count(*)`.mapWith(Number) }).from(assignments);
      const totalAssignments = totalAssignmentsResult[0]?.count || 0;

      const completedAssignmentsResult = await db.select({ count: sql`count(*)`.mapWith(Number) }).from(assignments).where(eq(assignments.assignmentStatus, 'completed'));
      const completedAssignments = completedAssignmentsResult[0]?.count || 0;

      // Purpose distribution
      const purposeDistribution = await db.select({
        purpose: visits.purpose,
        count: sql`count(*)`.mapWith(Number),
      }).from(visits).groupBy(visits.purpose);

      // Recent visits
      const recentVisits = await db
        .select({
          visitId: visits.id,
          purpose: visits.purpose,
          status: visits.status,
          checkInTime: visits.checkInTime,
          completionTime: visits.completionTime,
          visitorName: visitors.name,
          visitorRegion: visitors.region,
        })
        .from(visits)
        .innerJoin(visitors, eq(visits.visitorId, visitors.id))
        .orderBy(desc(visits.checkInTime))
        .limit(50);

      res.json({
        success: true,
        data: {
          summary: {
            totalVisitors,
            totalVisits,
            completedVisits,
            totalVolunteers,
            activeVolunteers,
            totalAssignments,
            completedAssignments,
          },
          purposeDistribution: purposeDistribution.map(p => ({ name: p.purpose, value: p.count })),
          recentVisits,
        },
      });
    } catch (error) {
      console.error("Error generating reports:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  // =============================================
  // 10. ADMIN VOLUNTEER ROUTES
  // =============================================

  // GET /api/admin/volunteers
  app.get("/api/admin/volunteers", requireRole(ADMIN_ONLY), async (req, res) => {
    try {
      const allVols = await db
        .select({
          id: volunteers.id,
          userId: volunteers.userId,
          name: users.name,
          email: users.email,
          phone: volunteers.phone,
          department: volunteers.department,
          status: volunteers.status,
          maxTasksPerDay: volunteers.maxTasksPerDay,
        })
        .from(volunteers)
        .innerJoin(users, eq(volunteers.userId, users.id));

      const volIds = allVols.map((v) => v.id);
      
      let allLangs: any[] = [];
      let allAvail: any[] = [];
      let activeAssignments: any[] = [];
      
      if (volIds.length > 0) {
        allLangs = await db.select().from(volunteerLanguages).where(inArray(volunteerLanguages.volunteerId, volIds));
        allAvail = await db.select().from(volunteerAvailability).where(inArray(volunteerAvailability.volunteerId, volIds));
        activeAssignments = await db.select({ volunteerId: assignments.volunteerId, count: sql`count(*)`.mapWith(Number) })
          .from(assignments)
          .where(and(inArray(assignments.volunteerId, volIds), inArray(assignments.assignmentStatus, ['pending', 'accepted', 'in_progress'])))
          .groupBy(assignments.volunteerId);
      }

      const activeCounts = new Map<number, number>();
      for (const a of activeAssignments) {
        activeCounts.set(a.volunteerId, a.count);
      }

      const formatted = allVols.map((v) => ({
        ...v,
        languages: allLangs.filter(l => l.volunteerId === v.id).map(l => l.language),
        availability: allAvail.filter(a => a.volunteerId === v.id),
        activeAssignmentCount: activeCounts.get(v.id) || 0,
      }));

      res.json({ success: true, data: formatted });
    } catch (error) {
      console.error("Error fetching admin volunteers:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // POST /api/admin/volunteers
  app.post("/api/admin/volunteers", requireRole(ADMIN_ONLY), async (req, res) => {
    try {
      const { name, email, password, phone, department, languages, availability, maxTasksPerDay } = req.body;
      
      if (!name || !email || !password) {
        return res.status(400).json({ error: "Name, email, and password are required" });
      }

      const result = await db.transaction(async (tx) => {
        const hash = await bcrypt.hash(password, 10);
        const [newUser] = await tx.insert(users).values({
          name,
          email,
          passwordHash: hash,
          role: 'VOLUNTEER'
        }).returning();

        const [newVol] = await tx.insert(volunteers).values({
          userId: newUser.id,
          fullName: name,
          phone: phone || null,
          department: department || 'General',
          status: 'active',
          maxTasksPerDay: maxTasksPerDay ?? 5,
        }).returning();

        if (languages && languages.length > 0) {
          await tx.insert(volunteerLanguages).values(
            languages.map((l: string) => ({ volunteerId: newVol.id, language: l }))
          );
        }

        if (availability && availability.length > 0) {
          await tx.insert(volunteerAvailability).values(
            availability.map((a: any) => ({
              volunteerId: newVol.id,
              dayOfWeek: a.dayOfWeek,
              startTime: a.startTime || '00:00',
              endTime: a.endTime || '23:59',
              isAvailable: !!a.isAvailable,
            }))
          );
        }
        
        return { userId: newUser.id, volunteerId: newVol.id };
      });
      
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      console.error("Error creating admin volunteer:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // PUT /api/admin/volunteers/:id
  app.put("/api/admin/volunteers/:id", requireRole(ADMIN_ONLY), async (req, res) => {
    try {
      const volunteerId = parseInt(req.params.id, 10);
      const { name, email, phone, department, status, maxTasksPerDay, languages, availability } = req.body;
      
      const [vol] = await db.select().from(volunteers).where(eq(volunteers.id, volunteerId));
      if (!vol) return res.status(404).json({ error: "Volunteer not found" });

      await db.transaction(async (tx) => {
        if (name || email) {
          const userUpdate: any = {};
          if (name) userUpdate.name = name;
          if (email) userUpdate.email = email;
          await tx.update(users).set(userUpdate).where(eq(users.id, vol.userId));
        }

        const volUpdate: any = {};
        if (name) volUpdate.fullName = name;
        if (phone !== undefined) volUpdate.phone = phone;
        if (department !== undefined) volUpdate.department = department;
        if (status !== undefined) volUpdate.status = status;
        if (maxTasksPerDay !== undefined) volUpdate.maxTasksPerDay = maxTasksPerDay;
        
        if (Object.keys(volUpdate).length > 0) {
          await tx.update(volunteers).set(volUpdate).where(eq(volunteers.id, volunteerId));
        }

        if (languages !== undefined) {
          await tx.delete(volunteerLanguages).where(eq(volunteerLanguages.volunteerId, volunteerId));
          if (languages.length > 0) {
            await tx.insert(volunteerLanguages).values(
              languages.map((l: string) => ({ volunteerId, language: l }))
            );
          }
        }

        if (availability !== undefined) {
          await tx.delete(volunteerAvailability).where(eq(volunteerAvailability.volunteerId, volunteerId));
          if (availability.length > 0) {
            await tx.insert(volunteerAvailability).values(
              availability.map((a: any) => ({
                volunteerId,
                dayOfWeek: a.dayOfWeek,
                startTime: a.startTime || '00:00',
                endTime: a.endTime || '23:59',
                isAvailable: !!a.isAvailable,
              }))
            );
          }
        }
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating admin volunteer:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // PATCH /api/admin/volunteers/:id/deactivate
  app.patch("/api/admin/volunteers/:id/deactivate", requireRole(ADMIN_ONLY), async (req, res) => {
    try {
      const volunteerId = parseInt(req.params.id, 10);
      const [updated] = await db.update(volunteers).set({ status: 'inactive' }).where(eq(volunteers.id, volunteerId)).returning();
      if (!updated) return res.status(404).json({ error: "Volunteer not found" });
      res.json({ success: true, data: updated });
    } catch (error) {
      console.error("Error deactivating volunteer:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  // =============================================
  // 11. NEW VOLUNTEER DASHBOARD ROUTES
  // =============================================

  // 1. GET /api/volunteer/my-assignments
  app.get("/api/volunteer/my-assignments", requireRole(VOLUNTEER_SELF), async (req, res) => {
    try {
      const [vol] = await db.select().from(volunteers).where(eq(volunteers.userId, req.user.id));
      if (!vol) return res.status(404).json({ error: "Volunteer profile not found" });

      const assignmentsList = await db
        .select({
          id: assignments.id,
          visitId: assignments.visitId,
          status: assignments.assignmentStatus,
          notes: assignments.notes,
          assignedAt: assignments.assignedAt,
          completedAt: assignments.completedAt,
          visitorName: visitors.name,
          visitorPhone: visitors.phone,
          visitorLanguage: visitors.language,
          visitPurpose: visits.purpose,
          visitPrayerRequest: visits.prayerRequest,
          visitStatus: visits.status,
        })
        .from(assignments)
        .leftJoin(visits, eq(assignments.visitId, visits.id))
        .leftJoin(visitors, eq(visits.visitorId, visitors.id))
        .where(eq(assignments.volunteerId, vol.id))
        .orderBy(desc(assignments.assignedAt));

      res.json({ success: true, data: assignmentsList });
    } catch (error) {
      console.error("Error fetching my assignments:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // 2. PUT /api/volunteer/assignments/:id/accept
  app.put("/api/volunteer/assignments/:id/accept", requireRole(VOLUNTEER_SELF), async (req, res) => {
    try {
      const assignmentId = parseInt(req.params.id, 10);
      const [vol] = await db.select().from(volunteers).where(eq(volunteers.userId, req.user.id));
      if (!vol) return res.status(404).json({ error: "Volunteer profile not found" });

      const [assignment] = await db.select().from(assignments).where(eq(assignments.id, assignmentId));
      if (!assignment) return res.status(404).json({ error: "Assignment not found" });
      if (assignment.volunteerId !== vol.id) return res.status(403).json({ error: "Not your assignment" });

      const [updated] = await db
        .update(assignments)
        .set({ assignmentStatus: 'accepted' })
        .where(eq(assignments.id, assignmentId))
        .returning();

      io.emit("AssignmentUpdated", { assignmentId, status: 'accepted' });

      res.json({ success: true, data: updated });
    } catch (error) {
      console.error("Error accepting assignment:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // 3. PUT /api/volunteer/assignments/:id/start
  app.put("/api/volunteer/assignments/:id/start", requireRole(VOLUNTEER_SELF), async (req, res) => {
    try {
      const assignmentId = parseInt(req.params.id, 10);
      const [vol] = await db.select().from(volunteers).where(eq(volunteers.userId, req.user.id));
      if (!vol) return res.status(404).json({ error: "Volunteer profile not found" });

      const [assignment] = await db.select().from(assignments).where(eq(assignments.id, assignmentId));
      if (!assignment) return res.status(404).json({ error: "Assignment not found" });
      if (assignment.volunteerId !== vol.id) return res.status(403).json({ error: "Not your assignment" });

      const [updated] = await db
        .update(assignments)
        .set({ assignmentStatus: 'in_progress' })
        .where(eq(assignments.id, assignmentId))
        .returning();

      io.emit("AssignmentUpdated", { assignmentId, status: 'in_progress' });

      res.json({ success: true, data: updated });
    } catch (error) {
      console.error("Error starting assignment:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // 4. PUT /api/volunteer/assignments/:id/complete
  app.put("/api/volunteer/assignments/:id/complete", requireRole(VOLUNTEER_SELF), async (req, res) => {
    try {
      const assignmentId = parseInt(req.params.id, 10);
      const { notes } = req.body;
      const [vol] = await db.select().from(volunteers).where(eq(volunteers.userId, req.user.id));
      if (!vol) return res.status(404).json({ error: "Volunteer profile not found" });

      const [assignment] = await db.select().from(assignments).where(eq(assignments.id, assignmentId));
      if (!assignment) return res.status(404).json({ error: "Assignment not found" });
      if (assignment.volunteerId !== vol.id) return res.status(403).json({ error: "Not your assignment" });

      const [updated] = await db
        .update(assignments)
        .set({ assignmentStatus: 'completed', completedAt: new Date(), notes: notes || assignment.notes })
        .where(eq(assignments.id, assignmentId))
        .returning();

      io.emit("AssignmentUpdated", { assignmentId, status: 'completed' });

      res.json({ success: true, data: updated });
    } catch (error) {
      console.error("Error completing assignment:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // 5. PUT /api/volunteer/availability
  app.put("/api/volunteer/availability", requireRole(VOLUNTEER_SELF), async (req, res) => {
    try {
      const { availability } = req.body; // array of { dayOfWeek, startTime, endTime, isAvailable }
      if (!Array.isArray(availability)) return res.status(400).json({ error: "Availability must be an array" });

      const [vol] = await db.select().from(volunteers).where(eq(volunteers.userId, req.user.id));
      if (!vol) return res.status(404).json({ error: "Volunteer profile not found" });

      await db.transaction(async (tx) => {
        await tx.delete(volunteerAvailability).where(eq(volunteerAvailability.volunteerId, vol.id));
        if (availability.length > 0) {
          await tx.insert(volunteerAvailability).values(
            availability.map((a: any) => ({
              volunteerId: vol.id,
              dayOfWeek: a.dayOfWeek,
              startTime: a.startTime || '00:00',
              endTime: a.endTime || '23:59',
              isAvailable: !!a.isAvailable,
            }))
          );
        }
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error updating availability:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // 6. PUT /api/volunteer/languages
  app.put("/api/volunteer/languages", requireRole(VOLUNTEER_SELF), async (req, res) => {
    try {
      const { languages } = req.body; // array of strings
      if (!Array.isArray(languages)) return res.status(400).json({ error: "Languages must be an array" });

      const [vol] = await db.select().from(volunteers).where(eq(volunteers.userId, req.user.id));
      if (!vol) return res.status(404).json({ error: "Volunteer profile not found" });

      await db.transaction(async (tx) => {
        await tx.delete(volunteerLanguages).where(eq(volunteerLanguages.volunteerId, vol.id));
        if (languages.length > 0) {
          await tx.insert(volunteerLanguages).values(
            languages.map((l: string) => ({ volunteerId: vol.id, language: l }))
          );
        }
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error updating languages:", error);
      res.status(500).json({ error: "Internal server error" });
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
