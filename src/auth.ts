import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublicKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

// Never place a Supabase service-role/secret key in the browser or a VITE_ variable.
// When unconfigured, the account UI is a safe preview: no information is sent.
export const supabase = supabaseUrl && supabasePublicKey
  ? createClient(supabaseUrl, supabasePublicKey, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
    })
  : null;

export type LearnerVerification = 'not_submitted' | 'pending' | 'verified' | 'rejected';

export const friendlyVerificationStatus: Record<LearnerVerification, string> = {
  not_submitted: 'Licence check not submitted',
  pending: 'Licence check under review',
  verified: 'Licence verified',
  rejected: 'Further verification needed'
};
