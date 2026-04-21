import type { Db } from '../db/client.js';
import { lightDream, remDream, deepDream, DEFAULT_DREAM_CONFIG, isNearDreamTime } from '../memory/drawing.js';

export type DreamSchedulerDeps = {
  db: Db;
  tenantId: string;
  config?: Partial<typeof DEFAULT_DREAM_CONFIG>;
  now?: () => number;
};

const REM_DREAM_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const DEEP_DREAM_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Start the dreaming scheduler.
 * - REM dream runs every hour.
 * - Deep dream runs once daily near midnight WIB (configurable).
 * Returns a stop function.
 */
export function startDreamScheduler(deps: DreamSchedulerDeps): () => void {
  const { db, tenantId, config = {}, now = Date.now } = deps;
  const enabled = config.enabled ?? DEFAULT_DREAM_CONFIG.enabled;

  if (!enabled) {
    return () => {};
  }

  let stopped = false;

  async function runRemDream() {
    if (stopped) return;
    try {
      const result = await remDream({ db, tenantId });
      if (result.notesExamined > 0) {
        console.info(
          `[dream-scheduler] REM dream: examined=${result.notesExamined} promoted=${result.promoted} consolidated=${result.consolidated}`,
        );
      }
    } catch (err) {
      console.error('[dream-scheduler] REM dream error:', err);
    }
  }

  async function checkDeepDream() {
    if (stopped) return;
    // Only fire if within the dream window (default: midnight WIB)
    const targetHour = config.deepDreamHourWib ?? DEFAULT_DREAM_CONFIG.deepDreamHourWib;
    if (!isNearDreamTime(targetHour, 60)) return;

    try {
      const result = await deepDream({ db, tenantId });
      console.info(
        `[dream-scheduler] Deep dream: total=${result.totalMemories} promoted=${result.memoriesPromoted} deleted=${result.memoriesDeleted}`,
      );
    } catch (err) {
      console.error('[dream-scheduler] Deep dream error:', err);
    }
  }

  // Fire REM dream immediately on start (catch-up) then every hour
  runRemDream().catch((err) => console.error('[dream-scheduler] initial REM dream error:', err));

  const remId = setInterval(() => {
    if (!stopped) runRemDream().catch((err) => console.error('[dream-scheduler] REM dream error:', err));
  }, REM_DREAM_INTERVAL_MS);

  // Check for deep dream window every hour
  const deepId = setInterval(() => {
    if (!stopped) checkDeepDream();
  }, DEEP_DREAM_CHECK_INTERVAL_MS);

  return () => {
    stopped = true;
    clearInterval(remId);
    clearInterval(deepId);
    console.info('[dream-scheduler] stopped');
  };
}
