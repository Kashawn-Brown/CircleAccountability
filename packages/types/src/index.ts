// ============================================================
// Circle Accountability — Shared Types
// These mirror the backend API contracts exactly.
// Both web and mobile import from this package.
// ============================================================

// --- Users ---

// Shape matches the Go response in apps/api/internal/repo/users.go.
// Nullable columns (username, avatarUrl) use `omitempty` on the backend,
// so they're absent from the JSON when null — modeled here as optional.
export interface User {
  id: string;
  clerkUserId: string;
  email: string;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  createdAt: string; // ISO 8601
  updatedAt: string;
}

// --- Circles ---

export type GoalCategory = 'fitness' | 'study' | 'wellness' | 'finance' | 'general';
export type MetricType = 'count' | 'duration' | 'amount';
export type Cadence = 'daily' | 'weekly' | 'monthly';
export type CircleStatus = 'active' | 'paused' | 'completed' | 'archived';
export type TargetMode = 'per_member_equal' | 'shared_total_split_evenly';

export interface Circle {
  id: string;
  name: string;
  description: string | null;
  createdByUserId: string;
  goalCategory: GoalCategory;
  metricType: MetricType;
  metricUnit: string; // e.g. "workouts", "minutes", "steps"
  cadence: Cadence;
  targetMode: TargetMode;
  targetValue: number;
  status: CircleStatus;
  startDate: string; // ISO 8601 date
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- Circle Members ---

export type MemberRole = 'owner' | 'leader' | 'member';
export type MembershipStatus = 'invited' | 'active' | 'left' | 'removed';

export interface CircleMember {
  id: string;
  circleId: string;
  userId: string;
  role: MemberRole;
  membershipStatus: MembershipStatus;
  joinedAt: string | null;
  sliceOrder: number | null;
  memberTargetOverride: number | null; // null = use circle default
  createdAt: string;
  updatedAt: string;
  // Joined user info (often included in responses)
  user?: Pick<User, 'id' | 'displayName' | 'username' | 'avatarUrl'>;
}

// --- Invitations ---

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface Invitation {
  id: string;
  circleId: string;
  invitedByUserId: string;
  inviteToken: string;
  inviteeEmail: string | null;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
}

// --- Check-ins ---

export type CheckInSource = 'manual';

export interface CheckIn {
  id: string;
  circleId: string;
  userId: string;
  circleMemberId: string;
  value: number;
  note: string | null;
  occurredAt: string;
  countsTowardDate: string; // YYYY-MM-DD
  countsTowardPeriodKey: string; // e.g. "2025-W03" or "2025-01-15"
  source: CheckInSource;
  createdAt: string;
  updatedAt: string;
}

// --- Progress (computed/derived - not stored) ---

export interface MemberProgress {
  userId: string;
  circleMemberId: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  targetValue: number; // effective target (override or default)
  currentValue: number; // sum of check-ins this period
  progressPercent: number; // 0–100
  isOnTrack: boolean;
  isComplete: boolean;
  sliceOrder: number;
  color: string; // assigned color for ring slice
}

export interface CircleProgress {
  circleId: string;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  totalTarget: number;
  totalCurrent: number;
  overallPercent: number;
  isComplete: boolean;
  members: MemberProgress[];
}

// --- API Response Wrappers ---

export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: string;
  code?: string;
}

// --- Request Bodies (used by both clients to type API calls) ---

export interface CreateCircleRequest {
  name: string;
  description?: string;
  goalCategory: GoalCategory;
  metricType: MetricType;
  metricUnit: string;
  cadence: Cadence;
  targetMode: TargetMode;
  targetValue: number;
  startDate: string;
  endDate?: string;
}

export interface CreateCheckInRequest {
  value: number;
  note?: string;
  occurredAt?: string; // defaults to now if omitted
}

export interface CreateInviteRequest {
  inviteeEmail?: string;
}

export interface JoinCircleRequest {
  inviteToken: string;
  memberTargetOverride?: number;
}
