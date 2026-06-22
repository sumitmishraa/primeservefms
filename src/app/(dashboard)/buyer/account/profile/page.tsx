import { redirect } from 'next/navigation';

/** Profile Settings has moved into the unified My Details page. */
export default function ProfileRedirect() {
  redirect('/buyer/account/details?tab=profile');
}
