import { db } from '../db/index.js';
import { volunteers, assignments, volunteerLanguages, volunteerAvailability } from '../db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';

/**
 * Volunteer Auto-Assignment Engine (Strict Matching)
 * 
 * Rules:
 * 1. Must be active (status === 'active')
 * 2. Must know the language (if specified)
 * 3. Must be available today at current time
 * 4. Current workload must be less than maxTasksPerDay
 * 5. Tie-breaker: lowest current workload
 */

interface VisitContext {
  visitId: number;
  purpose: string;
  language?: string | null;
}

/**
 * Finds the best eligible volunteer based on strict constraints.
 */
export async function findBestVolunteer(visit: VisitContext, excludeIds: number[] = []): Promise<{ volunteerId: number, userId: number } | null> {
  const allVolunteers = await db
    .select()
    .from(volunteers)
    .where(eq(volunteers.status, 'active'));

  if (allVolunteers.length === 0) return null;

  const volIds = allVolunteers.map(v => v.id).filter(id => !excludeIds.includes(id));
  if (volIds.length === 0) return null;

  const allLangs = await db.select().from(volunteerLanguages).where(inArray(volunteerLanguages.volunteerId, volIds));
  
  const now = new Date();
  const today = now.getDay();
  const currentHours = now.getHours().toString().padStart(2, '0');
  const currentMinutes = now.getMinutes().toString().padStart(2, '0');
  const currentTime = `${currentHours}:${currentMinutes}`;

  const allAvail = await db.select().from(volunteerAvailability).where(and(
    inArray(volunteerAvailability.volunteerId, volIds),
    eq(volunteerAvailability.dayOfWeek, today),
    eq(volunteerAvailability.isAvailable, true)
  ));

  const currentAssigned = await db.select().from(assignments).where(and(
    inArray(assignments.volunteerId, volIds),
    inArray(assignments.assignmentStatus, ['pending', 'accepted', 'in_progress'])
  ));

  const workloadMap = new Map<number, number>();
  for (const a of currentAssigned) {
    workloadMap.set(a.volunteerId, (workloadMap.get(a.volunteerId) || 0) + 1);
  }

  let eligibleVolunteers = allVolunteers.filter(vol => volIds.includes(vol.id));

  // 1. Language Filter
  if (visit.language) {
    const visitLang = visit.language.toLowerCase();
    eligibleVolunteers = eligibleVolunteers.filter(vol => {
      const volLangs = allLangs.filter(l => l.volunteerId === vol.id).map(l => l.language.toLowerCase());
      return volLangs.includes(visitLang);
    });
  }

  // 2. Availability Filter
  eligibleVolunteers = eligibleVolunteers.filter(vol => {
    const avails = allAvail.filter(a => a.volunteerId === vol.id);
    if (avails.length === 0) return false;
    
    // Check if current time is within any availability window
    return avails.some(a => {
       if (!a.startTime || !a.endTime) return true; // full day avail
       return currentTime >= a.startTime && currentTime <= a.endTime;
    });
  });

  // 3. Workload Filter
  eligibleVolunteers = eligibleVolunteers.filter(vol => {
    const currentLoad = workloadMap.get(vol.id) || 0;
    const maxLoad = vol.maxTasksPerDay ?? 5;
    return currentLoad < maxLoad;
  });

  if (eligibleVolunteers.length === 0) return null;

  // 4. Sort by workload ascending (lowest workload first)
  eligibleVolunteers.sort((a, b) => {
    const loadA = workloadMap.get(a.id) || 0;
    const loadB = workloadMap.get(b.id) || 0;
    return loadA - loadB;
  });

  return { volunteerId: eligibleVolunteers[0].id, userId: eligibleVolunteers[0].userId };
}

/**
 * Auto-assign the best available volunteer to a visit.
 * Creates a volunteerAssignment record.
 * 
 * Returns the assignment and volunteer info, or null if no suitable volunteer found.
 */
export async function assignVolunteer(visit: VisitContext): Promise<{
  assignmentId: number;
  volunteerId: number;
  userId: number;
} | null> {
  const best = await findBestVolunteer(visit);

  if (!best) {
    console.log(`[AutoAssign] No eligible volunteers for visit ${visit.visitId}`);
    return null;
  }

  try {
    const result = await db.transaction(async (tx) => {
      // Create the assignment
      const [assignment] = await tx
        .insert(assignments)
        .values({
          volunteerId: best.volunteerId,
          visitId: visit.visitId,
          assignmentStatus: 'pending',
        })
        .returning({ id: assignments.id });

      return assignment;
    });

    console.log(`[AutoAssign] Assigned volunteer ${best.volunteerId} to visit ${visit.visitId}`);

    return {
      assignmentId: result.id,
      volunteerId: best.volunteerId,
      userId: best.userId,
    };
  } catch (err) {
    console.error(`[AutoAssign] Failed to assign volunteer for visit ${visit.visitId}:`, err);
    return null;
  }
}

/**
 * Re-assign a visit when a volunteer declines.
 * Excludes the declining volunteer and picks the next best.
 */
export async function reassignVolunteer(
  visit: VisitContext,
  excludeVolunteerIds: number[]
): Promise<{
  assignmentId: number;
  volunteerId: number;
  userId: number;
} | null> {
  const best = await findBestVolunteer(visit, excludeVolunteerIds);

  if (!best) {
    console.log(`[ReAssign] No remaining eligible volunteers for visit ${visit.visitId}`);
    return null;
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [assignment] = await tx
        .insert(assignments)
        .values({
          volunteerId: best.volunteerId,
          visitId: visit.visitId,
          assignmentStatus: 'pending',
        })
        .returning({ id: assignments.id });

      return assignment;
    });

    console.log(`[ReAssign] Re-assigned volunteer ${best.volunteerId} to visit ${visit.visitId}`);

    return {
      assignmentId: result.id,
      volunteerId: best.volunteerId,
      userId: best.userId,
    };
  } catch (err) {
    console.error(`[ReAssign] Failed to re-assign for visit ${visit.visitId}:`, err);
    return null;
  }
}
