import { Suspense, cache } from 'react';
import { fetchAllDesignJobs } from '@/lib/fetchAllJobs';
import { getCachedJobs, setCachedJobs } from '@/lib/jobsCache';
import Section from '@/components/Section';
import ParticleCanvas from '@/components/ParticleCanvas';
import ThemeToggle from '@/components/ThemeToggle';
import { ArrowRight, Briefcase, Building2, Globe2, Sparkles } from 'lucide-react';

export const revalidate = 1800;
export const maxDuration = 60;

// Memoize the blob read so JobsContent and the footer timestamp share one fetch
const getCached = cache(getCachedJobs);

async function JobsContent() {
  // 1. Try KV cache — instant when warm (production with KV configured)
  const cached = await getCached();
  let aiJobs, allJobs;

  if (cached) {
    ({ aiJobs, allJobs } = cached);
  } else {
    // 2. Cache miss: fetch live (first load, or local dev without KV)
    const fresh = await fetchAllDesignJobs();
    aiJobs = fresh.aiJobs;
    allJobs = fresh.allJobs;
    // Store in KV so the next request is instant
    await setCachedJobs({ aiJobs, allJobs, fetchedAt: Date.now() });
  }

  const totalJobs = aiJobs.length + allJobs.length;
  const companies = new Set([...aiJobs, ...allJobs].map(job => job.company)).size;
  const remoteRoles = [...aiJobs, ...allJobs].filter(job => job.isRemote).length;

  const stats = [
    { label: 'Open roles', value: totalJobs.toLocaleString(), icon: Briefcase },
    { label: 'Companies', value: companies.toLocaleString(), icon: Building2 },
    { label: 'Remote friendly', value: remoteRoles.toLocaleString(), icon: Globe2 },
    { label: 'AI & frontier', value: aiJobs.length.toLocaleString(), icon: Sparkles },
  ];

  return (
    <div className="space-y-4 sm:space-y-8">
      <div className="flex items-center justify-between gap-3 px-1 text-sm text-muted-foreground sm:hidden">
        <span><span className="text-foreground">{totalJobs.toLocaleString()}</span> roles</span>
        <span><span className="text-foreground">{companies.toLocaleString()}</span> companies</span>
        <span><span className="text-foreground">{remoteRoles.toLocaleString()}</span> remote</span>
      </div>

      <div className="hidden grid-cols-2 gap-2 sm:grid sm:gap-2.5 sm:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="radius-surface border border-border bg-card/95 p-2.5 shadow-soft sm:p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium leading-snug text-muted-foreground sm:text-caption">{label}</span>
              <Icon size={15} className="shrink-0 text-[hsl(var(--accent-teal))] sm:size-4" />
            </div>
            <div className="mt-1.5 text-xl font-medium leading-none text-foreground sm:mt-2 sm:text-2xl">
              {value}
            </div>
          </div>
        ))}
      </div>

      <Section
        title="AI & Frontier Companies"
        jobs={aiJobs}
        defaultOpen={true}
        badge="AI"
      />
      <Section
        title="All Design Roles"
        jobs={allJobs}
        defaultOpen={true}
      />
    </div>
  );
}

function JobsLoading() {
  return (
    <div className="space-y-8">
      {[0, 1].map(i => (
        <div key={i} className="animate-pulse">
          <div className="radius-control mb-4 h-7 w-56 bg-muted" />
          <div className="radius-surface overflow-hidden border border-border bg-card">
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} className="border-b border-border/50 last:border-0 flex items-center gap-4 px-3 py-3">
                <div className="radius-control h-8 w-8 shrink-0 bg-muted" />
                <div className="radius-chip h-3.5 w-28 bg-muted" />
                <div className="radius-chip ml-2 h-3.5 w-40 bg-muted" />
                <div className="radius-chip ml-2 hidden h-3.5 w-24 bg-muted sm:block" />
                <div className="radius-control ml-auto h-8 w-16 bg-muted" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

async function LastUpdated() {
  const cached = await getCached();
  const ts = cached?.fetchedAt ?? Date.now();
  const formatted = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(new Date(ts));

  return (
    <span>
      Last fetched <span className="text-foreground">{formatted}</span>
    </span>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen overflow-hidden bg-background">
      <header className="surface-grid relative overflow-hidden border-b border-border-light">
        <div className="absolute -inset-x-8 -bottom-24 -top-14 hidden pointer-events-none opacity-60 sm:block">
          <ParticleCanvas />
          <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-background via-background/90 to-transparent" />
        </div>

        <div className="relative mx-auto max-w-[1200px] px-3 py-5 sm:px-6 sm:py-10 md:py-12">
          <div className="absolute right-3 top-8 z-10 sm:right-6 sm:top-12 md:top-14">
            <ThemeToggle />
          </div>

          <div className="hero-enter flex flex-col gap-5 sm:gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-[2.55rem] font-medium leading-[0.98] tracking-[-0.035em] text-foreground sm:text-display-lg">
                Design Jobs
              </h1>
              <p className="mt-3 max-w-[22rem] text-[13px] leading-5 text-muted-foreground sm:mt-3 sm:max-w-xl sm:text-[15px] sm:leading-6">
                <span className="sm:hidden">Curated product, UX, brand, motion, and design engineering roles.</span>
                <span className="hidden sm:inline">A fast, curated board for product, UX, brand, motion, and design engineering roles at ambitious technology companies.</span>
              </p>
            </div>

            <a
              href="#jobs"
              className="btn-classic-primary inline-flex h-9 w-fit items-center justify-center gap-2 px-3.5 text-sm font-medium sm:h-10 sm:px-4"
            >
              Browse roles
              <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </header>

      <main id="jobs" className="mx-auto max-w-[1200px] px-3 py-5 sm:px-6 sm:py-8">
        <Suspense fallback={<JobsLoading />}>
          <JobsContent />
        </Suspense>
      </main>

      <footer className="border-t border-border-light">
        <div className="mx-auto flex min-h-16 max-w-[1200px] flex-col gap-2 px-4 py-4 text-caption text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>
            Design Jobs updates every 30 minutes via YC, Ashby, Greenhouse, Workday, Lever and Remotive.
          </span>
          <Suspense fallback={<span>Loading…</span>}>
            <LastUpdated />
          </Suspense>
        </div>
      </footer>
    </div>
  );
}
