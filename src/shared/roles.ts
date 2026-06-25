/**
 * Bethesda Portal — Role Constants & Permission Helpers
 * ═══════════════════════════════════════════════════════
 *
 * This file is the SINGLE SOURCE OF TRUTH for every role and permission
 * in the system.  Both the Express backend (server.ts) and the React
 * frontend (App.tsx, ManageUsersPanel, etc.) import from here so there
 * is never a mismatch.
 *
 * ────────────────────────────────────────────────────────
 * ROLE HIERARCHY (highest → lowest privilege)
 * ────────────────────────────────────────────────────────
 *
 *  ADMIN
 *    └─ Full, unrestricted access.
 *       • Dashboard stats, reports, analytics
 *       • User management (CRUD)
 *       • Volunteer management
 *       • Visitor intake & queue
 *       • Prayer requests & counseling cases
 *       • The `requireRole()` middleware ALWAYS lets ADMIN through,
 *         even if ADMIN is not explicitly listed in the permission set.
 *
 *  EMPLOYEE
 *    └─ General staff member with front-desk privileges.
 *       • Add visitors (intake form)
 *       • View the live queue
 *       • View prayer requests & counseling data
 *       • CANNOT manage users, view admin reports/stats, or manage volunteers.
 *
 *  RECEPTIONIST
 *    └─ Front-desk operator (identical permissions to EMPLOYEE).
 *       • Add visitors, view queue, view prayer/counseling data.
 *       • Kept as a separate role for org-chart clarity;
 *         operationally equivalent to EMPLOYEE.
 *
 *  COUNSELOR  (umbrella — backward-compatible sub-roles below)
 *    ├─ COUNSELOR_YOUNG_PARTNER  — Young Partner room counselor (legacy)
 *    └─ COUNSELOR_BUSINESS       — Business Blessing room counselor (legacy)
 *    • View the live queue (filtered to their room/category)
 *    • View and complete assigned counseling cases
 *    • View prayer requests relevant to their sessions
 *    • CANNOT add visitors, manage users, or view admin-only reports.
 *
 *  VOLUNTEER
 *    └─ External helper assigned tasks by the system.
 *       • View own assigned tasks (visitor engagement, prayer follow-up, etc.)
 *       • Accept, decline, or complete assignments
 *       • Toggle own availability
 *       • Update own profile (languages, categories)
 *       • CANNOT add visitors, manage users, or view admin reports.
 *
 * ────────────────────────────────────────────────────────
 * BACKWARD COMPATIBILITY
 * ────────────────────────────────────────────────────────
 * Existing users stored in the database with roles
 *   ADMIN, RECEPTIONIST, COUNSELOR_YOUNG_PARTNER,
 *   COUNSELOR_BUSINESS, VOLUNTEER
 * continue to work unchanged.
 *
 * The newer roles EMPLOYEE and COUNSELOR are additive —
 * they do NOT replace the legacy sub-roles.
 * ────────────────────────────────────────────────────────
 */

// ═══════════════════════════════════════════════════════
// 1.  INDIVIDUAL ROLE CONSTANTS
// ═══════════════════════════════════════════════════════

/** Full system administrator — unrestricted access */
export const ROLE_ADMIN = 'ADMIN' as const;

/**
 * General staff / employee.
 * Same operational permissions as RECEPTIONIST (add visitors, view queue,
 * view prayer requests). Useful for staff who aren't specifically
 * assigned to the front desk.
 */
export const ROLE_EMPLOYEE = 'EMPLOYEE' as const;

/** Front-desk receptionist — visitor intake & queue monitoring */
export const ROLE_RECEPTIONIST = 'RECEPTIONIST' as const;

/**
 * Generic counselor role (new).
 * Counselors created with this role can be assigned to any room.
 */
export const ROLE_COUNSELOR = 'COUNSELOR' as const;

/** Legacy: Young Partner Plan room counselor */
export const ROLE_COUNSELOR_YOUNG_PARTNER = 'COUNSELOR_YOUNG_PARTNER' as const;

/** Legacy: Business Blessing room counselor */
export const ROLE_COUNSELOR_BUSINESS = 'COUNSELOR_BUSINESS' as const;

/** Volunteer — task-based engagement, self-service profile */
export const ROLE_VOLUNTEER = 'VOLUNTEER' as const;

// ═══════════════════════════════════════════════════════
// 2.  ROLE GROUPS
// ═══════════════════════════════════════════════════════

/**
 * All counselor roles (the new generic one + both legacy sub-types).
 * Use this wherever you'd previously list COUNSELOR_YOUNG_PARTNER and
 * COUNSELOR_BUSINESS separately.
 */
export const COUNSELOR_ROLES = [
  ROLE_COUNSELOR,
  ROLE_COUNSELOR_YOUNG_PARTNER,
  ROLE_COUNSELOR_BUSINESS,
] as const;

/**
 * Roles with front-desk privileges:
 * adding visitors, viewing queue, viewing prayer/counseling data.
 */
export const FRONT_DESK_ROLES = [
  ROLE_RECEPTIONIST,
  ROLE_EMPLOYEE,
] as const;

/**
 * Every valid role string the system recognises.
 * Used for validation when creating/updating users via the admin panel.
 */
export const ALL_ROLES = [
  ROLE_ADMIN,
  ROLE_EMPLOYEE,
  ROLE_RECEPTIONIST,
  ROLE_COUNSELOR,
  ROLE_COUNSELOR_YOUNG_PARTNER,
  ROLE_COUNSELOR_BUSINESS,
  ROLE_VOLUNTEER,
] as const;

/** TypeScript union of all role strings */
export type Role = (typeof ALL_ROLES)[number];

// ═══════════════════════════════════════════════════════
// 3.  ROLE METADATA  (for UI display, badge colours, etc.)
// ═══════════════════════════════════════════════════════

/**
 * Human-readable label and short description for each role.
 * Used by the admin panel and header bar.
 */
export const ROLE_META: Record<Role, { label: string; description: string }> = {
  ADMIN:                   { label: 'Admin',                  description: 'Full system access — users, reports, everything' },
  EMPLOYEE:                { label: 'Employee',               description: 'General staff — visitor intake, queue, prayer data' },
  RECEPTIONIST:            { label: 'Receptionist',           description: 'Front desk — visitor intake, queue, prayer data' },
  COUNSELOR:               { label: 'Counselor',              description: 'View & complete assigned counseling cases' },
  COUNSELOR_YOUNG_PARTNER: { label: 'Counselor (YP)',         description: 'Young Partner room — view & complete cases' },
  COUNSELOR_BUSINESS:      { label: 'Counselor (Business)',   description: 'Business Blessing room — view & complete cases' },
  VOLUNTEER:               { label: 'Volunteer',              description: 'View assigned tasks, update availability & profile' },
};

// ═══════════════════════════════════════════════════════
// 4.  PERMISSION SETS
// ═══════════════════════════════════════════════════════
//
// These arrays are designed to be passed directly to the
// `requireRole()` middleware in server.ts.
//
// IMPORTANT: ADMIN is ALWAYS permitted by the middleware
// regardless of whether it appears in these arrays.
// We include it explicitly for documentation clarity.
// ═══════════════════════════════════════════════════════

/**
 * CAN_ADD_VISITORS — Who can create visitor intake entries?
 * → Admin, Employee, Receptionist
 *
 * Counselors and Volunteers CANNOT add visitors; they only
 * handle cases that are already in the queue.
 */
export const CAN_ADD_VISITORS: readonly string[] = [
  ROLE_ADMIN,
  ...FRONT_DESK_ROLES,
];

/**
 * CAN_VIEW_QUEUE — Who can see the live visitor queue?
 * → Everyone except unauthenticated users.
 *   All staff need situational awareness of the queue.
 */
export const CAN_VIEW_QUEUE: readonly string[] = [
  ROLE_ADMIN,
  ...FRONT_DESK_ROLES,
  ...COUNSELOR_ROLES,
  ROLE_VOLUNTEER,
];

/**
 * CAN_COMPLETE_VISIT — Who can mark a visit as completed?
 * → Admin, Counselors (they handle the session), Volunteers
 *
 * Receptionists/Employees CANNOT complete visits because they
 * do not conduct the actual session.
 */
export const CAN_COMPLETE_VISIT: readonly string[] = [
  ROLE_ADMIN,
  ...COUNSELOR_ROLES,
  ROLE_VOLUNTEER,
];

/**
 * CAN_VIEW_PRAYERS — Who can view prayer requests?
 * → Admin, front-desk staff, counselors, volunteers.
 *   Prayer data is operationally useful for every staff type.
 */
export const CAN_VIEW_PRAYERS: readonly string[] = [
  ROLE_ADMIN,
  ...FRONT_DESK_ROLES,
  ...COUNSELOR_ROLES,
  ROLE_VOLUNTEER,
];

/**
 * CAN_VIEW_COUNSELING_CASES — Who can see counseling case lists?
 * → Admin, Counselors
 *
 * This is for the "my cases" / "all cases" view that counselors use.
 * Front-desk staff see the queue but not the counseling case details.
 */
export const CAN_VIEW_COUNSELING_CASES: readonly string[] = [
  ROLE_ADMIN,
  ...COUNSELOR_ROLES,
];

/**
 * ADMIN_ONLY — Gated features: stats, reports, user management.
 * → Admin only.
 */
export const ADMIN_ONLY: readonly string[] = [
  ROLE_ADMIN,
];

/**
 * VOLUNTEER_SELF — Self-service volunteer actions.
 * Toggle availability, view own assignments, accept/decline tasks.
 * → Volunteers only (admin accesses volunteer data via admin routes).
 */
export const VOLUNTEER_SELF: readonly string[] = [
  ROLE_VOLUNTEER,
];

/**
 * CAN_EDIT_VOLUNTEER_PROFILE — Update volunteer profile fields
 * (languages, categories, notes).
 * → Volunteers (self) and Admin (on behalf of any volunteer).
 */
export const CAN_EDIT_VOLUNTEER_PROFILE: readonly string[] = [
  ROLE_VOLUNTEER,
  ROLE_ADMIN,
];

/**
 * COUNSELOR_SELF — Self-service counselor actions.
 * View own assigned cases, update case status.
 * → All counselor roles (admin accesses via admin routes).
 */
export const COUNSELOR_SELF: readonly string[] = [
  ...COUNSELOR_ROLES,
];

// ═══════════════════════════════════════════════════════
// 5.  HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════

/**
 * Check if a role string belongs to the counselor family.
 * Includes COUNSELOR, COUNSELOR_YOUNG_PARTNER, COUNSELOR_BUSINESS.
 * Useful for frontend view routing.
 */
export function isCounselor(role: string): boolean {
  return (COUNSELOR_ROLES as readonly string[]).includes(role);
}

/**
 * Check if a role has front-desk (visitor intake) privileges.
 * ADMIN always counts as front-desk capable.
 */
export function isFrontDesk(role: string): boolean {
  return role === ROLE_ADMIN || (FRONT_DESK_ROLES as readonly string[]).includes(role);
}

/** Check if a role is admin. */
export function isAdmin(role: string): boolean {
  return role === ROLE_ADMIN;
}

/** Check if a role is volunteer. */
export function isVolunteer(role: string): boolean {
  return role === ROLE_VOLUNTEER;
}

/**
 * Get the human-readable label for a role.
 * Returns the role string itself if not found in ROLE_META.
 */
export function getRoleLabel(role: string): string {
  return ROLE_META[role as Role]?.label ?? role;
}

/**
 * Get the room that a counselor sub-role is assigned to.
 * Returns null for generic COUNSELOR (they use `assignedRoom` from user record).
 * Returns null for non-counselor roles.
 */
export function getCounselorRoom(role: string): string | null {
  if (role === ROLE_COUNSELOR_YOUNG_PARTNER) return 'Young Partner Plan';
  if (role === ROLE_COUNSELOR_BUSINESS) return 'Business Blessing';
  return null; // Generic COUNSELOR uses the user's assignedRoom field
}
