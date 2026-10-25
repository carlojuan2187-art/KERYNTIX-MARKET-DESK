import type { User } from "./types";

export function isBanActive(user: User) {
  return (
    user.banned && (!user.ban_until || Date.parse(user.ban_until) > Date.now())
  );
}
export function hasAccess(user: User) {
  const isAdmin = Boolean(user.is_admin);
  const banned = isBanActive(user);
  const planActive =
    user.plan === "premium" &&
    Boolean(user.plan_end && Date.parse(user.plan_end) > Date.now());
  const trialActive = Boolean(
    user.trial_end && Date.parse(user.trial_end) > Date.now(),
  );
  return isAdmin || (!banned && (planActive || trialActive));
}

export function nextAccountDeadline(user: User) {
  const deadlines = [
    user.plan === "premium" ? user.plan_end : undefined,
    user.trial_end,
    user.banned ? user.ban_until : undefined,
  ]
    .map((date) => Date.parse(date || ""))
    .filter((date) => Number.isFinite(date) && date > Date.now());
  return deadlines.length ? Math.min(...deadlines) : null;
}
