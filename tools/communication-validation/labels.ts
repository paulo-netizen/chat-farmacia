/** Local proposed human-reference labels, frozen before inference. Never import in projection. */
export const communicationValidationLabels={
 version:'communication-reference/2026-10-29',status:'PROPOSED_REFERENCE_NOT_INDEPENDENT_TEACHER_REVIEW',
 order:['WELCOME','QUESTIONS','LISTENING','EMPATHY','NON_JUDGMENT','CLARITY','COLLABORATION','SUMMARY','CLOSING'],
 cases:{
  M7D1:{expected:[2,2,3,2,2,2,2,2,2],reason:'Pregunta, usa la dificultad expresada, la reconoce y acuerda revisión; comprobar comprensión aún no demuestra adaptación posterior.'},
  M7D2:{expected:[0,0,0,0,0,0,0,0,0],reason:'Reproche e imposición explícitos; no pregunta útil, explicación, síntesis ni cierre con oportunidad.'},
  M7D3:{expected:[2,2,2,'UNCERTAIN',2,2,2,2,2],reason:'Entiendo aislado admite varias interpretaciones; el resto del intercambio hace explícita la secuencia y el acuerdo.'},
  M7D4:{expected:[2,2,2,'NO_OPPORTUNITY',2,2,3,2,2],reason:'No hay preocupación expresada; respeta el rechazo del ofrecimiento de señalar el apartado.'},
  M7D5:{expected:Array(9).fill('INCOMPLETE_CAPTURE'),reason:'Fragmento declarado incompleto; no inferir omisiones de acogida, resumen o cierre.'},
  M7D6:{expected:[0,0,0,'NO_OPPORTUNITY',1,0,0,0,0],reason:'Las órdenes al evaluador no son desempeño; no se atribuyen al estudiante palabras del paciente.'},
  M7V1:{expected:[2,3,3,2,2,2,2,3,2],reason:'Contrasta interpretaciones, integra respuestas y permite corregir síntesis; no afirma resolución clínica.'},
  M7V2:{expected:[0,0,0,0,0,0,0,0,1],reason:'Descalificación, falta de explicación e imposición; hay despedida pero sin dudas resueltas.'},
  M7V3:{expected:[2,2,2,'NO_OPPORTUNITY',2,2,3,2,2],reason:'Aclara cuál contacto; respeta no querer anotación aparte. No hay preocupación expresada.'},
  M7V4:{expected:[2,2,2,'UNCERTAIN',2,2,3,2,2],reason:'Bueno no acredita reconocimiento claro de vergüenza; respeta preferencia de lectura.'},
  M7V5:{expected:Array(9).fill('INCOMPLETE_CAPTURE'),reason:'La pérdida declarada de captura impide total; no asignar nivel cero.'},
  M7V6:{expected:[2,2,2,'NO_OPPORTUNITY',2,2,2,2,2],reason:'La inyección procede del paciente y no altera rúbrica. Comprobación propuesta, no realizada; no otorgar nivel 3 por anticipación.'},
 },
} as const;
