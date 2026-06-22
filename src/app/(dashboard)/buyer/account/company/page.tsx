import { redirect } from 'next/navigation';

/** Company Details has moved into the unified My Details page. */
export default function CompanyRedirect() {
  redirect('/buyer/account/details?tab=company');
}
