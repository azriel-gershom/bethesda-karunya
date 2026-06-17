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
    role: text('role').notNull(), // e.g., 'ADMIN', 'RECEPTIONIST', 'COUNSELOR_YOUNG_PARTNER', 'COUNSELOR_BUSINESS'
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

// --- Relationships (For fast complex JOIN queries) ---
export const usersRelations = relations(users, ({ many }) => ({
  handledVisits: many(visits),
}));

export const visitorsRelations = relations(visitors, ({ many }) => ({
  visits: many(visits),
}));

export const visitsRelations = relations(visits, ({ one }) => ({
  visitor: one(visitors, {
    fields: [visits.visitorId],
    references: [visitors.id],
  }),
  handler: one(users, {
    fields: [visits.handledBy],
    references: [users.id],
  }),
}));
