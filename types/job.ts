export type AtsSource = 'ashby' | 'greenhouse' | 'lever' | 'yc' | 'remotive' | 'workday';

export type Job = {
  id: string;
  title: string;
  company: string;
  companyDomain: string;
  logoUrl?: string;
  location: string;
  isRemote: boolean;
  url: string;
  postedAt: string;
  firstSeenAt?: number;
  salary?: string;
  dateKind?: 'posted' | 'updated' | 'created' | 'unknown';
  dateSource?: AtsSource;
  department: string;
  ats: AtsSource;
  sources: AtsSource[];
  isAI: boolean;
  batch?: string;
};
