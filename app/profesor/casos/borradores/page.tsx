import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import TeacherDraftEditor from './TeacherDraftEditor';
export const dynamic = 'force-dynamic';
export default async function TeacherDraftsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'teacher' && user.role !== 'admin') redirect('/chat');
  return <TeacherDraftEditor />;
}
