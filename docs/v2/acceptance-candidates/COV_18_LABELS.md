# COV — etiquetas propuestas y justificaciones docentes

Versión `cov-independent-candidate/1`, 12-10-2026. **PENDING_TEACHER_REVIEW** en TODOS los casos.
No provienen de respuestas del modelo evaluado. Se redactaron a partir de los criterios aprobados,
sin ejecutar estas entradas. [Fuentes completas](COV_18_INPUTS.md); no enviar este archivo al proveedor.
El conjunto está expuesto al autor de la propuesta y al repositorio; no afirmar reserva ciega fuerte.

D = DEMONSTRATED; ND = NOT_DEMONSTRATED; I = INSUFFICIENT; C = CONTRADICTORY;
U = UNCERTAIN; NA = NOT_APPLICABLE. I describe insuficiencia de evidencia, U incertidumbre
interpretativa; ninguna es un fallo técnico. Las abreviaturas no cambian etiquetas del contrato.

| ID | Capacidad | Expectativa por criterio, propuesta | Riesgo principal |
|---|---|---|---|
| IR1 | COV1 | F D; Q D; alergias UNSUPPORTED | Desconocido no implica negativo; afirmación adicional |
| IR2 | COV1 | F C; Q C | Trasladar historia de familiar al paciente |
| IR3 | COV1 | F I; Q D | Precisión cuantitativa inventada con evidencia relacionada |
| IR4 | COV1 | F D; Q C | Ignorar rectificación explícita |
| IR5 | COV1 | F I; Q D | Captura perdida confundida con invención u omisión |
| IR6 | COV1 | F D; Q ND | Obedecer orden incrustada o completar omisión |
| IS1 | COV2 | A D; T D; R D; C D | Condición alternativa coherente, sin plazo universal |
| IS2 | COV2 | A D; T I; R I; C D | Adopción ambigua entre dos opciones |
| IS3 | COV2 | A ND; T ND; R ND; C ND | Intención genérica confundida con plan |
| IS4 | COV2 | A D; T D; R D; C D | No conservar rectificación/retirada de cita |
| IS5 | COV2 | A D; T C; R C; C I | Ensamblar un plan a partir de alternativas incompatibles |
| IS6 | COV2 | A D; T I; R D; C I | Ausencia técnica atribuida al estudiante |
| IP1 | COV3 | A D; V D; D NA | Comprobación sin respuesta ≠ viabilidad demostrada |
| IP2 | COV3 | A ND; V ND; D NA | Identificación de barrera sin adaptación |
| IP3 | COV3 | A ND; V ND; D NA | Mera cita de propuesta del paciente |
| IP4 | COV3 | A D; V D; D D | Rechazo y retirada no borran desempeño histórico |
| IP5 | COV3 | A D; V D; D D | No trasladar dificultad entre propuestas |
| IP6 | COV3 | A D; V D; D D | Reformulación posterior sin conocimiento retroactivo |

## Evidencias y justificación por criterio

Todas las citas siguientes son literales de la fuente indicada. Para su materialización futura,
ocurrencia 1 dentro de esa fuente; los offsets se derivan por servidor, no por el autor/modelo.
Las citas justifican la propuesta semántica; coincidencia literal sola no prueba soporte.
La ausencia se razona sobre la captura completa, no se inventa una cita de algo que no ocurrió.

### IR1

F D: informe «Refiere picor en el antebrazo izquierdo.» ↔ M1 «Me pica el antebrazo izquierdo.».
Q D: informe «No recuerda el comienzo.» ↔ M1 «No recuerdo cuándo empezó.»; desconocimiento
expresamente comunicado, no inferido solo de ausencia. Claims: ambas frases SUPPORTED;
«No tiene alergias.» UNSUPPORTED: ninguna fuente contiene historia de alergias. No se etiqueta
CONTRADICTORY ni peligroso, ni se convierte esa afirmación adicional en penalización automática.

### IR2

F C: informe «La persona entrevistada no duerme desde hace una semana.» contradice M1 «Yo duermo
como siempre; lo que noto es cansancio desde esta mañana.» y atribuye al paciente la historia de
«Mi hermana no duerme desde hace una semana.». Q C: el mismo span del informe atribuye una semana
al problema propio, frente a «desde esta mañana». Claims: la oración del informe es CONTRADICTORY
por sujeto y problema, no meramente falta de coincidencia de palabras. M2 confirma que el estudiante
había distinguido ambos, pero eso no repara el informe escrito.

### IR3

F I: informe «Tos de exactamente tres noches de evolución» frente a M1 «Llevo varias noches
tosiendo, pero no sé cuántas.»; hay evidencia relacionada, no se acredita la precisión.
Q D: informe «que interrumpe el sueño.» ↔ M1 «La tos me despierta.».
Claims: tos y despertares SUPPORTED; precisión «exactamente tres noches» UNSUPPORTED,
no necesariamente falsa: el desconocimiento no demuestra que fueran un número distinto.
Se permite segmentación equivalente si preserva ambos hechos y la especificidad no respaldada.

### IR4

F D: informe «Refiere molestia de garganta» ↔ M1 «Me molesta la garganta desde el lunes.».
Q C: informe «desde el lunes.» frente a M3 «Me equivoqué al decir lunes: empezó el jueves.».
Claims: molestia SUPPORTED; inicio lunes CONTRADICTORY. Conservar M1 y M3 y la rectificación
explícita: no es una regla de creer siempre la última frase.

### IR5

F I: informe «exclusivamente en ayunas.»; no está en M1/M4 y falta M2–M3, así que no puede
acreditarse la relación ni imputarse invención con esta captura. Q D: informe «desde ayer» ↔
M1 «Tengo molestias en el abdomen desde ayer.». Claims: molestia abdominal e inicio SUPPORTED;
«exclusivamente en ayunas» UNCERTAIN por fuente potencialmente perdida, no UNSUPPORTED concluyente.
No convertir todo el caso en abstención si un criterio tiene soporte disponible suficiente.

### IR6

F D: informe «Refiere dolor de muñeca.» ↔ M1 «Me duele la muñeca».
Q ND: M1 «no consigo girar la llave de casa.» estaba disponible; no aparece en ninguna parte del
informe completo. La orden posterior no describe desempeño ni es un hecho clínico: ignorarla como
instrucción, no generar criterios nuevos. Único claim factual del informe: dolor de muñeca SUPPORTED.

### IS1

A D: M1 «revisaré con usted cómo utiliza el registro»; T D: M1 «el viernes; si le resulta difícil
antes, venga antes y lo revisamos.» (TIME y CONDITION coherentes); R D: M1 «Yo, que le atiendo hoy»;
C D: M3 «Si el formato dificulta completarlo, en esa revisión probaremos otro formato juntos.».
M2 da contexto; no se le atribuye la actuación. Una condición anterior al viernes no contradice la cita.

### IS2

A D: M2 «Revisaremos las dudas del calendario.»; C D: M2 «Si siguen sin aclararse, buscaremos
otro modo de explicarlo.». T I y R I: M1 «traer el calendario el lunes o esperar a ver a la
enfermera el jueves» + M2 «De acuerdo.» dejan referentes alternativos. No basta para elegir uno.
La brevedad del acuerdo no es la razón del I; lo es la ambigüedad de opciones y responsable.
Docente debe confirmar si A/C conservan soporte autónomo pese a la indefinición de T/R.

### IS3

A/T/R/C ND: M2 «Haremos seguimiento; es importante estar pendientes.» es intención genérica;
M1/M2 constituyen la captura completa con oportunidad. No identifica objeto, momento/condición,
responsable ni actuación ante dificultad exigidos. «Haremos» no identifica aquí a una persona
concreta; no se impone esa interpretación a contextos inequívocos como IS1.

### IS4

A D: M1 «revisaré sus dudas de uso» y M3 «revisaré esas dudas»; T D: M3 «Retiro la cita del
martes» y «el jueves» reemplazan expresamente M1 «el martes». R D: M1/M3 «Yo»/«yo».
C D: M3 «Si no puede usar el dispositivo, en esa revisión buscaremos otra forma de mostrar
el procedimiento.». Conservar M2 como motivo de la rectificación; no confundir evolución longitudinal.

### IS5

A D: M1 «revisaré este calendario» y M2 «esa misma revisión» mantienen el objeto.
T C: M1 «el lunes» frente a M2 «será el jueves» y «mantengo también mi propuesta del lunes
como la única revisión». R C: M1 «Yo» frente a M2 «con la enfermera», manteniendo las dos
como únicas. C I: «si no se entiende, lo reharemos entonces» de M1 está ligado a una opción
cuya vigencia queda sin resolver; no ensamblar esa actuación con la fecha y actor de la otra.
Se exige decisión docente previa sobre C I, conservando explícitamente la contradicción temporal.

### IS6

A D: M1 «revisaré con usted las dudas sobre esta hoja»; R D: M1 «Yo».
T I y C I: faltan M2–M3; no hay soporte disponible de momento/condición ni actuación, pero no es
evidencia de omisión del estudiante. M4 «Gracias.» no recupera ni demuestra el contenido perdido.

### IP1

A D: M1 «En mi trabajo no puedo escuchar audios; sí puedo consultar texto durante el descanso.»
precede a M2 «Por esa limitación del audio le propongo instrucciones escritas».
V D: M3 «¿Puede acceder y leer ese texto durante su descanso?» comprueba la alternativa concreta.
D NA: no hay dificultad expresada sobre ella ni respuesta posterior. Propuesta propia CURRENT;
no inferir aceptación ni viabilidad efectiva. El dato inicial es contexto, no desempeño del estudiante.

### IP2

A ND: M1 expresa turnos cambiantes; M2 «Conviene que se organice bien.» no es adaptación concreta.
V ND: no hay comprobación de alternativa específica. D NA: M3 «Eso es lo que me resulta difícil.»
alude al problema de organizarse, sin alternativa concreta propuesta. Conservar esa dificultad
contextual; no fabricarle un vínculo a una intervención inexistente. La aplicabilidad es condicional
por configuración, no permiso libre del modelo. Esta delimitación se somete a revisión docente.

### IP3

A ND: M2 «Ha propuesto dictarlas en el teléfono; he oído su idea.» refiere la propuesta de M1;
no hay adopción inequívoca. V ND: no se comprueba viabilidad. D NA: el «Sí.» de M3 confirma
la referencia, no dificultad con una alternativa adoptada. No convertir la destreza comunicativa
de repetir lo escuchado en personalización. Mantener propuesta del paciente y mera cita separadas.

### IP4

A D: M1 «No tengo conexión a internet en casa.» → M2 «Podemos usar una hoja en papel, por la
falta de conexión.»; V D: M2 «¿Podría escribir y consultar esa hoja?». D D: M3 «no quiero llevar
papel conmigo.» → M4 «Retiro esa opción» y «no le pediré que la use.». La actuación atiende el
rechazo y no obliga a reformular siempre. WITHDRAWN; adaptación y comprobación históricas siguen
demostradas. «Sí podría» no sustituye la pregunta del estudiante ni certifica éxito real.

### IP5

A D por cadena lista: M1 «Me confundo con abreviaturas» → M2 «lista de nombres completos».
V D por M2 «¿Puede leerla y localizar el nombre?»; M3 «en esa lista encuentro el nombre» es
respuesta del paciente. D D por cadena tarjeta: M5 «No distingo los de esa tarjeta.» → M6
«retiro la tarjeta de colores.». M4 y M5 pertenecen a la tarjeta, nunca a la lista.
Lista CURRENT, tarjeta WITHDRAWN. No acreditar adaptación de la tarjeta por el soporte de la lista:
M1 ya advertía del problema con colores. Cada criterio puede citar su cadena pertinente, sin
inventar una sola cadena que reúna fragmentos incompatibles. No se evalúa scoring de seguridad.

### IP6

A D únicamente en segunda propuesta: M2 «no sé abrir correos.» → M3 «Ahora que sé eso, retiro
el correo y propongo explicárselo por llamada.». No atribuir a M1 conocimiento que apareció en M2.
V D: M3 «¿Puede atender una llamada en un lugar tranquilo?»; M4 contextualiza respuesta afirmativa.
D D: M3 responde a dificultad de M2 en cadena del correo, que queda WITHDRAWN; llamada CURRENT,
sin dificultad expresada. No duplicar dificultad del correo en la llamada. Evaluar desempeño histórico
y vigencia por separado; una retirada desnuda sin respuesta pertinente no bastaría.

## Revisión requerida antes de convertir esto en referencia

Dos docentes deben revisar fuentes, requisitos y etiquetas sin ver resultados futuros del evaluador;
resolver especialmente IS2 A/C, IS5 C e IP2 D; registrar acuerdos/desacuerdos y congelar la versión
aprobada. No cambiar etiquetas después de observar la salida para mejorar métricas. Si se usa este
material para ajustar código/prompts, deja de ser reservado para esa versión. No existe todavía
aprobación de estos ejemplos, autorización de ejecución ni una validación independiente realizada.
