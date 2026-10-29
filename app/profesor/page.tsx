import {pool} from '@/lib/db';
import {getCurrentUser} from '@/lib/auth';
import {redirect} from 'next/navigation';
import {listTeacherSessions,sessionFiltersSchema} from '@/lib/cases/v2/teacher-session-list';
import LogoutButton from './LogoutButton';
export default async function ProfessorPage({searchParams}:{searchParams:Record<string,string|string[]|undefined>}){
 const user=await getCurrentUser();if(!user)redirect('/login');if(!['teacher','admin'].includes(user.role))redirect('/chat');
 const parsed=sessionFiltersSchema.safeParse({student:searchParams.student??'',case:searchParams.case??'',review:searchParams.review??'ALL'});
 if(!parsed.success)return <main><h1>Revisa los filtros</h1><a href="/profesor">Limpiar filtros</a></main>;
 const f=parsed.data,rows=await listTeacherSessions(pool,String(user.id),f);
 return <main style={{maxWidth:1100,margin:'32px auto',padding:24}}><h1>Sesiones y revisión docente</h1><p>Solo sesiones académicas de tus casos; las conversaciones de previsualización no se incluyen. Últimas 100 coincidencias.</p><p><a href="/profesor/casos">Editor de casos</a></p><LogoutButton/>
 <form style={{display:'flex',gap:16,flexWrap:'wrap',margin:'24px 0'}}><label>Estudiante (nombre o correo)<input name="student" defaultValue={f.student}/></label><label>Caso<input name="case" defaultValue={f.case}/></label><label>Revisión<select name="review" defaultValue={f.review}><option value="ALL">Todas</option><option value="PENDING">Sin revisión registrada</option><option value="RECORDED">Con revisiones registradas</option></select></label><button>Filtrar</button></form>
 <p>Una revisión registrada no implica liberación vigente ni aprobación académica; el detalle comprueba la composición actual.</p>
 <table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th>Estudiante</th><th>Caso / versión</th><th>Entrevista</th><th>Revisión</th><th>Acción</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.student_name}<br/>{r.email}</td><td>{r.title}<br/><small>{r.case_version_id}</small></td><td>{r.status==='finished'?'Finalizada':'En curso'}</td><td>{r.review_revision?`Revisión ${r.review_revision}`:'Sin revisión'}</td><td><a href={`/profesor/resultados/${r.id}`}>Revisar sesión</a></td></tr>)}</tbody></table>{!rows.length&&<p>No hay sesiones con estos filtros.</p>}</main>;
}
