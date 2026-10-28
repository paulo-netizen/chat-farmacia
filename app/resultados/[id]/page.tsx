import {getCurrentUser} from '@/lib/auth';
import {redirect} from 'next/navigation';
import ResultsClient from './ResultsClient';
export default async function ResultsPage({params}:{params:{id:string}}){const user=await getCurrentUser();if(!user)redirect('/login');if(user.role!=='student')redirect('/profesor/casos');return <ResultsClient sessionId={params.id}/>;}
