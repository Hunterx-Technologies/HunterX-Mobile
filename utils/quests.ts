import type { TaskItem } from '@/types/task';
import { optimizeCloudinaryUrl } from '@/services/media/cloudinary';

// A task from GET /tasks/today as the Home quest cards show it. Lives here,
// not in the Home route file, so other screens can use it without
// importing a route.

export interface QuestItem {
  id: string;
  title: string;
  description?: string;
  category: string;
  xpReward: number;
  xpPartial?: number;
  type: 'daily' | 'weekly' | 'monthly' | 'locked';
  /** Routine task the hunter chose (shown as "Routine"); other daily tasks show as "Daily". */
  isRoutine?: boolean;
  /** A built-in daily task (sleep, water, protein, steps). Admins can rename these, so match them by category (tag), not title. */
  isBuiltIn?: boolean;
  image: any;
  status: 'todo' | 'done' | 'partial' | 'skipped' | 'locked';
  earnedXp?: number;
  showTickButton?: boolean;
  showWrongButton?: boolean;
  hasStatusPopup?: boolean;
  imageHeight?: number;
  imageStyle?: any;
  targetValue?: string;
  allows_partial?: boolean;
  period_start?: string;
  period_end?: string;
  end_date?: string;
  price?: number;
  currency?: string;
  is_paid?: boolean;
  /** Photos needed to complete it (0 or missing = a normal quest). */
  proofCount?: number;
  /** Proof quests: waiting on the admin, sent back for new photos, or rejected. */
  reviewStatus?: 'in_review' | 'resubmit' | 'rejected';
  /** The admin's reason, on resubmit / rejected. */
  reviewNote?: string | null;
}

function addDaysToIso(dateStr: string, days: number): string {
  try {
    const d = new Date(dateStr + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().split('T')[0];
  } catch {
    return dateStr;
  }
}

export function mapTaskToQuest(
  item: TaskItem,
  type: 'daily' | 'weekly' | 'monthly' | 'locked'
): QuestItem {
  const tagUpper = item.tag?.toUpperCase() || '';

  // Dynamically bind image from the API response, requesting a
  // format/quality/size-optimized Cloudinary variant instead of the
  // full-resolution original (see services/media/cloudinary.ts).
  const image = item.image_url ? { uri: optimizeCloudinaryUrl(item.image_url) } : null;

  let status: 'todo' | 'done' | 'partial' | 'skipped' | 'locked' = 'todo';
  let reviewStatus: QuestItem['reviewStatus'];
  // Proof quests: submitted proof sits with the done ones (it counts for
  // today's streak) until the admin decides; a resubmit request reopens it.
  if (item.status === 'IN_REVIEW') {
    status = 'done';
    reviewStatus = 'in_review';
  } else if (item.status === 'REJECTED') {
    status = 'done';
    reviewStatus = 'rejected';
  } else if (item.status === 'RESUBMIT') {
    reviewStatus = 'resubmit';
  } else if (item.status === 'COMPLETED') {
    status = 'done';
  } else if (item.status === 'PARTIAL') {
    status = 'partial';
  } else if (item.status === 'SKIPPED') {
    status = 'skipped';
  } else if (item.status === 'LOCKED' || type === 'locked') {
    status = 'locked';
  }

  let targetValue: string | undefined = undefined;
  if (item.target_value !== null && item.target_value !== undefined) {
    let unit = item.target_unit || '';
    if (unit === 'grams') {
      unit = 'g';
    } else if (unit === 'liters') {
      unit = 'L';
    } else if (unit === 'hours' || unit === 'hour') {
      unit = 'hrs';
    }

    if (unit === 'hrs' || unit === 'g' || unit === 'L') {
      targetValue = `${item.target_value}${unit}`;
    } else {
      targetValue = `${item.target_value} ${unit}`.trim();
    }
  }

  const period_end = item.period_start ? addDaysToIso(item.period_start, 29) : undefined;

  return {
    id: item.id,
    title: item.title,
    description: item.description,
    category: item.tag || (type === 'locked' ? 'PREMIUM' : 'QUEST'),
    xpReward: item.xp_reward,
    xpPartial: item.xp_partial,
    type,
    // Older backends don't send is_routine; built-in routine tasks are DAILY_FIXED.
    isRoutine: item.is_routine ?? item.task_type === 'DAILY_FIXED',
    isBuiltIn: item.task_type === 'DAILY_FIXED',
    image,
    status,
    earnedXp: item.xp_earned,
    showTickButton: status !== 'done' && status !== 'skipped' && status !== 'locked',
    showWrongButton: status !== 'done' && status !== 'skipped' && status !== 'locked',
    targetValue,
    allows_partial: item.allows_partial,
    period_start: item.period_start,
    period_end,
    end_date: item.end_date ? item.end_date.slice(0, 10) : undefined,
    price: item.price,
    currency: item.currency || 'INR',
    is_paid: item.is_paid,
    proofCount: item.proof_count ?? 0,
    reviewStatus,
    reviewNote: item.review_note ?? null,
    imageHeight: tagUpper === 'REST' ? 120 : undefined,
    imageStyle: tagUpper === 'NUTRITION' ? { height: 170, top: -25 } : undefined,
  };
}
