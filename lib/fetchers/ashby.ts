import type { Job, AtsSource } from '@/types/job';
import { isAIFromCurated } from './curatedAI';

interface AshbyJob {
  id: string;
  title: string;
  team?: string;
  location?: string;
  isRemote?: boolean;
  applyUrl?: string;
  jobUrl?: string;
  publishedAt?: string;
  employmentType?: string;
}

async function fetchAshbyJobs(slug: string, name: string, domain: string, batch?: string): Promise<Job[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 28000);
  try {
    const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${slug}`, {
      signal: controller.signal,
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json() as { jobs?: AshbyJob[] };
    return (data.jobs ?? []).map(job => ({
      id: `ashby-${slug}-${job.id}`,
      title: job.title,
      company: name,
      companyDomain: domain,
      location: job.location ?? '',
      isRemote: job.isRemote ?? false,
      url: job.applyUrl ?? job.jobUrl ?? `https://jobs.ashbyhq.com/${slug}/${job.id}`,
      postedAt: job.publishedAt ?? new Date(0).toISOString(),
      department: job.team ?? '',
      ats: 'ashby' as AtsSource,
      sources: ['ashby' as AtsSource],
      isAI: isAIFromCurated(name),
      batch,
    }));
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

const ASHBY_COMPANIES: Array<{ slug: string; name: string; domain: string; batch?: string }> = [
  // AI / Frontier
  { slug: 'openai', name: 'OpenAI', domain: 'openai.com' },
  { slug: 'anthropic', name: 'Anthropic', domain: 'anthropic.com', batch: 'S21' },
  { slug: 'runway', name: 'Runway', domain: 'runwayml.com', batch: 'S19' },
  { slug: 'coframe', name: 'Coframe', domain: 'coframe.ai', batch: 'S22' },
  { slug: 'krea', name: 'Krea', domain: 'krea.ai', batch: 'W23' },
  { slug: 'together-ai', name: 'Together AI', domain: 'together.ai', batch: 'S22' },
  { slug: 'harvey', name: 'Harvey AI', domain: 'harvey.ai', batch: 'W22' },
  { slug: 'writer', name: 'Writer', domain: 'writer.com', batch: 'S20' },
  { slug: 'scale-ai', name: 'Scale AI', domain: 'scale.com', batch: 'S16' },
  { slug: 'lindy', name: 'Lindy', domain: 'lindy.ai', batch: 'W23' },
  { slug: 'ideogram', name: 'Ideogram', domain: 'ideogram.ai', batch: 'S22' },
  { slug: 'suno', name: 'Suno', domain: 'suno.com', batch: 'S23' },
  { slug: 'udio', name: 'Udio', domain: 'udio.com', batch: 'W24' },
  { slug: 'glean', name: 'Glean', domain: 'glean.com', batch: 'S19' },
  { slug: 'descript', name: 'Descript', domain: 'descript.com', batch: 'W19' },
  { slug: 'codeium', name: 'Codeium', domain: 'codeium.com', batch: 'W22' },
  { slug: 'perplexity', name: 'Perplexity AI', domain: 'perplexity.ai' },
  { slug: 'elevenLabs', name: 'ElevenLabs', domain: 'elevenlabs.io' },
  { slug: 'lumaai', name: 'Luma AI', domain: 'lumalabs.ai' },
  { slug: 'mistral', name: 'Mistral AI', domain: 'mistral.ai' },
  { slug: 'cognition-labs', name: 'Cognition AI', domain: 'cognition.ai' },
  { slug: 'cursor', name: 'Cursor', domain: 'cursor.com' },
  { slug: 'wandb', name: 'Weights & Biases', domain: 'wandb.ai' },
  { slug: 'cohere', name: 'Cohere', domain: 'cohere.com' },
  { slug: 'modal-labs', name: 'Modal', domain: 'modal.com' },
  { slug: 'anyscale', name: 'Anyscale', domain: 'anyscale.com' },
  { slug: 'typeface', name: 'Typeface', domain: 'typeface.ai' },
  { slug: 'synthesia', name: 'Synthesia', domain: 'synthesia.io' },
  { slug: 'factory', name: 'Factory', domain: 'factory.ai' },
  { slug: 'cresta', name: 'Cresta', domain: 'cresta.com', batch: 'S18' },
  // Productivity / Collab tools
  { slug: 'linear', name: 'Linear', domain: 'linear.app', batch: 'W19' },
  { slug: 'notion', name: 'Notion', domain: 'notion.so', batch: 'W18' },
  { slug: 'vercel', name: 'Vercel', domain: 'vercel.com', batch: 'W21' },
  { slug: 'supabase', name: 'Supabase', domain: 'supabase.com', batch: 'W20' },
  { slug: 'replit', name: 'Replit', domain: 'replit.com', batch: 'W18' },
  { slug: 'hex', name: 'Hex', domain: 'hex.tech', batch: 'W21' },
  { slug: 'clay', name: 'Clay', domain: 'clay.com', batch: 'S22' },
  { slug: 'mintlify', name: 'Mintlify', domain: 'mintlify.com', batch: 'W22' },
  { slug: 'retool', name: 'Retool', domain: 'retool.com', batch: 'W17' },
  { slug: 'mercury', name: 'Mercury', domain: 'mercury.com', batch: 'S19' },
  { slug: 'ramp', name: 'Ramp', domain: 'ramp.com', batch: 'W19' },
  { slug: 'brex', name: 'Brex', domain: 'brex.com', batch: 'W17' },
  { slug: 'rippling', name: 'Rippling', domain: 'rippling.com', batch: 'W17' },
  { slug: 'lattice', name: 'Lattice', domain: 'lattice.com' },
  { slug: 'loom', name: 'Loom', domain: 'loom.com' },
  { slug: 'figma', name: 'Figma', domain: 'figma.com', batch: 'W15' },
  { slug: 'webflow', name: 'Webflow', domain: 'webflow.com' },
  { slug: 'framer', name: 'Framer', domain: 'framer.com' },
  { slug: 'pitch', name: 'Pitch', domain: 'pitch.com' },
  { slug: 'superhuman', name: 'Superhuman', domain: 'superhuman.com' },
  { slug: 'altitude', name: 'Altitude', domain: 'altitude.com' },
  { slug: 'flatfile', name: 'Flatfile', domain: 'flatfile.com' },
  { slug: 'iter', name: 'Iter', domain: 'iterapp.com' },
  { slug: 'campsite', name: 'Campsite', domain: 'campsite.design' },
  { slug: 'plane', name: 'Plane', domain: 'plane.so' },
  // Dev tools / infra
  { slug: 'railway', name: 'Railway', domain: 'railway.app' },
  { slug: 'stytch', name: 'Stytch', domain: 'stytch.com' },
  { slug: 'infisical', name: 'Infisical', domain: 'infisical.com' },
  { slug: 'browserbase', name: 'Browserbase', domain: 'browserbase.com', batch: 'W24' },
  { slug: 'socket', name: 'Socket', domain: 'socket.dev' },
  { slug: 'flutterflow', name: 'FlutterFlow', domain: 'flutterflow.io', batch: 'W20' },
  { slug: 'draftbit', name: 'Draftbit', domain: 'draftbit.com' },
  { slug: 'neon', name: 'Neon', domain: 'neon.tech' },
  { slug: 'turso', name: 'Turso', domain: 'turso.tech' },
  { slug: 'posthog', name: 'PostHog', domain: 'posthog.com' },
  { slug: 'highlight', name: 'Highlight.io', domain: 'highlight.io' },
  // Fintech
  { slug: 'robinhood', name: 'Robinhood', domain: 'robinhood.com', batch: 'W13' },
  { slug: 'chime', name: 'Chime', domain: 'chime.com', batch: 'S14' },
  { slug: 'plaid', name: 'Plaid', domain: 'plaid.com' },
  { slug: 'coinbase', name: 'Coinbase', domain: 'coinbase.com', batch: 'S12' },
  { slug: 'stripe', name: 'Stripe', domain: 'stripe.com', batch: 'S09' },
  { slug: 'marqeta', name: 'Marqeta', domain: 'marqeta.com' },
  { slug: 'melio', name: 'Melio', domain: 'meliopayments.com' },
  // Enterprise / B2B
  { slug: 'intercom', name: 'Intercom', domain: 'intercom.com', batch: 'S11' },
  { slug: 'gong', name: 'Gong', domain: 'gong.io', batch: 'S16' },
  { slug: 'sigma', name: 'Sigma Computing', domain: 'sigmacomputing.com', batch: 'S17' },
  { slug: 'hightouch', name: 'Hightouch', domain: 'hightouch.com', batch: 'W19' },
  { slug: 'merge', name: 'Merge', domain: 'merge.dev' },
  { slug: 'brainco', name: 'Brainco', domain: 'brainco.com' },
  { slug: 'deel', name: 'Deel', domain: 'deel.com' },
  { slug: 'remote', name: 'Remote', domain: 'remote.com' },
  { slug: 'drata', name: 'Drata', domain: 'drata.com' },
  { slug: 'vanta', name: 'Vanta', domain: 'vanta.com' },
  { slug: 'workos', name: 'WorkOS', domain: 'workos.com' },
  // Consumer / Social
  { slug: 'duolingo', name: 'Duolingo', domain: 'duolingo.com', batch: 'W12' },
  { slug: 'discord', name: 'Discord', domain: 'discord.com' },
  { slug: 'canva', name: 'Canva', domain: 'canva.com' },
  { slug: 'spotify', name: 'Spotify', domain: 'spotify.com' },
  // Health / Bio
  { slug: 'benchling', name: 'Benchling', domain: 'benchling.com', batch: 'S12' },
  { slug: 'hims', name: 'Hims & Hers', domain: 'forhims.com' },
  { slug: 'ro', name: 'Ro', domain: 'ro.co' },
  { slug: 'lyra-health', name: 'Lyra Health', domain: 'lyrahealth.com' },
  // Design tools / agencies
  { slug: 'zeroheight', name: 'zeroheight', domain: 'zeroheight.com' },
  { slug: 'pastel', name: 'Pastel', domain: 'usepastel.com' },
  { slug: 'storybook', name: 'Storybook', domain: 'storybook.js.org' },
  // Commerce / Marketplace
  { slug: 'faire', name: 'Faire', domain: 'faire.com', batch: 'W17' },
  { slug: 'glossgenius', name: 'GlossGenius', domain: 'glossgenius.com', batch: 'W17' },
  { slug: 'bolt', name: 'Bolt', domain: 'bolt.com', batch: 'S16' },
  // AI / ML (new)
  { slug: 'vapi', name: 'Vapi', domain: 'vapi.ai', batch: 'W23' },
  { slug: 'huggingface', name: 'Hugging Face', domain: 'huggingface.co' },
  { slug: 'replicate', name: 'Replicate', domain: 'replicate.com', batch: 'S20' },
  { slug: 'pika', name: 'Pika', domain: 'pika.art', batch: 'S22' },
  { slug: 'heygen', name: 'HeyGen', domain: 'heygen.com' },
  { slug: 'hedra', name: 'Hedra', domain: 'hedra.com', batch: 'W24' },
  { slug: 'captions', name: 'Captions', domain: 'captions.ai' },
  { slug: 'moonvalley', name: 'Moonvalley', domain: 'moonvalley.ai', batch: 'S23' },
  { slug: 'augment', name: 'Augment Code', domain: 'augmentcode.com' },
  { slug: 'devin', name: 'Cognition / Devin', domain: 'cognition.ai' },
  // Design / Creative tools (new)
  { slug: 'raycast', name: 'Raycast', domain: 'raycast.com' },
  { slug: 'the-browser-company', name: 'Arc Browser', domain: 'arc.net' },
  { slug: 'warp', name: 'Warp', domain: 'warp.dev' },
  { slug: 'zed', name: 'Zed', domain: 'zed.dev' },
  { slug: 'lottiefiles', name: 'LottieFiles', domain: 'lottiefiles.com' },
  { slug: 'rive', name: 'Rive', domain: 'rive.app' },
  { slug: 'attio', name: 'Attio', domain: 'attio.com' },
  { slug: 'beehiiv', name: 'Beehiiv', domain: 'beehiiv.com', batch: 'W22' },
  // Dev infra (new)
  { slug: 'clerk', name: 'Clerk', domain: 'clerk.com', batch: 'W22' },
  { slug: 'resend', name: 'Resend', domain: 'resend.com', batch: 'W23' },
  { slug: 'cal-com', name: 'Cal.com', domain: 'cal.com', batch: 'W22' },
  { slug: 'liveblocks', name: 'Liveblocks', domain: 'liveblocks.io' },
  { slug: 'sanity', name: 'Sanity', domain: 'sanity.io' },
  { slug: 'planetscale', name: 'PlanetScale', domain: 'planetscale.com', batch: 'S18' },
  { slug: 'temporalio', name: 'Temporal', domain: 'temporal.io' },
  { slug: 'render', name: 'Render', domain: 'render.com', batch: 'S19' },
  { slug: 'netlify', name: 'Netlify', domain: 'netlify.com' },
  { slug: 'tailscale', name: 'Tailscale', domain: 'tailscale.com', batch: 'W20' },
  { slug: 'dub', name: 'Dub', domain: 'dub.co', batch: 'W23' },
  { slug: 'pinecone', name: 'Pinecone', domain: 'pinecone.io' },
  { slug: 'algolia', name: 'Algolia', domain: 'algolia.com' },
  { slug: 'sentry', name: 'Sentry', domain: 'sentry.io', batch: 'W12' },
  { slug: 'grafana', name: 'Grafana Labs', domain: 'grafana.com' },
  { slug: 'cloudflare', name: 'Cloudflare', domain: 'cloudflare.com' },
  { slug: 'digitalocean', name: 'DigitalOcean', domain: 'digitalocean.com' },
  { slug: 'tigerbeetle', name: 'TigerBeetle', domain: 'tigerbeetle.com', batch: 'W21' },
  // Analytics / UX research (new)
  { slug: 'statsig', name: 'Statsig', domain: 'statsig.com', batch: 'S21' },
  { slug: 'sprig', name: 'Sprig', domain: 'sprig.com', batch: 'S18' },
  { slug: 'maze', name: 'Maze', domain: 'maze.co' },
  { slug: 'dovetail', name: 'Dovetail', domain: 'dovetailapp.com' },
  { slug: 'canny', name: 'Canny', domain: 'canny.io', batch: 'S17' },
  { slug: 'productboard', name: 'Productboard', domain: 'productboard.com' },
  // Health (new)
  { slug: 'spring-health', name: 'Spring Health', domain: 'springhealth.com' },
  { slug: 'hinge-health', name: 'Hinge Health', domain: 'hingehealth.com' },
  { slug: 'headway', name: 'Headway', domain: 'headway.co' },
  { slug: 'oura', name: 'Oura', domain: 'ouraring.com' },
  { slug: 'whoop', name: 'WHOOP', domain: 'whoop.com' },
  // Fintech (new)
  { slug: 'nerdwallet', name: 'NerdWallet', domain: 'nerdwallet.com' },
  { slug: 'sofi', name: 'SoFi', domain: 'sofi.com' },
  { slug: 'wise', name: 'Wise', domain: 'wise.com' },
  { slug: 'revolut', name: 'Revolut', domain: 'revolut.com' },
  { slug: 'nubank', name: 'Nubank', domain: 'nubank.com.br' },
  // Creator / consumer (new)
  { slug: 'substack', name: 'Substack', domain: 'substack.com', batch: 'W17' },
  { slug: 'patreon', name: 'Patreon', domain: 'patreon.com' },
  { slug: 'gumroad', name: 'Gumroad', domain: 'gumroad.com', batch: 'W11' },
  { slug: 'strava', name: 'Strava', domain: 'strava.com' },
  { slug: 'onesignal', name: 'OneSignal', domain: 'onesignal.com', batch: 'W11' },
  // AI / ML (new wave)
  { slug: 'langchain', name: 'LangChain', domain: 'langchain.com' },
  { slug: 'llamaindex', name: 'LlamaIndex', domain: 'llamaindex.ai', batch: 'W24' },
  { slug: 'vectara', name: 'Vectara', domain: 'vectara.com' },
  { slug: 'weaviate', name: 'Weaviate', domain: 'weaviate.io' },
  { slug: 'chroma', name: 'Chroma', domain: 'trychroma.com', batch: 'W23' },
  { slug: 'qdrant', name: 'Qdrant', domain: 'qdrant.tech' },
  { slug: 'zilliz', name: 'Zilliz', domain: 'zilliz.com' },
  { slug: 'humanloop', name: 'Humanloop', domain: 'humanloop.com' },
  { slug: 'helicone', name: 'Helicone', domain: 'helicone.ai', batch: 'W23' },
  { slug: 'braintrust-data', name: 'Braintrust', domain: 'braintrustdata.com', batch: 'W22' },
  { slug: 'letta', name: 'Letta', domain: 'letta.ai', batch: 'S24' },
  { slug: 'portkey', name: 'Portkey', domain: 'portkey.ai', batch: 'W24' },
  { slug: 'exa', name: 'Exa', domain: 'exa.ai', batch: 'S21' },
  { slug: 'comet-ml', name: 'Comet ML', domain: 'comet.com' },
  // No-code / Low-code
  { slug: 'softr', name: 'Softr', domain: 'softr.io' },
  { slug: 'glide', name: 'Glide', domain: 'glideapps.com' },
  { slug: 'bubble', name: 'Bubble', domain: 'bubble.io' },
  { slug: 'adalo', name: 'Adalo', domain: 'adalo.com' },
  { slug: 'rows', name: 'Rows', domain: 'rows.com' },
  { slug: 'tally', name: 'Tally', domain: 'tally.so' },
  { slug: 'fillout', name: 'Fillout', domain: 'fillout.com', batch: 'W23' },
  { slug: 'formsort', name: 'Formsort', domain: 'formsort.com' },
  // Design Systems / Tooling
  { slug: 'supernova', name: 'Supernova', domain: 'supernova.io' },
  { slug: 'backlight', name: 'Backlight', domain: 'backlight.dev' },
  { slug: 'knapsack', name: 'Knapsack', domain: 'knapsack.cloud' },
  { slug: 'specify', name: 'Specify', domain: 'specifyapp.com' },
  { slug: 'locofy', name: 'Locofy', domain: 'locofy.ai' },
  // Developer Experience (new wave)
  { slug: 'depot', name: 'Depot', domain: 'depot.dev', batch: 'W23' },
  { slug: 'flightcontrol', name: 'Flightcontrol', domain: 'flightcontrol.dev', batch: 'W22' },
  { slug: 'zuplo', name: 'Zuplo', domain: 'zuplo.com', batch: 'S22' },
  { slug: 'unkey', name: 'Unkey', domain: 'unkey.dev' },
  { slug: 'permit', name: 'Permit.io', domain: 'permit.io', batch: 'W22' },
  { slug: 'cerbos', name: 'Cerbos', domain: 'cerbos.dev' },
  { slug: 'descope', name: 'Descope', domain: 'descope.com' },
  { slug: 'nango', name: 'Nango', domain: 'nango.dev', batch: 'W23' },
  { slug: 'supertokens', name: 'SuperTokens', domain: 'supertokens.com', batch: 'W21' },
  { slug: 'propelauth', name: 'PropelAuth', domain: 'propelauth.com' },
  { slug: 'inngest', name: 'Inngest', domain: 'inngest.com' },
  { slug: 'trigger', name: 'Trigger.dev', domain: 'trigger.dev' },
  // Climate Tech startups
  { slug: 'pachama', name: 'Pachama', domain: 'pachama.com', batch: 'S19' },
  { slug: 'terraformation', name: 'Terraformation', domain: 'terraformation.com' },
  { slug: 'plan-a', name: 'Plan A', domain: 'plan-a.earth' },
  { slug: 'greenly', name: 'Greenly', domain: 'greenly.earth' },
  { slug: 'watershed', name: 'Watershed', domain: 'watershed.com' },
  { slug: 'lune', name: 'Lune', domain: 'lune.co' },
  // Health Tech startups
  { slug: 'ophelia', name: 'Ophelia', domain: 'ophelia.com', batch: 'W21' },
  { slug: 'done', name: 'Done', domain: 'donefirst.com', batch: 'W20' },
  { slug: 'nourish', name: 'Nourish', domain: 'usenourish.com', batch: 'W22' },
  { slug: 'levels', name: 'Levels Health', domain: 'levelshealth.com' },
  { slug: 'zoe', name: 'ZOE', domain: 'zoe.com' },
  { slug: 'brightside', name: 'Brightside', domain: 'brightside.com' },
  { slug: 'mindbloom', name: 'Mindbloom', domain: 'mindbloom.com' },
  { slug: 'cerebral', name: 'Cerebral', domain: 'cerebral.com' },
  { slug: 'workit-health', name: 'Workit Health', domain: 'workithealth.com' },
  // Fintech startups (modern / YC)
  { slug: 'moderntreasury', name: 'Modern Treasury', domain: 'moderntreasury.com', batch: 'W20' },
  { slug: 'lithic', name: 'Lithic', domain: 'lithic.com', batch: 'W18' },
  { slug: 'increase', name: 'Increase', domain: 'increase.com' },
  { slug: 'column', name: 'Column', domain: 'column.com' },
  { slug: 'unit', name: 'Unit', domain: 'unit.co' },
  { slug: 'routable', name: 'Routable', domain: 'routable.com', batch: 'W18' },
  { slug: 'dots', name: 'Dots', domain: 'dots.dev', batch: 'S21' },
  { slug: 'slope', name: 'Slope', domain: 'slope.so', batch: 'S21' },
  { slug: 'settle', name: 'Settle', domain: 'settle.com' },
  { slug: 'capchase', name: 'Capchase', domain: 'capchase.com' },
  // Emerging productivity / PKM
  { slug: 'readwise', name: 'Readwise', domain: 'readwise.io' },
  { slug: 'otter', name: 'Otter.ai', domain: 'otter.ai' },
  { slug: 'fireflies', name: 'Fireflies.ai', domain: 'fireflies.ai', batch: 'S16' },
  { slug: 'granola', name: 'Granola', domain: 'granola.ai' },
  { slug: 'reflect', name: 'Reflect', domain: 'reflect.app' },
  { slug: 'mem', name: 'Mem', domain: 'mem.ai', batch: 'S20' },
  { slug: 'rewind', name: 'Rewind', domain: 'rewind.ai' },
  { slug: 'podcastle', name: 'Podcastle', domain: 'podcastle.ai' },
  // Infra / Cloud (new wave)
  { slug: 'samsara', name: 'Samsara', domain: 'samsara.com' },
  { slug: 'harness', name: 'Harness', domain: 'harness.io' },
  { slug: 'circleci', name: 'CircleCI', domain: 'circleci.com' },
  { slug: 'xata', name: 'Xata', domain: 'xata.io' },
  { slug: 'convex', name: 'Convex', domain: 'convex.dev' },
  { slug: 'fauna', name: 'Fauna', domain: 'fauna.com' },
  { slug: 'koyeb', name: 'Koyeb', domain: 'koyeb.com' },
  { slug: 'northflank', name: 'Northflank', domain: 'northflank.com' },
  // More YC AI / dev tools
  { slug: 'e2b', name: 'E2B', domain: 'e2b.dev', batch: 'W23' },
  { slug: 'sweep', name: 'Sweep AI', domain: 'sweep.dev', batch: 'W23' },
  { slug: 'stainless', name: 'Stainless', domain: 'stainlessapi.com' },
  { slug: 'speakeasy-api', name: 'Speakeasy', domain: 'speakeasyapi.dev' },
  { slug: 'fern-api', name: 'Fern', domain: 'buildwithfern.com' },
  { slug: 'apihero', name: 'API Hero', domain: 'apihero.run', batch: 'W23' },
  { slug: 'zod', name: 'Zod', domain: 'zod.dev' },
  { slug: 'encore', name: 'Encore', domain: 'encore.dev' },
  { slug: 'sequin', name: 'Sequin', domain: 'sequin.io', batch: 'W22' },
  { slug: 'panora', name: 'Panora', domain: 'panora.dev', batch: 'W24' },
  { slug: 'vessel', name: 'Vessel', domain: 'vessel.dev' },
  // More CRM / GTM
  { slug: 'folk', name: 'Folk', domain: 'folk.app' },
  { slug: 'twenty-crm', name: 'Twenty CRM', domain: 'twenty.com' },
  { slug: 'clay-hq', name: 'Clay', domain: 'clay.com' },
  { slug: 'instantly', name: 'Instantly', domain: 'instantly.ai' },
  { slug: 'lemlist', name: 'Lemlist', domain: 'lemlist.com' },
  { slug: 'smartlead', name: 'Smartlead', domain: 'smartlead.ai' },
  { slug: 'reply-io', name: 'Reply.io', domain: 'reply.io' },
  // Vertical SaaS
  { slug: 'procore', name: 'Procore', domain: 'procore.com' },
  { slug: 'buildertrend', name: 'Buildertrend', domain: 'buildertrend.com' },
  { slug: 'fieldwire', name: 'Fieldwire', domain: 'fieldwire.com' },
  { slug: 'jobber', name: 'Jobber', domain: 'getjobber.com' },
  { slug: 'housecall-pro', name: 'Housecall Pro', domain: 'housecallpro.com' },
  { slug: 'servicetitan', name: 'ServiceTitan', domain: 'servicetitan.com' },
  { slug: 'mindbody', name: 'Mindbody', domain: 'mindbodyonline.com' },
  { slug: 'glofox', name: 'Glofox', domain: 'glofox.com' },
  { slug: 'marina', name: 'Dockmaster', domain: 'dockmaster.com' },
  // E-commerce/Marketplace
  { slug: 'faire', name: 'Faire', domain: 'faire.com' },
  { slug: 'ecwid', name: 'Ecwid', domain: 'ecwid.com' },
  { slug: 'gorgias', name: 'Gorgias', domain: 'gorgias.com' },
  { slug: 'yotpo', name: 'Yotpo', domain: 'yotpo.com' },
  { slug: 'recharge', name: 'Recharge', domain: 'rechargepayments.com' },
  { slug: 'okendo', name: 'Okendo', domain: 'okendo.io' },
  { slug: 'stamped', name: 'Stamped', domain: 'stamped.io' },
  // More climate / sustainability
  { slug: 'patch', name: 'Patch', domain: 'patch.io' },
  { slug: 'carbon-direct', name: 'Carbon Direct', domain: 'carbon-direct.com' },
  { slug: 'south-pole', name: 'South Pole', domain: 'southpole.com' },
  { slug: 'verra', name: 'Verra', domain: 'verra.org' },
  // More health
  { slug: 'hims-hers', name: 'Hims & Hers', domain: 'forhims.com' },
  { slug: 'twenty-twenty-one', name: 'Done Health', domain: 'donefirst.com' },
  { slug: 'ahead-health', name: 'Ahead', domain: 'aheadapp.com' },
  { slug: 'brightline-kids', name: 'Brightline', domain: 'hellobrightline.com' },
  { slug: 'kaia-health', name: 'Kaia Health', domain: 'kaiahealth.com' },
  { slug: 'hinge-health-io', name: 'Hinge Health', domain: 'hingehealth.com' },
  // Legal / Compliance
  { slug: 'gavel', name: 'Gavel', domain: 'gavel.io', batch: 'W20' },
  { slug: 'openlaw', name: 'OpenLaw', domain: 'openlaw.io' },
  { slug: 'clerky', name: 'Clerky', domain: 'clerky.com' },
  { slug: 'bonterms', name: 'Bonterms', domain: 'bonterms.com' },
  // Migrated from Lever
  { slug: 'buffer', name: 'Buffer', domain: 'buffer.com' },
  { slug: 'clickup', name: 'ClickUp', domain: 'clickup.com' },
  { slug: 'clubhouse', name: 'Clubhouse', domain: 'clubhouse.com' },
  { slug: 'dave', name: 'Dave', domain: 'dave.com' },
  { slug: 'doji', name: 'Doji', domain: 'doji.art' },
  { slug: 'finch', name: 'Finch', domain: 'finchcare.com' },
  { slug: 'ghost', name: 'Ghost', domain: 'ghost.org' },
  { slug: 'helpscout', name: 'Help Scout', domain: 'helpscout.com' },
  { slug: 'jitter', name: 'Jitter', domain: 'jitter.video' },
  { slug: 'mercor', name: 'Mercor', domain: 'mercor.com', batch: 'S22' },
  { slug: 'navattic', name: 'Navattic', domain: 'navattic.com' },
  { slug: 'noise-labs', name: 'Noise Labs', domain: 'noise.xyz' },
  { slug: 'overflow', name: 'Overflow', domain: 'overflow.io' },
  { slug: 'partiful', name: 'Partiful', domain: 'partiful.com' },
  { slug: 'planhat', name: 'Planhat', domain: 'planhat.com' },
  { slug: 'sunsama', name: 'Sunsama', domain: 'sunsama.com' },
  // More consumer apps
  { slug: 'artifact-news', name: 'Artifact', domain: 'artifact.news' },
  { slug: 'snipd', name: 'Snipd', domain: 'snipd.com' },
  { slug: 'podcastle', name: 'Podcastle', domain: 'podcastle.ai' },
  { slug: 'otter-ai', name: 'Otter.ai', domain: 'otter.ai' },
  { slug: 'granola-hq', name: 'Granola', domain: 'granola.ai' },
];

export async function fetchAllAshbyJobs(): Promise<Job[]> {
  // Deduplicate by slug before fetching
  const seen = new Set<string>();
  const unique = ASHBY_COMPANIES.filter(c => {
    if (seen.has(c.slug)) return false;
    seen.add(c.slug);
    return true;
  });
  const results = await Promise.allSettled(
    unique.map(c => fetchAshbyJobs(c.slug, c.name, c.domain, c.batch))
  );
  return results.flatMap(r => (r.status === 'fulfilled' ? r.value : []));
}
