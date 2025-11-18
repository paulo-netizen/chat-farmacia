import ChatClient from './ChatClient';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function ChatPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  return <ChatClient />;
}
