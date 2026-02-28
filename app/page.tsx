export default function HomePage() {
  return (
    <main className="px-6 pb-14 pt-10">
      <header className="rounded-3xl border border-ink/10 bg-ink px-6 py-10 text-cream shadow-card">
        <h1 className="hero-title font-[var(--font-title)] font-extrabold">
          Telegram
          <br />
          AI Assistant
          <br />
          Backend
        </h1>
        <p className="mt-5 text-sm leading-relaxed text-cream/90">
          이 서비스는 Telegram 5-bot 오케스트레이션 전용 백엔드입니다.
        </p>
      </header>

      <section className="mt-7 rounded-2xl border border-coral/30 bg-coral/10 p-4">
        <p className="text-xs font-bold text-ink/70">Health Endpoint</p>
        <p className="mt-2 text-sm font-semibold text-ink">GET /api/telegram/health</p>
      </section>
    </main>
  );
}
