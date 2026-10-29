import 'server-only';
import {z} from 'zod';
import type {Pool} from 'pg';
import {QuestionnaireError} from './session-questionnaire-store';
export const sessionFiltersSchema=z.object({student:z.string().trim().max(100).default(''),case:z.string().trim().max(100).default(''),review:z.enum(['ALL','PENDING','RECORDED']).default('ALL')}).strict();
export async function listTeacherSessions(db:Pick<Pool,'query'>,actor:string,filters:unknown){
 const f=sessionFiltersSchema.parse(filters);
 if(!/^[1-9][0-9]{0,15}$/.test(actor))throw new QuestionnaireError('FORBIDDEN',403);
 const role=(await db.query('SELECT role FROM users WHERE id=$1',[actor])).rows[0]?.role;
 if(!['teacher','admin'].includes(role))throw new QuestionnaireError('FORBIDDEN',403);
 return (await db.query(`SELECT s.id,s.case_version_id,s.status,s.started_at,s.finished_at,u.name student_name,u.email,c.title,
 coalesce(h.revision,0) review_revision FROM sessions s JOIN users u ON u.id=s.user_id JOIN cases c ON c.id=s.case_id
 LEFT JOIN LATERAL(SELECT max(revision) revision FROM session_result_reviews WHERE session_id=s.id) h ON true
 WHERE u.role='student' AND ($2::boolean OR c.created_by=$1) AND s.case_version_id IS NOT NULL
 AND (strpos(lower(u.name||' '||u.email),lower($3))>0) AND strpos(lower(c.title),lower($4))>0
 AND ($5='ALL' OR ($5='PENDING' AND h.revision IS NULL) OR ($5='RECORDED' AND h.revision IS NOT NULL))
 ORDER BY s.started_at DESC,s.id LIMIT 100`,[actor,role==='admin',f.student,f.case,f.review])).rows;
}
