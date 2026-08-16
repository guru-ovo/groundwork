/**
 * Landing page content.
 *
 * The handoff treats this copy as final — "Content is real. Names, figures
 * and quotes in the designs are drafted copy, not filler." It lives here as
 * data rather than inline in JSX so the page reads as structure and the
 * wording can be edited without touching layout.
 *
 * The figures are the real ones the data carries: 922 distinct SOC codes and
 * 18,747 scored task rows in app/data/tasks_joined.csv. The design mockup
 * said 923 / 19,441; on a page that promises 'no made-up numbers', the
 * headline figure is the last place to carry a rounded-up guess.
 */

export const NAV_LINKS = [
  { href: '#method', label: 'Method' },
  { href: '#sources', label: 'Sources' },
  { href: '#uses', label: 'Use cases' },
  { href: '#faq', label: 'FAQ' },
]

export const HERO = {
  tag: '922 occupations · 18,747 tasks scored',
  headline: "Nobody is coming for your job. They're coming for your tasks.",
  sub:
    'Groundwork splits your role into its real tasks and measures each one ' +
    'against observed AI usage and published exposure research. The number ' +
    'is computed, not written — a model only shows up at the end, to explain it.',
  reassurance: 'No account. 4 minutes. Your answers never leave the session.',
}

/** The left rail of the product shot. */
export const RAIL = [
  { label: 'Report', meta: '', current: true },
  { label: 'Task field', meta: '41' },
  { label: 'Plan', meta: '7' },
  { label: 'Adjacent roles', meta: '6' },
  { label: 'Method', meta: '' },
]

/** 41 task exposures, descending — the bar field in the product shot. */
export const FIELD = [
  84, 81, 78, 76, 74, 71, 69, 66, 64, 61, 59, 57, 56, 54, 53, 51, 50, 49, 47, 46,
  45, 44, 43, 42, 41, 40, 39, 38, 37, 36, 35, 34, 33, 31, 30, 29, 28, 26, 25, 24, 22,
]

export const SOURCES = [
  'O*NET task ratings',
  'Anthropic Economic Index',
  'Eloundou, Manning, Mishkin & Rock (2023)',
]

export const PIPELINE = [
  {
    n: '01',
    title: 'Resolve',
    body:
      'A small model maps your free-text title onto one O*NET occupation. ' +
      'The only place a guess is allowed.',
    tag: 'small LLM',
    llm: true,
  },
  {
    n: '02',
    title: 'Decompose',
    body:
      'Pull that occupation’s real task list, with its own importance and ' +
      'frequency ratings attached.',
    tag: 'no LLM',
    llm: false,
  },
  {
    n: '03',
    title: 'Score',
    body:
      'Blend observed AI usage with published exposure research per task, ' +
      'weighted by importance × frequency.',
    tag: 'no LLM',
    llm: false,
  },
  {
    n: '04',
    title: 'Explain',
    body:
      'Only now does a strong model write — and every milestone must cite ' +
      'the figure it came from.',
    tag: 'strong LLM',
    llm: true,
  },
]

/** Marquee chips. Rendered twice in the DOM so the loop has no seam. */
export const MARQUEE = [
  ['Clean and manipulate raw data', '0.84'],
  ['Write analysis code', '0.78'],
  ['Summarise findings in writing', '0.71'],
  ['Build dashboards', '0.68'],
  ['Read methods literature', '0.66'],
  ['Tune model hyperparameters', '0.62'],
  ['Document data lineage', '0.58'],
  ['Design experiments', '0.33'],
  ['Present to executives', '0.28'],
  ['Negotiate what to measure', '0.24'],
  ['Judge feature validity', '0.38'],
  ['Scope a new question', '0.31'],
].map(([text, pct]) => ({ text, pct }))

export const AT_RISK = [
  { text: 'Clean and manipulate raw data', v: 84 },
  { text: 'Write analysis code', v: 78 },
  { text: 'Produce written summaries of findings', v: 71 },
  { text: 'Read literature to stay current', v: 66 },
]

export const STREAM = [
  { ms: '0.31s', tool: 'onet.tasks', obs: '41 tasks retrieved for 15-2051.00' },
  { ms: '1.04s', tool: 'econ_index.join', obs: '34 of 41 matched — 83% coverage' },
  { ms: '1.62s', tool: 'score.aggregate', obs: 'resilience 61 · 9 tasks above the line' },
  { ms: '2.85s', tool: 'onet.overlap', obs: 'ML Engineers — 71% overlap, resilience 74' },
]

export const MILESTONES = [
  {
    action: 'Move one weekly cleaning job behind a reviewed model diff',
    source: 'your most exposed task · 0.84',
  },
  {
    action: 'Write the measurement brief before the query',
    source: 'framing scores 0.24 — your lowest',
  },
  {
    action: 'Take over one executive readout a month',
    source: 'presenting · 0.28, importance 4.3',
  },
]

export const USE_CASES = [
  {
    who: 'Individuals',
    title: 'Work out what to learn next',
    body:
      'Stop guessing from headlines. See which parts of your week are genuinely ' +
      'exposed and which are quietly safe, then get a plan sized to the hours ' +
      'you actually have.',
    stat: '4 min · free · no account',
  },
  {
    who: 'Managers',
    title: 'Plan a team, not a headcount',
    body:
      'Run the measurement for every role you own and see where the exposure ' +
      'clusters — usually in one band of the org, not evenly across it.',
    stat: 'up to 40 roles per workspace',
  },
  {
    who: 'Career coaches',
    title: 'Bring evidence to the conversation',
    body:
      'Every claim in the report cites a public source, so the discussion moves ' +
      'from anxiety to a specific, checkable list of tasks.',
    stat: 'shareable PDF report',
  },
]

export const STATS = [
  { n: '922', label: 'occupations covered' },
  { n: '18,747', label: 'tasks individually scored' },
  { n: '0', label: 'model calls inside the number' },
  { n: '4.1s', label: 'to a grounded score' },
]

export const STEPS = [
  {
    n: '01',
    title: 'Say what you do',
    body:
      'In your own words. We match it to an occupation and show you the ' +
      'candidates so you can correct us.',
  },
  {
    n: '02',
    title: 'Answer six questions',
    body:
      'Skills, values, interests, hours, budget, goal. All on O*NET’s own ' +
      'scales, so your answers stay citable.',
  },
  {
    n: '03',
    title: 'Read your report',
    body:
      'Score, task breakdown, adjacent roles and a seven-milestone plan. ' +
      'Save it as a PDF and keep it.',
  },
]

export const QUOTES = [
  {
    text:
      'I’d been told for two years that my job was doomed. The report showed me ' +
      'nine specific tasks were exposed and thirty-two weren’t. That is a ' +
      'completely different conversation.',
    name: 'Maya Ellsworth',
    role: 'Senior Data Scientist',
  },
  {
    text:
      'The part that landed was the citation on every milestone. I could check ' +
      'the reasoning instead of taking it on faith.',
    name: 'Tom Vasquez',
    role: 'Analytics Manager',
  },
  {
    text:
      'I ran it for all eleven roles on my team. The exposure wasn’t spread ' +
      'evenly — it sat almost entirely in one band. That changed how I planned ' +
      'the year.',
    name: 'Priya Raghunathan',
    role: 'Director of Insight',
  },
  {
    text:
      'It refused to tell me my job was safe, and I respect that more than the ' +
      'tools that would have.',
    name: 'Daniel Okafor',
    role: 'Research Associate',
  },
  {
    text:
      'Four minutes for something my company paid a consultancy six figures to ' +
      'get wrong.',
    name: 'Hannah Beck',
    role: 'Operations Lead',
  },
  {
    text:
      'The adjacent-role diagram was the first time anyone showed me a next step ' +
      'in terms of tasks I already do.',
    name: 'Luis Moreau',
    role: 'Statistician',
  },
]

export const PROMISES = [
  {
    title: 'No made-up numbers',
    body:
      'The score is arithmetic over published data. If a model wrote a figure, ' +
      'it doesn’t appear on the page.',
  },
  {
    title: 'No forecast dressed as fact',
    body:
      'Observed AI usage is not a prediction of job loss, and we say so on the ' +
      'report itself, not in a footnote.',
  },
  {
    title: 'No account, no tracking',
    body:
      'The questionnaire runs in your session. We don’t store your answers and ' +
      'there is nothing to delete later.',
  },
  {
    title: 'No upsell at the end',
    body:
      'The plan cites free resources by default. If a paid course is genuinely ' +
      'the shortest path, it says why.',
  },
]

export const FAQS = [
  {
    q: 'Where does the exposure score actually come from?',
    a:
      'Each task in your occupation carries an O*NET importance and frequency ' +
      'rating. We blend the Anthropic Economic Index usage label for that kind ' +
      'of work with the Eloundou et al. exposure coefficient, then weight the ' +
      'result by how much the task matters and how often you do it. No language ' +
      'model touches the calculation.',
  },
  {
    q: 'Does a high score mean my job is safe?',
    a:
      'It means fewer of your tasks currently show heavy AI use, weighted by how ' +
      'central they are. It is a measurement of the present, not a forecast. A ' +
      'role can score well today and still change quickly.',
  },
  {
    q: 'What if my job title isn’t in O*NET?',
    a:
      'Most invented titles aren’t. We show you the three closest occupations ' +
      'with a confidence figure for each, and you pick — the whole measurement ' +
      'hangs on that match, so we don’t hide it from you.',
  },
  {
    q: 'Why is the Economic Index the right source?',
    a:
      'It measures AI use that has already been observed rather than what a model ' +
      'imagines might be automatable. The trade-off is coverage: about 83% of ' +
      'tasks match, and the rest fall back to published exposure research and get ' +
      'flagged.',
  },
  {
    q: 'Is my data stored anywhere?',
    a:
      'No. There is no account, the questionnaire lives in your session, and the ' +
      'report is generated and handed to you. Save the PDF if you want to keep it.',
  },
  {
    q: 'How often should I re-run it?',
    a:
      'Every six months. The Economic Index updates quarterly, and a stale score ' +
      'is worse than no score.',
  },
  {
    q: 'Is it free?',
    a:
      'The measurement and the plan are free. Team workspaces, which run the same ' +
      'measurement across many roles at once, are not.',
  },
]

export const FOOTER = [
  { title: 'Product', links: ['Run a measurement', 'Sample report', 'For teams', 'Changelog'] },
  { title: 'Method', links: ['How scoring works', 'Sources', 'Limitations', 'Coverage'] },
  { title: 'Company', links: ['About', 'Contact', 'Privacy', 'Terms'] },
]
