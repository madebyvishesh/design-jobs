import type { Job, AtsSource } from '@/types/job';
import { isAIFromCurated } from './curatedAI';

interface LeverJob {
  id: string;
  text: string;
  categories?: {
    department?: string;
    location?: string;
    team?: string;
    commitment?: string;
  };
  hostedUrl?: string;
  createdAt?: number;
}

async function fetchLeverJobs(slug: string, name: string, domain: string, batch?: string): Promise<Job[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`https://api.lever.co/v0/postings/${slug}?mode=json`, {
      signal: controller.signal,
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json() as LeverJob[];
    return data.map(job => {
      const loc = job.categories?.location ?? '';
      return {
        id: `lever-${slug}-${job.id}`,
        title: job.text,
        company: name,
        companyDomain: domain,
        location: loc,
        isRemote: loc.toLowerCase().includes('remote'),
        url: job.hostedUrl ?? `https://jobs.lever.co/${slug}/${job.id}`,
        postedAt: job.createdAt ? new Date(job.createdAt).toISOString() : new Date(0).toISOString(),
        department: job.categories?.department ?? job.categories?.team ?? '',
        ats: 'lever' as AtsSource,
        sources: ['lever' as AtsSource],
        isAI: isAIFromCurated(name),
        batch,
      };
    });
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

const LEVER_COMPANIES: Array<{ slug: string; name: string; domain: string; batch?: string }> = [
  // Design tools / Creative
  { slug: 'abstract', name: 'Abstract', domain: 'abstract.com' },
  { slug: 'invision', name: 'InVision', domain: 'invisionapp.com' },
  { slug: 'miro', name: 'Miro', domain: 'miro.com' },
  { slug: 'loom', name: 'Loom', domain: 'loom.com' },
  { slug: 'pitch', name: 'Pitch', domain: 'pitch.com' },
  // AI / Tech
  { slug: 'runway-ml', name: 'Runway', domain: 'runwayml.com' },
  { slug: 'synthesia', name: 'Synthesia', domain: 'synthesia.io' },
  { slug: 'doji', name: 'Doji', domain: 'doji.art' },
  { slug: 'typeface', name: 'Typeface', domain: 'typeface.ai' },
  { slug: 'noise-labs', name: 'Noise Labs', domain: 'noise.xyz' },
  { slug: 'sierra-ai', name: 'Sierra AI', domain: 'sierra.ai' },
  // B2B SaaS
  { slug: 'intercom', name: 'Intercom', domain: 'intercom.com', batch: 'S11' },
  { slug: 'contentful', name: 'Contentful', domain: 'contentful.com' },
  { slug: 'fivetran', name: 'Fivetran', domain: 'fivetran.com' },
  { slug: 'logrocket', name: 'LogRocket', domain: 'logrocket.com', batch: 'W17' },
  { slug: 'amplitude', name: 'Amplitude', domain: 'amplitude.com' },
  { slug: 'sigma', name: 'Sigma Computing', domain: 'sigmacomputing.com', batch: 'S17' },
  { slug: 'cresta', name: 'Cresta', domain: 'cresta.com', batch: 'S18' },
  { slug: 'gong', name: 'Gong', domain: 'gong.io' },
  { slug: 'hightouch', name: 'Hightouch', domain: 'hightouch.com' },
  { slug: 'brainco', name: 'Brainco', domain: 'brainco.com' },
  { slug: 'kaizen-gaming', name: 'Kaizen Gaming', domain: 'kaizengaming.com' },
  { slug: 'browserbase', name: 'Browserbase', domain: 'browserbase.com', batch: 'W24' },
  { slug: 'instrumentl', name: 'Instrumentl', domain: 'instrumentl.com' },
  { slug: 'infisical', name: 'Infisical', domain: 'infisical.com' },
  { slug: 'merge', name: 'Merge', domain: 'merge.dev' },
  { slug: 'stytch', name: 'Stytch', domain: 'stytch.com' },
  { slug: 'socket', name: 'Socket', domain: 'socket.dev' },
  // Consumer
  { slug: 'glossgenius', name: 'GlossGenius', domain: 'glossgenius.com', batch: 'W17' },
  { slug: 'bolt', name: 'Bolt', domain: 'bolt.com', batch: 'S16' },
  { slug: 'flutterflow', name: 'FlutterFlow', domain: 'flutterflow.io', batch: 'W20' },
  { slug: 'mercor', name: 'Mercor', domain: 'mercor.com', batch: 'S22' },
  { slug: 'railway', name: 'Railway', domain: 'railway.app' },
  { slug: 'semgrep', name: 'Semgrep', domain: 'semgrep.dev' },
  { slug: 'rippling', name: 'Rippling', domain: 'rippling.com' },
  { slug: 'revel', name: 'Revel', domain: 'revel.xyz' },
  { slug: 'vogo', name: 'Vogo', domain: 'vogo.fr' },
  { slug: 'tessera', name: 'Tessera Labs', domain: 'tessera.io' },
  // Productivity
  { slug: 'coda', name: 'Coda', domain: 'coda.io' },
  { slug: 'notion', name: 'Notion', domain: 'notion.so' },
  { slug: 'craft', name: 'Craft', domain: 'craft.do' },
  { slug: 'linear', name: 'Linear', domain: 'linear.app' },
  { slug: 'height', name: 'Height', domain: 'height.app' },
  { slug: 'retool', name: 'Retool', domain: 'retool.com' },
  { slug: 'webflow', name: 'Webflow', domain: 'webflow.com' },
  // Health / Education
  { slug: 'duolingo', name: 'Duolingo', domain: 'duolingo.com' },
  { slug: 'calm', name: 'Calm', domain: 'calm.com' },
  { slug: 'headspace', name: 'Headspace', domain: 'headspace.com' },
  // E-commerce
  { slug: 'faire', name: 'Faire', domain: 'faire.com' },
  { slug: 'packhelp', name: 'Packhelp', domain: 'packhelp.com' },
  // Design tools (new)
  { slug: 'typeform', name: 'Typeform', domain: 'typeform.com' },
  { slug: 'sketch', name: 'Sketch', domain: 'sketch.com' },
  { slug: 'overflow', name: 'Overflow', domain: 'overflow.io' },
  { slug: 'protopie', name: 'ProtoPie', domain: 'protopie.io' },
  { slug: 'uxpin', name: 'UXPin', domain: 'uxpin.com' },
  // B2B SaaS (new)
  { slug: 'front', name: 'Front', domain: 'front.com' },
  { slug: 'helpscout', name: 'Help Scout', domain: 'helpscout.com' },
  { slug: 'freshworks', name: 'Freshworks', domain: 'freshworks.com' },
  { slug: 'wrike', name: 'Wrike', domain: 'wrike.com' },
  { slug: 'clickup', name: 'ClickUp', domain: 'clickup.com' },
  { slug: 'smartsheet', name: 'Smartsheet', domain: 'smartsheet.com' },
  { slug: 'basecamp', name: 'Basecamp', domain: 'basecamp.com' },
  { slug: 'productboard', name: 'Productboard', domain: 'productboard.com' },
  { slug: 'shortcut', name: 'Shortcut', domain: 'shortcut.com' },
  { slug: 'maze', name: 'Maze', domain: 'maze.co' },
  { slug: 'dovetail', name: 'Dovetail', domain: 'dovetailapp.com' },
  // Marketing / Social (new)
  { slug: 'hootsuite', name: 'Hootsuite', domain: 'hootsuite.com' },
  { slug: 'buffer', name: 'Buffer', domain: 'buffer.com' },
  { slug: 'sproutsocial', name: 'Sprout Social', domain: 'sproutsocial.com' },
  { slug: 'later', name: 'Later', domain: 'later.com' },
  { slug: 'attentive', name: 'Attentive', domain: 'attentive.com' },
  // AI / Tech (new)
  { slug: 'jasper', name: 'Jasper', domain: 'jasper.ai' },
  { slug: 'copy-ai', name: 'Copy.ai', domain: 'copy.ai', batch: 'W21' },
  { slug: 'adept', name: 'Adept', domain: 'adept.ai' },
  { slug: 'character-ai', name: 'Character.AI', domain: 'character.ai' },
  { slug: 'poe', name: 'Poe (Quora)', domain: 'poe.com' },
  // Media / Entertainment (new)
  { slug: 'soundcloud', name: 'SoundCloud', domain: 'soundcloud.com' },
  { slug: 'yelp', name: 'Yelp', domain: 'yelp.com' },
  { slug: 'tripadvisor', name: 'Tripadvisor', domain: 'tripadvisor.com' },
  { slug: 'seatgeek', name: 'SeatGeek', domain: 'seatgeek.com' },
  { slug: 'strava', name: 'Strava', domain: 'strava.com' },
  // Finance (new)
  { slug: 'betterment', name: 'Betterment', domain: 'betterment.com' },
  { slug: 'wealthfront', name: 'Wealthfront', domain: 'wealthfront.com' },
  { slug: 'acorns', name: 'Acorns', domain: 'acorns.com' },
  { slug: 'dave', name: 'Dave', domain: 'dave.com' },
  { slug: 'chime', name: 'Chime', domain: 'chime.com', batch: 'S14' },
  { slug: 'nerdwallet', name: 'NerdWallet', domain: 'nerdwallet.com' },
  // Education (new)
  { slug: 'skillshare', name: 'Skillshare', domain: 'skillshare.com' },
  { slug: 'masterclass', name: 'MasterClass', domain: 'masterclass.com' },
  { slug: 'codecademy', name: 'Codecademy', domain: 'codecademy.com' },
  // E-commerce (new)
  { slug: 'depop', name: 'Depop', domain: 'depop.com' },
  { slug: 'vinted', name: 'Vinted', domain: 'vinted.com' },
  { slug: 'poshmark', name: 'Poshmark', domain: 'poshmark.com' },
  // Health / Wellness (new)
  { slug: 'eight-sleep', name: 'Eight Sleep', domain: 'eightsleep.com' },
  { slug: 'noom', name: 'Noom', domain: 'noom.com' },
  { slug: 'oura', name: 'Oura Ring', domain: 'ouraring.com' },
  // B2B SaaS / Customer Success
  { slug: 'pendo', name: 'Pendo', domain: 'pendo.io' },
  { slug: 'appcues', name: 'Appcues', domain: 'appcues.com' },
  { slug: 'chameleon', name: 'Chameleon', domain: 'chameleon.io' },
  { slug: 'totango', name: 'Totango', domain: 'totango.com' },
  { slug: 'gainsight', name: 'Gainsight', domain: 'gainsight.com' },
  { slug: 'churnzero', name: 'ChurnZero', domain: 'churnzero.com' },
  { slug: 'vitally', name: 'Vitally', domain: 'vitally.io' },
  { slug: 'planhat', name: 'Planhat', domain: 'planhat.com' },
  { slug: 'userflow', name: 'Userflow', domain: 'userflow.com' },
  { slug: 'commandbar', name: 'CommandBar', domain: 'commandbar.com' },
  { slug: 'navattic', name: 'Navattic', domain: 'navattic.com' },
  { slug: 'storylane', name: 'Storylane', domain: 'storylane.io' },
  { slug: 'arcade-software', name: 'Arcade', domain: 'arcade.software' },
  { slug: 'walnut', name: 'Walnut', domain: 'walnut.io' },
  { slug: 'trumpet', name: 'Trumpet', domain: 'trumpet.so' },
  // Marketing Platforms
  { slug: 'sendbird', name: 'Sendbird', domain: 'sendbird.com' },
  { slug: 'airship', name: 'Airship', domain: 'airship.com' },
  { slug: 'mouseflow', name: 'Mouseflow', domain: 'mouseflow.com' },
  { slug: 'optimizely', name: 'Optimizely', domain: 'optimizely.com' },
  { slug: 'ab-tasty', name: 'AB Tasty', domain: 'abtasty.com' },
  { slug: 'unbounce', name: 'Unbounce', domain: 'unbounce.com' },
  { slug: 'leadpages', name: 'Leadpages', domain: 'leadpages.com' },
  // Design / Animation Tools
  { slug: 'marvel', name: 'Marvel', domain: 'marvelapp.com' },
  { slug: 'spline', name: 'Spline', domain: 'spline.design' },
  { slug: 'jitter', name: 'Jitter', domain: 'jitter.video' },
  { slug: 'penpot', name: 'Penpot', domain: 'penpot.app' },
  { slug: 'phase', name: 'Phase', domain: 'phase.com' },
  { slug: 'veed', name: 'VEED', domain: 'veed.io' },
  { slug: 'kapwing', name: 'Kapwing', domain: 'kapwing.com' },
  { slug: 'invideo', name: 'InVideo', domain: 'invideo.io' },
  { slug: 'animaker', name: 'Animaker', domain: 'animaker.com' },
  { slug: 'vyond', name: 'Vyond', domain: 'vyond.com' },
  { slug: 'wondershare', name: 'Wondershare', domain: 'wondershare.com' },
  // Publishing / Content
  { slug: 'ghost', name: 'Ghost', domain: 'ghost.org' },
  { slug: 'readymag', name: 'Readymag', domain: 'readymag.com' },
  { slug: 'cargo', name: 'Cargo', domain: 'cargo.site' },
  { slug: 'polywork', name: 'Polywork', domain: 'polywork.com' },
  { slug: 'axios', name: 'Axios', domain: 'axios.com' },
  { slug: 'morningbrew', name: 'Morning Brew', domain: 'morningbrew.com' },
  { slug: 'theatlantic', name: 'The Atlantic', domain: 'theatlantic.com' },
  { slug: 'buzzfeed', name: 'BuzzFeed', domain: 'buzzfeed.com' },
  { slug: 'voxmedia', name: 'Vox Media', domain: 'voxmedia.com' },
  // Education (new wave)
  { slug: 'scrimba', name: 'Scrimba', domain: 'scrimba.com' },
  { slug: 'egghead', name: 'Egghead', domain: 'egghead.io' },
  { slug: 'frontendmasters', name: 'Frontend Masters', domain: 'frontendmasters.com' },
  { slug: 'treehouse', name: 'Treehouse', domain: 'teamtreehouse.com' },
  { slug: 'educative', name: 'Educative', domain: 'educative.io' },
  { slug: 'oreilly', name: "O'Reilly Media", domain: 'oreilly.com' },
  { slug: 'udacity', name: 'Udacity', domain: 'udacity.com' },
  { slug: 'springboard', name: 'Springboard', domain: 'springboard.com' },
  // Consumer / Social Apps
  { slug: 'clubhouse', name: 'Clubhouse', domain: 'clubhouse.com' },
  { slug: 'partiful', name: 'Partiful', domain: 'partiful.com' },
  { slug: 'locket', name: 'Locket', domain: 'locketwidget.com' },
  { slug: 'finch', name: 'Finch', domain: 'finchcare.com' },
  { slug: 'woebot', name: 'Woebot', domain: 'woebothealth.com' },
  { slug: 'happify', name: 'Happify Health', domain: 'happify.com' },
  // Productivity / Calendar
  { slug: 'taskade', name: 'Taskade', domain: 'taskade.com' },
  { slug: 'todoist', name: 'Todoist (Doist)', domain: 'todoist.com' },
  { slug: 'sunsama', name: 'Sunsama', domain: 'sunsama.com' },
  { slug: 'reclaim', name: 'Reclaim.ai', domain: 'reclaim.ai' },
  { slug: 'motion', name: 'Motion', domain: 'usemotion.com' },
  { slug: 'savvycal', name: 'SavvyCal', domain: 'savvycal.com' },
  { slug: 'teamwork', name: 'Teamwork', domain: 'teamwork.com' },
  { slug: 'meistertask', name: 'MeisterTask', domain: 'meistertask.com' },
  // Developer / Infra SaaS
  { slug: 'xata', name: 'Xata', domain: 'xata.io' },
  { slug: 'convex', name: 'Convex', domain: 'convex.dev' },
  { slug: 'kinsta', name: 'Kinsta', domain: 'kinsta.com' },
  { slug: 'wpengine', name: 'WP Engine', domain: 'wpengine.com' },
  { slug: 'novu', name: 'Novu', domain: 'novu.co' },
  { slug: 'courier', name: 'Courier', domain: 'courier.com' },
  { slug: 'ably', name: 'Ably', domain: 'ably.com' },
  { slug: 'livekit', name: 'LiveKit', domain: 'livekit.io' },
  // Fintech
  { slug: 'ethos', name: 'Ethos Life', domain: 'ethoslife.com' },
  { slug: 'policygenius', name: 'PolicyGenius', domain: 'policygenius.com' },
  { slug: 'clearcover', name: 'Clearcover', domain: 'clearcover.com' },
  { slug: 'metromile', name: 'Metromile', domain: 'metromile.com' },
  { slug: 'albert', name: 'Albert', domain: 'albert.com' },
  { slug: 'cleo', name: 'Cleo', domain: 'meetcleo.com' },
  { slug: 'step', name: 'Step', domain: 'step.com' },
  { slug: 'current', name: 'Current', domain: 'current.com' },
  // PropTech / Real Estate
  { slug: 'zillow', name: 'Zillow', domain: 'zillow.com' },
  { slug: 'opendoor', name: 'Opendoor', domain: 'opendoor.com' },
  { slug: 'homelight', name: 'HomeLight', domain: 'homelight.com' },
  { slug: 'vacasa', name: 'Vacasa', domain: 'vacasa.com' },
  { slug: 'sonder', name: 'Sonder', domain: 'sonder.com' },
  // Travel / Transport
  { slug: 'turo', name: 'Turo', domain: 'turo.com' },
  { slug: 'getaround', name: 'Getaround', domain: 'getaround.com' },
  { slug: 'omio', name: 'Omio', domain: 'omio.com' },
  { slug: 'flixbus', name: 'FlixBus', domain: 'flixbus.com' },
  // Logistics
  { slug: 'shippo', name: 'Shippo', domain: 'goshippo.com' },
  { slug: 'shipbob', name: 'ShipBob', domain: 'shipbob.com' },
  { slug: 'narvar', name: 'Narvar', domain: 'narvar.com' },
  { slug: 'loopcommerce', name: 'Loop Returns', domain: 'loopreturns.com' },
  // AI Tools
  { slug: 'jasper', name: 'Jasper', domain: 'jasper.ai' },
  { slug: 'character-ai', name: 'Character.AI', domain: 'character.ai' },
  { slug: 'perplexity', name: 'Perplexity AI', domain: 'perplexity.ai' },
  { slug: 'langchain', name: 'LangChain', domain: 'langchain.com' },
  { slug: 'humanloop', name: 'Humanloop', domain: 'humanloop.com' },
  { slug: 'helicone', name: 'Helicone', domain: 'helicone.ai' },
  // More B2B SaaS
  { slug: 'qualtrics', name: 'Qualtrics', domain: 'qualtrics.com' },
  { slug: 'medallia', name: 'Medallia', domain: 'medallia.com' },
  { slug: 'surveymonkey', name: 'SurveyMonkey', domain: 'surveymonkey.com' },
  { slug: 'delighted', name: 'Delighted', domain: 'delighted.com' },
  { slug: 'nicereply', name: 'Nicereply', domain: 'nicereply.com' },
  { slug: 'pipedrive', name: 'Pipedrive', domain: 'pipedrive.com' },
  { slug: 'copper', name: 'Copper CRM', domain: 'copper.com' },
  { slug: 'gainsight', name: 'Gainsight', domain: 'gainsight.com' },
  { slug: 'domo', name: 'Domo', domain: 'domo.com' },
  { slug: 'mode', name: 'Mode Analytics', domain: 'mode.com' },
  // Vertical SaaS
  { slug: 'procore', name: 'Procore', domain: 'procore.com' },
  { slug: 'jobber', name: 'Jobber', domain: 'getjobber.com' },
  { slug: 'housecall-pro', name: 'Housecall Pro', domain: 'housecallpro.com' },
  { slug: 'servicetitan', name: 'ServiceTitan', domain: 'servicetitan.com' },
  { slug: 'mindbody', name: 'Mindbody', domain: 'mindbodyonline.com' },
  // Commerce
  { slug: 'gorgias', name: 'Gorgias', domain: 'gorgias.com' },
  { slug: 'yotpo', name: 'Yotpo', domain: 'yotpo.com' },
  { slug: 'recharge', name: 'Recharge', domain: 'rechargepayments.com' },
  { slug: 'bigcommerce', name: 'BigCommerce', domain: 'bigcommerce.com' },
  { slug: 'commercetools', name: 'commercetools', domain: 'commercetools.com' },
  // HR Tech
  { slug: 'gem', name: 'Gem', domain: 'gem.com' },
  { slug: 'paradox', name: 'Paradox', domain: 'paradox.ai' },
  { slug: 'beamery', name: 'Beamery', domain: 'beamery.com' },
  { slug: 'eightfold', name: 'Eightfold AI', domain: 'eightfold.ai' },
  // Testing / Dev
  { slug: 'browserstack', name: 'BrowserStack', domain: 'browserstack.com' },
  { slug: 'lambdatest', name: 'LambdaTest', domain: 'lambdatest.com' },
  { slug: 'applitools', name: 'Applitools', domain: 'applitools.com' },
  // Finance
  { slug: 'adyen', name: 'Adyen', domain: 'adyen.com' },
  { slug: 'gocardless', name: 'GoCardless', domain: 'gocardless.com' },
  { slug: 'airwallex', name: 'Airwallex', domain: 'airwallex.com' },
  { slug: 'goodrx', name: 'GoodRx', domain: 'goodrx.com' },
  { slug: 'ladder', name: 'Ladder Life', domain: 'ladderlife.com' },
  // Media (more)
  { slug: 'medium', name: 'Medium', domain: 'medium.com' },
  { slug: 'complex-networks', name: 'Complex Networks', domain: 'complex.com' },
  { slug: 'the-athletic', name: 'The Athletic', domain: 'theathletic.com' },
  { slug: 'quartz', name: 'Quartz', domain: 'qz.com' },
  // Productivity extras
  { slug: 'akiflow', name: 'Akiflow', domain: 'akiflow.com' },
  { slug: 'ticktick', name: 'TickTick', domain: 'ticktick.com' },
  { slug: 'nifty', name: 'Nifty PM', domain: 'niftypm.com' },
  { slug: 'proofhub', name: 'ProofHub', domain: 'proofhub.com' },
  // Robotics / Deep Tech
  { slug: 'anduril', name: 'Anduril', domain: 'anduril.com' },
  { slug: 'shield-ai', name: 'Shield AI', domain: 'shield.ai' },
  { slug: 'agility-robotics', name: 'Agility Robotics', domain: 'agilityrobotics.com' },
  { slug: 'rivian', name: 'Rivian', domain: 'rivian.com' },
  { slug: 'lucidmotors', name: 'Lucid Motors', domain: 'lucidmotors.com' },
];

export async function fetchAllLeverJobs(): Promise<Job[]> {
  const seen = new Set<string>();
  const unique = LEVER_COMPANIES.filter(c => {
    if (seen.has(c.slug)) return false;
    seen.add(c.slug);
    return true;
  });
  const results = await Promise.allSettled(
    unique.map(c => fetchLeverJobs(c.slug, c.name, c.domain, c.batch))
  );
  return results.flatMap(r => (r.status === 'fulfilled' ? r.value : []));
}
