import { sentencesForLevel } from "../data/sentences.js";

function levelStats(level, progress) {
  let mastered = 0;
  for (const card of level.cards) {
    if ((progress[card.id]?.lastQuality ?? -1) >= 2) mastered++;
  }
  return { mastered, total: level.cards.length };
}

export default function Dashboard({
  levels,
  progress,
  stats,
  onStudy,
  onQuiz,
  onType,
  onBuild,
  onStudyBucket,
  onListen,
  onFalling,
  onRush,
  onList,
}) {
  return (
    <div className="dashboard">
      <section className="hero">
        <h1>Your progress</h1>
        <p className="muted small">Tap a group to study those words.</p>
        <div className="stat-grid">
          <Stat
            label="Mastered"
            value={stats.mastered}
            tone="mastered"
            onClick={
              stats.mastered ? () => onStudyBucket("mastered") : undefined
            }
          />
          <Stat
            label="Forgot"
            value={stats.forgot}
            tone="forgot"
            onClick={stats.forgot ? () => onStudyBucket("forgot") : undefined}
          />
          <Stat
            label="Unseen"
            value={stats.unseen}
            tone="unseen"
            onClick={stats.unseen ? () => onStudyBucket("unseen") : undefined}
          />
        </div>
        <div className="hero-modes">
          <button className="mode-btn game-mode" onClick={onFalling}>
            Falling Words
          </button>
          <button className="mode-btn game-mode" onClick={onRush}>
            Sentence Rush
          </button>
        </div>
      </section>

      <section>
        <h2>Levels</h2>
        <div className="deck-grid">
          {levels.map((level) => {
            const s = levelStats(level, progress);
            const pct = Math.round((s.mastered / s.total) * 100);
            const buildable = sentencesForLevel(level.level).length > 0;
            return (
              <article className="deck-card" key={level.id}>
                <div className="deck-head">
                  <span className="level-badge">{level.level}</span>
                  <div>
                    <h3>{level.name}</h3>
                    <p className="muted">{level.subtitle}</p>
                  </div>
                </div>
                <div className="progress-bar" aria-label={`${pct}% mastered`}>
                  <div className="progress-fill" style={{ width: `${pct}%` }} />
                </div>
                <p className="muted small">{pct}% mastered</p>
                <div className="deck-actions">
                  <button className="primary" onClick={() => onStudy(level.id)}>
                    Study
                  </button>
                  <button onClick={() => onQuiz(level.id)}>Quiz</button>
                  <button onClick={() => onType(level.id)}>Type</button>
                  <button
                    onClick={() => onBuild(level.id)}
                    disabled={!buildable}
                    title={
                      buildable ? "Build sentences" : "No sentences for this level yet"
                    }
                  >
                    Build
                  </button>
                  <button onClick={() => onListen(level.id)}>Listen</button>
                  <button onClick={() => onList(level.id)}>List</button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, tone, onClick }) {
  const className = `stat ${tone || ""} ${onClick ? "clickable" : ""}`;
  const inner = (
    <>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </>
  );
  return onClick ? (
    <button className={className} onClick={onClick}>
      {inner}
    </button>
  ) : (
    <div className={className}>{inner}</div>
  );
}
