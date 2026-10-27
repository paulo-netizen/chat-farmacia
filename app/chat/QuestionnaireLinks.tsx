'use client';
import {useEffect,useState} from 'react';
export default function QuestionnaireLinks(){const [rows,setRows]=useState<{sessionId:string;submittedAt:string|null}[]>([]);useEffect(()=>{fetch('/api/questionnaires',{cache:'no-store'}).then(async r=>{if(r.ok)setRows(await r.json());}).catch(()=>{});},[]);return rows.length?<section><h2>Mis cuestionarios</h2><ul>{rows.map((r,i)=><li key={r.sessionId}><a href={`/cuestionario/${r.sessionId}`}>{r.submittedAt?'Consultar entrega':'Continuar cuestionario'} · {i+1}</a></li>)}</ul></section>:null;}
