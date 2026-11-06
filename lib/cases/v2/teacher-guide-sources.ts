import 'server-only';
import {createHash} from 'node:crypto';

/** Reviewed, bounded paraphrases, not verbatim pages or whole-guide coverage. */
export const guideCatalog={
 sefac2024:{url:'https://www.sefac.org/system/files/2025-04/GUIA%20IRAS.pdf',name:'SEFAC 2024 — IRA, selección revisada'},
 spfa2026:{url:'urn:chatusal:source:GUIA_SPFA_FORO_2026_V5_DO',name:'Foro AF-FC 2026 — guía aportada por Paulo'},
} as const;
const content={
 sefac2024:{edition:'SEFAC 2024, ISBN 978-84-09-71860-3',pages:'30, 40–41 (numeración impresa; PDF 30, 40–41)',pdfPages:[30,40,41],sha256:'7a044ad1330caee331c194c085d65472e1c7503ee92ba6702e60278acc0a3352',
 text:'Síntesis revisada, no cita literal. P. 41, tabla 11 de criterios comunes: se contempla derivar por comorbilidades de riesgo, incluida diabetes, con o sin descompensación. Distingue alarma respiratoria con envío a urgencias; también considera empeoramiento, dificultad importante al tragar y persistencia mayor de una semana sin tratamiento o más de 72 horas con tratamiento sin mejoría. La tabla no asigna por sí sola urgencia hospitalaria a toda diabetes. P. 40: tras entrevista se valoran derivación y problemas asociados a medicamentos; caben actuaciones no farmacológicas y educación. P. 30: enumera opciones sintomáticas para odinofagia. La ingesta de agua y humidificación se describen en el apartado de tos: no son prueba específica de eficacia de hidratación para una odinofagia aislada. No se aporta una pauta individual de medicamento para Lucía. Alcance limitado: estos pasajes no establecen etiología ni control diabético, ni sustituyen valoración individual. La elección docente de atención primaria no urgente debe distinguirse del texto general de la fuente.'},
 spfa2026:{edition:'Foro AF-FC, Guía práctica 2026, archivo V5_DO aportado por el usuario',pages:'33–35, 40–46, 52–55, 80–81 impresas; PDF en dobles páginas 17–18, 21–24, 27–28, 41',pdfPages:[17,18,21,22,23,24,27,28,41],sha256:'cf297b516c9134d064cd765c49d0b73d8168207120601669f4e6e73a94906387',
 text:'Síntesis revisada de pasajes seleccionados, no reproducción íntegra. PRM (pp. 33–35): se distingue administración errónea de problemas de uso, entre ellos no tomar la medicación/falta de adherencia. Los PRM son posibles causas de resultados negativos; una omisión no acredita por sí sola un resultado clínico. Dispensación (pp. 40–46): verificar destinatario, prescripción y cuestiones normativas, identificar inicio/cambios/continuación. En continuación explorar uso real y percepción de efectividad y seguridad, con atención a adherencia; recabar datos biomédicos cuando proceda y estén disponibles. Una incidencia interrumpe el curso ordinario y requiere valoración; su episodio puntual no equivale a implantar el servicio longitudinal de seguimiento. Indicación (pp. 52–55): entrevista PA-SI-T-A-M-A-E, evaluación de derivación y PRM/RNM, intervención adecuada a la información obtenida. Adherencia (pp. 80–81): combinar métodos para evaluarla, identificar el tipo de falta y las barreras prácticas o de percepción. La estrategia se adapta a la persona; puede ser técnica (incluidos recordatorios), conductual, educativa o de apoyo social. Son categorías de intervención, no una obligación de usar una alarma concreta. Conservar registro y límites de lo observado. La guía general no fija para estos pacientes cifras tensionales, grado de control diabético, dosis nuevas ni resultados de la intervención.'},
};
export function readGuideSource(key:keyof typeof guideCatalog){
 const s=content[key],clinicalText=s.text;
 return {key,url:guideCatalog[key].url,retrievedAt:new Date().toISOString(),status:'AVAILABLE' as const,sha256:s.sha256,clinicalText,truncated:false,
  representation:'guide-selection/1' as const,scope:'SELECTED_PARAPHRASE' as const,edition:s.edition,pages:s.pages,pdfPages:[...s.pdfPages],
  provenance:key==='spfa2026'?'USER_SUPPLIED_PDF_VERIFIED':'OFFICIAL_PDF_VERIFIED',
  clinicalTextSha256:createHash('sha256').update(clinicalText).digest('hex')};
}
