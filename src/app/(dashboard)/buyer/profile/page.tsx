import { redirect } from 'next/navigation';

/** /buyer/profile → unified account profile experience */
export default function BuyerProfilePage() {
  redirect('/buyer/account/profile');
}
