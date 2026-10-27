import {getCurrentUser} from '@/lib/auth';
import {redirect} from 'next/navigation';
import QuestionnaireClient from './QuestionnaireClient';
export default async function QuestionnairePage({params}:{params:{id:string}}){const user=await getCurrentUser();if(!user)redirect('/login');if(user.role!=='student')redirect('/profesor/casos');return <QuestionnaireClient sessionId={params.id}/>;}
