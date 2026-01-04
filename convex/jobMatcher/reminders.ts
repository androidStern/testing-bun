export const REMINDERS = {
  MAX_STEPS_WARNING: `<system-reminder>
You're approaching the maximum number of steps for this turn. Prioritize:
1. Complete any in-progress tasks
2. Present results if you have them
3. Summarize what's been done and what remains
4. Let the user know they can continue the conversation
</system-reminder>`,

  NO_RESULTS: `<system-reminder>
The search returned no results. Consider:
1. Suggesting the user broaden their criteria
2. Trying alternative search terms
3. Being honest that this combination of requirements may be difficult to fill
4. Offering to adjust specific criteria
</system-reminder>`,

  REALITY_CHECK: `<system-reminder>
The user's requirements may be difficult to meet in the current job market. Be honest but kind. Suggest realistic alternatives while respecting their goals.
</system-reminder>`,

  REFOCUS: `<system-reminder>
The conversation may be going in circles. Consider:
1. Summarizing what you've tried so far
2. Asking the user directly what would be most helpful right now
3. Suggesting a different approach entirely
</system-reminder>`,

  SESSION_RESUME: `<system-reminder>
The user is returning to an existing conversation. Briefly remind them where you left off before continuing.
</system-reminder>`,
  STALE_PLAN: `<system-reminder>
Your todo list may be stale. If you've completed tasks or the situation has changed, update your plan with todoWrite now.
</system-reminder>`,
}

interface ReminderState {
  turnsSincePlanUpdate: number
  isApproachingMaxSteps: boolean
  lastSearchHadResults: boolean
  isReturningUser: boolean
}

export function getApplicableReminders(state: ReminderState): string[] {
  const reminders: string[] = []

  if (state.turnsSincePlanUpdate >= 5) {
    reminders.push(REMINDERS.STALE_PLAN)
  }

  if (state.isApproachingMaxSteps) {
    reminders.push(REMINDERS.MAX_STEPS_WARNING)
  }

  if (state.lastSearchHadResults === false) {
    reminders.push(REMINDERS.NO_RESULTS)
  }

  if (state.isReturningUser) {
    reminders.push(REMINDERS.SESSION_RESUME)
  }

  return reminders
}
