import { Link } from 'react-router-dom'
import Logo from '../components/Logo'
import { useSurface } from '../hooks/useSurface'
import {
  AT_RISK, FAQS, FIELD, FOOTER, HERO, MARQUEE, MILESTONES, NAV_LINKS,
  PIPELINE, PROMISES, RAIL, SOURCES, STATS, STEPS, STREAM, USE_CASES,
} from './content'
import './Landing.css'

/**
 * The marketing landing page — Direction B, "Paper".
 *
 * Light warm ground, no accent hue, hierarchy carried by tone and space.
 * Deliberately the opposite surface to the product, which stays dark: the
 * handoff sanctions the split so long as neither leaks into the other, which
 * `useSurface` enforces at the document root.
 */
export default function Landing() {
  useSurface('paper')

  return (
    <div className="lp">
      <header className="lp-nav">
        <nav className="lp-nav__inner" aria-label="Primary">
          <Link to="/" className="lp-nav__brand">
            <Logo size={19} />
            Groundwork
            <span className="tag tag--outline">beta</span>
          </Link>
          <div className="lp-nav__links">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href}>{l.label}</a>
            ))}
            <Link to="/start" className="btn btn--primary">Run mine</Link>
          </div>
        </nav>
      </header>

      <main>
        <Hero />
        <SourceBar />
        <Method />
        <Marquee />
        <Features />
        <UseCases />
        <StatBand />
        <GetStarted />
        <Commitments />
        <Faq />
        <ClosingCta />
      </main>

      <SiteFooter />
    </div>
  )
}

/* --- Hero ------------------------------------------------------------------ */

function Hero() {
  return (
    <section className="lp-hero">
      <div className="lp-halo lp-halo--hero" aria-hidden="true" />
      <span className="tag tag--fill lp-hero__tag">{HERO.tag}</span>
      <h1 className="lp-hero__headline">{HERO.headline}</h1>
      <p className="lp-hero__sub">{HERO.sub}</p>
      <div className="lp-hero__actions">
        <Link to="/start" className="btn btn--primary">Measure my role — free</Link>
        <a href="#method" className="btn btn--secondary">See a sample report</a>
      </div>
      <span className="lp-hero__reassurance">{HERO.reassurance}</span>
      <ProductShot />
    </section>
  )
}

/**
 * The page's proof: the real results UI inside browser chrome.
 *
 * Presentational only — it is a still of the product, not a live render, so
 * it carries no data fetch and is hidden from assistive tech behind one
 * summary label rather than read out as forty-one meaningless bars.
 */
function ProductShot() {
  return (
    <figure className="lp-shot">
      <div className="lp-shot__chrome" aria-hidden="true">
        <span className="lp-shot__dot" />
        <span className="lp-shot__dot" />
        <span className="lp-shot__dot" />
        <span className="lp-shot__url">groundwork.app/report/15-2051.00</span>
      </div>

      <div className="lp-shot__body" aria-hidden="true">
        <div className="lp-shot__rail">
          {RAIL.map((r) => (
            <span
              key={r.label}
              className={'lp-shot__rail-item' + (r.current ? ' is-current' : '')}
            >
              <span>{r.label}</span>
              <span className="lp-shot__rail-meta">{r.meta}</span>
            </span>
          ))}
        </div>

        <div className="lp-shot__main">
          <div className="lp-shot__head">
            <div className="lp-ring">
              <div className="lp-ring__glow" />
              <svg width="104" height="104" viewBox="0 0 104 104" className="lp-ring__svg">
                <circle cx="52" cy="52" r="45" fill="none" strokeWidth="7" className="lp-ring__track" />
                <circle
                  cx="52" cy="52" r="45" fill="none" strokeWidth="7" strokeLinecap="round"
                  strokeDasharray="282.7" strokeDashoffset="110.3" className="lp-ring__value"
                />
              </svg>
              <span className="lp-ring__num">61</span>
            </div>
            <div className="lp-shot__headings">
              <span className="tag tag--outline">Data Scientists · 15-2051.00</span>
              <span className="lp-shot__finding">
                Nine of your forty-one tasks are already being done with AI
              </span>
              <span className="lp-shot__note">
                All nine sit in the execution middle. Both ends of the job are barely touched.
              </span>
            </div>
          </div>

          <div className="lp-shot__field">
            <div className="lp-shot__field-head">
              <span className="mono-label">Task field · 41 tasks by exposure</span>
              <span className="lp-shot__field-key">above the line = already automated somewhere</span>
            </div>
            <div className="lp-shot__bars">
              {FIELD.map((v, i) => (
                <span
                  key={i}
                  className={
                    'lp-shot__bar' +
                    (v >= 70 ? ' is-high' : v >= 50 ? ' is-mid' : ' is-low')
                  }
                  style={{ height: `${v}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      <figcaption className="sr-only">
        A Groundwork report for Data Scientists: a resilience score of 61, and
        41 tasks ranked by exposure, nine of them above the automation line.
      </figcaption>
    </figure>
  )
}

/* --- Sources --------------------------------------------------------------- */

function SourceBar() {
  return (
    <section id="sources" className="lp-sources lp-reveal">
      <span className="lp-sources__lede">
        Every number on the page traces to one of three published sources
      </span>
      <ul className="lp-sources__list">
        {SOURCES.map((s) => (
          <li key={s}><span className="lp-sources__dot" aria-hidden="true" />{s}</li>
        ))}
      </ul>
    </section>
  )
}

/* --- Method ---------------------------------------------------------------- */

function Method() {
  return (
    <section id="method" className="lp-method lp-reveal">
      <div className="lp-method__copy">
        <span className="tag tag--fill">The method</span>
        <h2>The score is computed. Only the explanation is written.</h2>
        <p>
          Most &ldquo;AI will take your job&rdquo; tools are one prompt in a trench
          coat. Groundwork runs four stages, and exactly one of them touches a
          language model — at the very end, to put arithmetic into sentences.
        </p>
        <a href="#faq" className="btn btn--secondary">Read the full method</a>
      </div>
      <ol className="lp-pipeline">
        {PIPELINE.map((p) => (
          <li key={p.n} className="lp-pipeline__row">
            <span className="lp-pipeline__n">{p.n}</span>
            <div className="lp-pipeline__body">
              <span className="lp-pipeline__title">{p.title}</span>
              <span className="lp-pipeline__text">{p.body}</span>
            </div>
            <span className={'lp-pipeline__tag' + (p.llm ? ' is-llm' : '')}>{p.tag}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

/* --- Marquee --------------------------------------------------------------- */

function Marquee() {
  return (
    <section className="lp-marquee lp-reveal">
      <h2>It reads your job the way your job actually happens</h2>
      <p>
        Not &ldquo;data scientist&rdquo; as a title — the forty-one specific things a
        data scientist does in a week, each one rated for how much it matters and
        how often it comes around.
      </p>
      {/* The track is duplicated so the -50% translate loops without a seam.
          The copy is aria-hidden; one reading of the list is enough. */}
      <div className="lp-marquee__mask">
        <div className="lp-marquee__track">
          {MARQUEE.map((m) => <Chip key={m.text} {...m} />)}
          {MARQUEE.map((m) => <Chip key={`dup-${m.text}`} {...m} duplicate />)}
        </div>
      </div>
    </section>
  )
}

function Chip({ text, pct, duplicate }) {
  return (
    <span className="lp-chip" aria-hidden={duplicate || undefined}>
      {text}
      <span className="lp-chip__pct">{pct}</span>
    </span>
  )
}

/* --- Feature grid ---------------------------------------------------------- */

function Features() {
  return (
    <section className="lp-features lp-reveal">
      <h2>Your whole exposure picture, in one report</h2>
      <div className="lp-features__grid">
        <FeatureCard
          title="Task-level exposure"
          body="Every task scored and ranked, with the source and the arithmetic behind each figure shown next to it."
          visual={
            <div className="lp-fv lp-fv--bars">
              {AT_RISK.map((t) => (
                <div key={t.text} className="lp-fv__row">
                  <div className="lp-fv__label">
                    <span>{t.text}</span>
                    <span className="lp-fv__pct">{`0.${t.v}`}</span>
                  </div>
                  <span className="lp-fv__track">
                    <span className="lp-fv__fill" style={{ width: `${t.v}%` }} />
                  </span>
                </div>
              ))}
            </div>
          }
        />
        <FeatureCard
          title="The agent shows its work"
          body="Every retrieval, join and weighting step is on screen as it happens. No spinner pretending to think."
          visual={
            <div className="lp-fv lp-fv--stream">
              {STREAM.map((s) => (
                <div key={s.tool} className="lp-fv__stream-row">
                  <span className="lp-fv__ms">{s.ms}</span>
                  <span className="lp-fv__tool">{s.tool}</span>
                  <span className="lp-fv__obs">{s.obs}</span>
                </div>
              ))}
            </div>
          }
        />
        <FeatureCard
          title="Where this could go"
          body="Adjacent occupations ranked by how much of your existing task list carries over — not by what sounds aspirational."
          visual={
            <div className="lp-fv lp-fv--path">
              <div className="lp-fv__node">
                <span className="lp-fv__score">61</span>
                <span className="lp-fv__cap">where you are</span>
              </div>
              <span className="lp-fv__link" aria-hidden="true" />
              <div className="lp-fv__node lp-fv__node--end">
                <span className="lp-fv__score">74</span>
                <span className="lp-fv__cap">ML Engineers</span>
              </div>
              <span className="lp-fv__path-meta">
                71% task overlap · 82% interest fit · ~6 months
              </span>
            </div>
          }
        />
        <FeatureCard
          title="A plan that cites itself"
          body="Seven milestones sized to the hours you actually have, each one naming the figure that justifies it."
          visual={
            <div className="lp-fv lp-fv--plan">
              {MILESTONES.map((m) => (
                <div key={m.action} className="lp-fv__milestone">
                  <span className="lp-fv__action">{m.action}</span>
                  <span className="lp-fv__source">{m.source}</span>
                </div>
              ))}
            </div>
          }
        />
      </div>
    </section>
  )
}

function FeatureCard({ title, body, visual }) {
  return (
    <article className="card lp-feature">
      <div className="lp-feature__visual">{visual}</div>
      <div className="lp-feature__copy">
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
    </article>
  )
}

/* --- Use cases ------------------------------------------------------------- */

function UseCases() {
  return (
    <section id="uses" className="lp-uses lp-reveal">
      <h2>How people use Groundwork</h2>
      <p className="lp-uses__lede">Same measurement, three very different questions.</p>
      <div className="lp-uses__grid">
        {USE_CASES.map((u) => (
          <article key={u.who} className="card lp-use">
            <span className="tag tag--outline">{u.who}</span>
            <h3>{u.title}</h3>
            <p>{u.body}</p>
            <span className="lp-use__stat">{u.stat}</span>
          </article>
        ))}
      </div>
    </section>
  )
}

/* --- Stat band ------------------------------------------------------------- */

function StatBand() {
  return (
    <section className="lp-band">
      <dl className="lp-band__inner">
        {STATS.map((s) => (
          <div key={s.label} className="lp-band__stat">
            <dt className="sr-only">{s.label}</dt>
            <dd className="lp-band__n">{s.n}</dd>
            <dd className="lp-band__label" aria-hidden="true">{s.label}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/* --- Get started ----------------------------------------------------------- */

function GetStarted() {
  return (
    <section className="lp-start lp-reveal">
      <div className="lp-start__copy">
        <h2>Four minutes, start to plan</h2>
        <p>No signup, no card, no sales call at the end of it.</p>
        <Link to="/start" className="btn btn--primary">Start now</Link>
      </div>
      <ol className="lp-start__steps">
        {STEPS.map((s) => (
          <li key={s.n}>
            <span className="lp-start__n">{s.n}</span>
            <span className="lp-start__title">{s.title}</span>
            <span className="lp-start__body">{s.body}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

/* --- Commitments ----------------------------------------------------------- */

function Commitments() {
  return (
    <section className="lp-promise lp-reveal">
      <div className="lp-promise__copy">
        <h2>What we promise not to do</h2>
        <p>
          A tool that tells people about their livelihood should be careful with
          the claim it makes.
        </p>
      </div>
      <ul className="lp-promise__grid">
        {PROMISES.map((p) => (
          <li key={p.title}>
            <span className="lp-promise__title">
              <span className="lp-promise__dot" aria-hidden="true" />
              {p.title}
            </span>
            <span className="lp-promise__body">{p.body}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/* --- FAQ ------------------------------------------------------------------- */

function Faq() {
  return (
    <section id="faq" className="lp-faq lp-reveal">
      <div className="lp-faq__copy">
        <h2>Frequently asked questions</h2>
        <a href="#sources" className="btn btn--secondary">Ask us something else</a>
      </div>
      {/* Native disclosure: keyboard, screen-reader and find-in-page behaviour
          come free, and the content is in the DOM whether open or not. */}
      <div className="lp-faq__list">
        {FAQS.map((f) => (
          <details key={f.q}>
            <summary>
              {f.q}
              <span className="lp-faq__plus" aria-hidden="true">+</span>
            </summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

/* --- Closing --------------------------------------------------------------- */

function ClosingCta() {
  return (
    <section className="lp-cta">
      <div className="lp-halo lp-halo--cta" aria-hidden="true" />
      <h2>Find out which nine tasks it is.</h2>
      <p>
        Four minutes, forty-one tasks, three sources, and a plan you can start
        on Monday.
      </p>
      <div className="lp-cta__actions">
        <Link to="/start" className="btn btn--primary">Measure my role — free</Link>
        <a href="#method" className="btn btn--secondary">See a sample report</a>
      </div>
    </section>
  )
}

function SiteFooter() {
  return (
    <footer className="lp-footer">
      <div className="lp-footer__inner">
        <div className="lp-footer__brand">
          <span className="lp-footer__mark">
            <Logo size={17} />
            Groundwork
          </span>
          <span className="lp-footer__tag">
            What&apos;s actually changing in your field — grounded in real data,
            not an AI&apos;s guess.
          </span>
        </div>
        {FOOTER.map((col) => (
          <nav key={col.title} className="lp-footer__col" aria-label={col.title}>
            <span className="lp-footer__col-title">{col.title}</span>
            {col.links.map((l) => (
              <a key={l} href="#method">{l}</a>
            ))}
          </nav>
        ))}
      </div>
    </footer>
  )
}
