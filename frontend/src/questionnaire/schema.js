/**
 * The questionnaire contract.
 *
 * Every step's options, its validation and its position live here so they
 * cannot drift apart. Components render from this module; they never define
 * their own option lists.
 */

export const STEP_IDS = ['role', 'skills', 'values', 'time', 'goal', 'review']

export const STEP_TITLES = {
  role: 'What do you do now?',
  skills: 'What can you already do?',
  values: 'What matters to you at work?',
  time: 'How much can you invest?',
  goal: 'Where do you want this to go?',
  review: 'Check this over',
}

// weeklyHours is the midpoint of each band. The agent is told to size
// milestones against it, so someone with two hours a week is not handed a
// plan that quietly assumes ten.
export const HOURS_OPTIONS = [
  { value: 'lt2', label: 'Under 2 hours a week', weeklyHours: 1 },
  { value: '2to5', label: '2 to 5 hours a week', weeklyHours: 3.5 },
  { value: '5to10', label: '5 to 10 hours a week', weeklyHours: 7.5 },
  { value: 'gt10', label: 'More than 10 hours a week', weeklyHours: 12 },
]

export const BUDGET_OPTIONS = [
  { value: 'free', label: 'Free resources only' },
  { value: 'low', label: 'Up to $100' },
  { value: 'open', label: 'Cost is not the constraint' },
]

export const GOAL_OPTIONS = [
  { value: 'adapt', label: 'Stay in this field and adapt' },
  { value: 'move', label: 'Move to a related role' },
  { value: 'change', label: 'Change fields entirely' },
]

// The six work values scored by O*NET's Work Importance Locator — the same
// source as the task data this product is built on, so the questionnaire is
// citable rather than invented.
export const WORK_VALUES = [
  { value: 'achievement', label: 'Achievement', hint: 'Using your abilities and seeing results' },
  { value: 'independence', label: 'Independence', hint: 'Deciding how you work' },
  { value: 'recognition', label: 'Recognition', hint: 'Advancement and being seen to lead' },
  { value: 'relationships', label: 'Relationships', hint: 'Colleagues, service, working with people' },
  { value: 'support', label: 'Support', hint: 'A manager and organisation that back you up' },
  { value: 'conditions', label: 'Conditions', hint: 'Security, pay, comfort, variety' },
]

export const MAX_VALUES = 2

export function emptyAnswers() {
  return {
    title: '',
    socCode: '',
    occupationTitle: '',
    skills: [],
    workValues: [],
    hours: '',
    budget: '',
    goalType: '',
    goalNote: '',
  }
}

const HOURS_VALUES = new Set(HOURS_OPTIONS.map((o) => o.value))
const BUDGET_VALUES = new Set(BUDGET_OPTIONS.map((o) => o.value))
const GOAL_VALUES = new Set(GOAL_OPTIONS.map((o) => o.value))

export function validateStep(stepId, answers) {
  const errors = []

  if (stepId === 'role') {
    if (!answers.title.trim()) errors.push('Enter your job title.')
    else if (!answers.socCode) errors.push('Choose the closest occupation.')
  }

  if (stepId === 'skills' && answers.skills.length === 0) {
    errors.push('Add at least one thing you can already do.')
  }

  if (stepId === 'values' && answers.workValues.length === 0) {
    errors.push(`Choose up to ${MAX_VALUES}.`)
  }

  if (stepId === 'time') {
    if (!HOURS_VALUES.has(answers.hours)) errors.push('Choose how much time you have.')
    if (!BUDGET_VALUES.has(answers.budget)) errors.push('Choose a budget.')
  }

  if (stepId === 'goal' && !GOAL_VALUES.has(answers.goalType)) {
    errors.push('Choose a direction.')
  }

  return errors
}

export function isStepComplete(stepId, answers) {
  return validateStep(stepId, answers).length === 0
}

export function toRequestPayload(answers) {
  const hours = HOURS_OPTIONS.find((o) => o.value === answers.hours)
  const note = answers.goalNote.trim()
  return {
    soc_code: answers.socCode,
    skills: answers.skills,
    goal_type: answers.goalType || null,
    goal: note || null,
    weekly_hours: hours ? hours.weeklyHours : null,
    budget: answers.budget || null,
    work_values: answers.workValues,
  }
}
