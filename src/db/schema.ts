import { relations } from 'drizzle-orm';
import { pgTable, serial, text, timestamp, integer, boolean, index } from 'drizzle-orm/pg-core';

// 1. Users/Employees Table (For Main Admin and Sub-Admins)
export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    role: text('role').notNull(), // 'ADMIN' | 'EMPLOYEE' | 'RECEPTIONIST' | 'COUNSELOR' | 'COUNSELOR_YOUNG_PARTNER' | 'COUNSELOR_BUSINESS' | 'VOLUNTEER'
    assignedRoom: text('assigned_room'), // e.g., 'Young Partner Plan'
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    // Optimizing for fast role-based queries and real-time dashboard filtering
    index('idx_users_role').on(table.role),
  ]
);

// 2. Visitors Table (Captured at Reception)
export const visitors = pgTable(
  'visitors',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    phone: text('phone').notNull().unique(),
    age: integer('age'),
    region: text('region'),
    language: text('language'), // Visitor's preferred language for volunteer matching
    isReturning: boolean('is_returning').default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    // Optimizing for lightning-fast autocomplete during Reception Intake
    index('idx_visitors_phone').on(table.phone),
    index('idx_visitors_name').on(table.name),
  ]
);

// 3. Visits/Engagements Table (Tracks each individual visit to the tower)
export const visits = pgTable(
  'visits',
  {
    id: serial('id').primaryKey(),
    visitorId: integer('visitor_id')
      .references(() => visitors.id)
      .notNull(),
    purpose: text('purpose').notNull(),
    prayerRequest: text('prayer_request'),
    assignedPlan: text('assigned_plan'), // The AI or Receptionist suggested plan
    status: text('status').notNull().default('WAITING'), // WAITING, IN_SESSION, COMPLETED
    handledBy: integer('handled_by').references(() => users.id), // Which counselor took them
    checkInTime: timestamp('check_in_time').defaultNow().notNull(),
    completionTime: timestamp('completion_time'),
  },
  (table) => [
    // Optimizing for drag-and-drop Kanban queries & real-time monitoring
    index('idx_visits_status').on(table.status),
    index('idx_visits_visitor').on(table.visitorId),
    index('idx_visits_handler').on(table.handledBy),
    index('idx_visits_check_in').on(table.checkInTime),
  ]
);

// 4. Volunteers Table (Extended profile for users with VOLUNTEER role)
export const volunteers = pgTable(
  'volunteers',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id).notNull().unique(),
    fullName: text('full_name'),
    phone: text('phone'),
    department: text('department'),
    status: text('status').default('active'), // active/inactive
    maxTasksPerDay: integer('max_tasks_per_day').default(5),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_volunteers_user').on(table.userId),
    index('idx_volunteers_status').on(table.status),
  ]
);

// 4a. Volunteer Languages Table
export const volunteerLanguages = pgTable(
  'volunteer_languages',
  {
    id: serial('id').primaryKey(),
    volunteerId: integer('volunteer_id').references(() => volunteers.id).notNull(),
    language: text('language').notNull(),
  },
  (table) => [
    index('idx_volunteer_languages_vol').on(table.volunteerId),
    index('idx_volunteer_languages_lang').on(table.language),
  ]
);

// 4b. Volunteer Availability Table
export const volunteerAvailability = pgTable(
  'volunteer_availability',
  {
    id: serial('id').primaryKey(),
    volunteerId: integer('volunteer_id').references(() => volunteers.id).notNull(),
    dayOfWeek: integer('day_of_week').notNull(), // 0 = Sunday, 1 = Monday, etc.
    startTime: text('start_time').notNull(), // e.g., '09:00'
    endTime: text('end_time').notNull(),     // e.g., '17:00'
    isAvailable: boolean('is_available').default(true),
  },
  (table) => [
    index('idx_volunteer_availability_vol').on(table.volunteerId),
    index('idx_volunteer_availability_day').on(table.dayOfWeek),
  ]
);

// 5. Volunteer Task Assignments Table
export const assignments = pgTable(
  'assignments',
  {
    id: serial('id').primaryKey(),
    visitId: integer('visit_id').references(() => visits.id).notNull(),
    volunteerId: integer('volunteer_id').references(() => volunteers.id).notNull(),
    assignedBy: integer('assigned_by').references(() => users.id),
    assignmentStatus: text('assignment_status').notNull().default('pending'), // pending/accepted/in_progress/completed/reassigned/cancelled
    notes: text('notes'),
    assignedAt: timestamp('assigned_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
  },
  (table) => [
    index('idx_assignments_volunteer').on(table.volunteerId),
    index('idx_assignments_visit').on(table.visitId),
    index('idx_assignments_status').on(table.assignmentStatus),
  ]
);

// --- Relationships (For fast complex JOIN queries) ---
export const usersRelations = relations(users, ({ many, one }) => ({
  handledVisits: many(visits),
  volunteerProfile: one(volunteers, {
    fields: [users.id],
    references: [volunteers.userId],
  }),
  createdAssignments: many(assignments, { relationName: 'assignedBy' }),
}));

export const visitorsRelations = relations(visitors, ({ many }) => ({
  visits: many(visits),
}));

export const visitsRelations = relations(visits, ({ one, many }) => ({
  visitor: one(visitors, {
    fields: [visits.visitorId],
    references: [visitors.id],
  }),
  handler: one(users, {
    fields: [visits.handledBy],
    references: [users.id],
  }),
  assignments: many(assignments),
}));

export const volunteersRelations = relations(volunteers, ({ one, many }) => ({
  user: one(users, {
    fields: [volunteers.userId],
    references: [users.id],
  }),
  languages: many(volunteerLanguages),
  availability: many(volunteerAvailability),
  assignments: many(assignments),
}));

export const volunteerLanguagesRelations = relations(volunteerLanguages, ({ one }) => ({
  volunteer: one(volunteers, {
    fields: [volunteerLanguages.volunteerId],
    references: [volunteers.id],
  }),
}));

export const volunteerAvailabilityRelations = relations(volunteerAvailability, ({ one }) => ({
  volunteer: one(volunteers, {
    fields: [volunteerAvailability.volunteerId],
    references: [volunteers.id],
  }),
}));

export const assignmentsRelations = relations(assignments, ({ one }) => ({
  volunteer: one(volunteers, {
    fields: [assignments.volunteerId],
    references: [volunteers.id],
  }),
  visit: one(visits, {
    fields: [assignments.visitId],
    references: [visits.id],
  }),
  assignedByUser: one(users, {
    fields: [assignments.assignedBy],
    references: [users.id],
    relationName: 'assignedBy',
  }),
}));
