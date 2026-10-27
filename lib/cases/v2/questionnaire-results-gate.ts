import {pool} from '@/lib/db';
/** Native cases await the explicit M9 results release policy, including after questionnaire submission. */
export async function questionnaireResultsHeld(actor:unknown,sessionId:string){return (await pool.query("SELECT 1 FROM sessions s JOIN case_versions v ON v.id=s.case_version_id WHERE s.id=$1 AND s.user_id=$2 AND v.content_format='TEACHER_CASE_BUNDLE_V1'",[sessionId,actor])).rowCount!==0;}
