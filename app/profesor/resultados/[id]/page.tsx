import {getCurrentUser} from '@/lib/auth';
import {redirect} from 'next/navigation';
import ResultsClient from '@/app/resultados/[id]/ResultsClient';
export default async function TeacherResultsPage({params}:{params:{id:string}}){const user=await getCurrentUser();if(!user)redirect('/login');if(!['teacher','admin'].includes(user.role))redirect('/chat');return <ResultsClient sessionId={params.id} teacher/>;}
