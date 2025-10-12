export interface Client {
  id: number;
  firstName: string;
  lastName: string;
  jobTitle: string;
  company: string;
  city: string;
  cityStatus?: 'idle' | 'finding' | 'found' | 'not_found' | 'error';
}
