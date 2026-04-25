import { redirect } from 'next/navigation';

/** /buyer/account → redirect to profile settings */
export default function AccountIndexPage() {
  redirect('/buyer/account/profile');
}
