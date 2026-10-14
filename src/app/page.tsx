import { redirect } from 'next/navigation';

// Coaches land on their plans. (Admins reach drill review from the header.)
export default function Home() {
  redirect('/plans');
}
