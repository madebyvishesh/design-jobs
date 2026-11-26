import type { Job } from '../../types/job';
import { collectBoards, type BoardReport } from '../boardFetch';
import { fetchEmployerListings } from './employerSitemap';

export interface WorkdayCompany {
  tenant: string;
  dc: string;     // data-center subdomain, e.g. 'wd1', 'wd5', 'wd12'
  site: string;   // career-site path
  name: string;
  domain: string;
}

const WORKDAY_COMPANIES: WorkdayCompany[] = [
  { tenant: 'nvidia', dc: 'wd5', site: 'NVIDIAExternalCareerSite', name: 'NVIDIA', domain: 'nvidia.com' },
  { tenant: 'adobe', dc: 'wd5', site: 'external_experienced', name: 'Adobe', domain: 'adobe.com' },
  { tenant: 'autodesk', dc: 'wd1', site: 'Ext', name: 'Autodesk', domain: 'autodesk.com' },
  { tenant: 'salesforce', dc: 'wd12', site: 'External_Career_Site', name: 'Salesforce', domain: 'salesforce.com' },
  { tenant: 'paypal', dc: 'wd1', site: 'jobs', name: 'PayPal', domain: 'paypal.com' },
  { tenant: 'workday', dc: 'wd5', site: 'Workday', name: 'Workday', domain: 'workday.com' },
  { tenant: 'mastercard', dc: 'wd1', site: 'CorporateCareers', name: 'Mastercard', domain: 'mastercard.com' },
  { tenant: 'hp', dc: 'wd5', site: 'ExternalCareerSite', name: 'HP', domain: 'hp.com' },
  { tenant: 'hpe', dc: 'wd5', site: 'Jobsathpe', name: 'Hewlett Packard Enterprise', domain: 'hpe.com' },
  { tenant: 'target', dc: 'wd5', site: 'targetcareers', name: 'Target', domain: 'target.com' },
  { tenant: 'comcast', dc: 'wd115', site: 'Comcast_Careers', name: 'Comcast', domain: 'comcast.com' },
  { tenant: 'warnerbros', dc: 'wd5', site: 'global', name: 'Warner Bros. Discovery', domain: 'wbd.com' },
  { tenant: 'zillow', dc: 'wd5', site: 'Zillow_Group_External', name: 'Zillow', domain: 'zillow.com' },
  { tenant: 'gilead', dc: 'wd1', site: 'gileadcareers', name: 'Gilead Sciences', domain: 'gilead.com' },
  { tenant: 'blackrock', dc: 'wd1', site: 'BlackRock_Professional', name: 'BlackRock', domain: 'blackrock.com' },
  { tenant: 'capitalone', dc: 'wd12', site: 'Capital_One', name: 'Capital One', domain: 'capitalone.com' },
  { tenant: 'cisco', dc: 'wd5', site: 'cisco_careers', name: 'Cisco', domain: 'cisco.com' },
  { tenant: 'cvshealth', dc: 'wd1', site: 'CVS_Health_Careers', name: 'CVS Health', domain: 'cvshealth.com' },
];

export function fetchAllWorkdayJobs(report: BoardReport[] = [], previous: Job[] = []) {
  return collectBoards('workday', WORKDAY_COMPANIES, c => ({ board: c.tenant, domain: c.domain }),
    company => fetchEmployerListings(company, previous.filter(job => job.boardKey === 'workday:' + company.tenant)), report, 4);
}
