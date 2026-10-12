import 'server-only';
import { teacherDraftFieldsSchema, type TeacherDraftTemplateId, type TeacherDraftFields } from './teacher-case-draft';

// Synthetic development material, never teacher-approved or student-published.
const templates = {
  "lucia": {
    "title": "Lucía — Indicación por molestia de garganta",
    "service": "INDICATION",
    "identity": {
      "nombre": "Lucía",
      "edad": 42,
      "sexo": "Mujer"
    },
    "initialDemand": "Desde ayer me molesta la garganta. ¿Qué puedo hacer?",
    "treatment": "Metformina 850 mg oral con desayuno y cena, prescrita y estable; se revela al preguntar.",
    "facts": [
      {
        "id": "F1",
        "label": "IF-F1",
        "value": "Molestia leve desde ayer, sin empeoramiento; puede tragar líquidos y respirar con normalidad",
        "disclosure": "Pregunta sobre evolución, intensidad y síntomas"
      },
      {
        "id": "F2",
        "label": "IF-F2",
        "value": "No ha observado fiebre ni placas; no ha medido su temperatura. Sin malestar general, dificultad respiratoria o para beber. No embarazo ni lactancia; no alergias o intolerancias conocidas según refiere. La falta de medición no acredita ausencia de fiebre.",
        "disclosure": "Preguntas pertinentes; no inferir otras ausencias"
      },
      {
        "id": "F3",
        "label": "IF-F3",
        "value": "Diabetes tipo 2 conocida; metformina 850 mg por vía oral con desayuno y cena, pauta prescrita estable",
        "disclosure": "Pregunta sobre enfermedades/medicación: «Tomo metformina de 850 con el desayuno y la cena»"
      },
      {
        "id": "F4",
        "label": "IF-F4",
        "value": "Refiere haber tomado las catorce dosis pautadas de metformina en los últimos siete días (850 mg oral con desayuno y cena). Describe su pauta, sin omisiones ni rechazo referidos. No hay diario, recuento, registro de dispensación ni cuestionario validado disponible; no se ha evaluado adherencia a hábitos de vida.",
        "disclosure": "Pregunta de uso real y posibles olvidos; no adelantar etiqueta de adherencia"
      },
      {
        "id": "F5",
        "label": "IF-F5",
        "value": "No tomó medicamentos para esta molestia; solo bebió agua. No otros medicamentos ni productos de autocuidado en este caso",
        "disclosure": "Preguntas sobre acciones previas y tratamiento completo"
      },
      {
        "id": "F6",
        "label": "IF-F6",
        "value": "Quiere una medida sencilla; puede beber líquidos con normalidad",
        "disclosure": "Pregunta sobre preferencias y viabilidad"
      },
      {
        "id": "F7",
        "label": "Destinataria y límites",
        "value": "Lucía consulta para ella misma. No dispone de glucemias ni evaluación médica de esta molestia. El caso no acredita diagnóstico etiológico ni relación causal con su medicación.",
        "disclosure": "Preguntas sobre destinatario, parámetros disponibles o valoraciones previas."
      }
    ],
    "adherence": {
      "conclusion": "NOT_DETERMINABLE",
      "period": "Últimos siete días para metformina; hábitos de vida no evaluados.",
      "evidence": "Autorreporte de 14/14 tomas y explicación de pauta; sin método complementario disponible.",
      "factRefs": [
        "F3",
        "F4"
      ],
      "interpretation": "No hay falta de adherencia descrita en el periodo referido. No equivale a adherencia global demostrada. Tipo y barrera de falta de adherencia: no aplicables sin problema identificado; no extrapolar a hábitos o periodos no explorados."
    },
    "teacherSolution": "Reconocer Indicación y explorar PA-SI-T-A-M-A-E. Valorar duración, acciones previas, tratamiento, alergias, situaciones fisiológicas, enfermedades y criterios de derivación antes de proponer autocuidado. La guía general no resuelve los umbrales específicos de garganta: concretarlos con el docente y un protocolo de síntomas menores antes de publicación. No afirmar etiología viral/bacteriana ni atribuir el síntoma a metformina sin evidencia. El autocuidado no farmacológico es una alternativa a revisar, no una solución ya autorizada para toda persona con diabetes. No hay PRM/RNM demostrado; ausencia de diagnóstico no equivale a descartar todos los problemas.",
    "requirements": [
      {
        "label": "Entrevista de Indicación",
        "goal": "Explorar destinatario, síntoma, duración, acciones previas, medicación, alergias y situación clínica, sin exigir frase exacta.",
        "applicability": "APPLICABLE",
        "rationale": "Requisito propuesto para revisión, sin peso ni aprobación académica.",
        "factRefs": [
          "F1",
          "F2",
          "F3",
          "F5",
          "F7"
        ],
        "guidePages": "51–54"
      },
      {
        "label": "Evaluación y derivación",
        "goal": "Justificar qué puede concluirse y qué falta para decidir intervención o derivación.",
        "applicability": "APPLICABLE",
        "rationale": "Requisito propuesto para revisión, sin peso ni aprobación académica.",
        "factRefs": [
          "F1",
          "F2",
          "F7"
        ],
        "guidePages": "54–56"
      },
      {
        "label": "Uso referido de medicación",
        "goal": "Obtener pauta y uso real y expresar límites del autorreporte.",
        "applicability": "APPLICABLE",
        "rationale": "Requisito propuesto para revisión, sin peso ni aprobación académica.",
        "factRefs": [
          "F3",
          "F4"
        ],
        "guidePages": "80–82"
      },
      {
        "label": "Personalización de propuesta",
        "goal": "Relacionar la propuesta con preferencias conocidas y comprobar posibilidad de aplicarla.",
        "applicability": "APPLICABLE",
        "rationale": "Requisito propuesto para revisión, sin peso ni aprobación académica.",
        "factRefs": [
          "F6"
        ],
        "guidePages": "56"
      },
      {
        "label": "Informe de derivación",
        "goal": "No se exige un informe por defecto.",
        "applicability": "NOT_APPLICABLE",
        "rationale": "No hay derivación con informe configurada; revisar si cambia el caso.",
        "factRefs": [
          "F7"
        ],
        "guidePages": "56–57"
      },
      {
        "label": "Seguimiento longitudinal",
        "goal": "No exigir resultados longitudinales.",
        "applicability": "NOT_APPLICABLE",
        "rationale": "No se desarrolla otro servicio; las condiciones de nueva consulta se revisarán con el protocolo específico.",
        "factRefs": [
          "F1"
        ],
        "guidePages": "56"
      }
    ],
    "questionnaire": [
      {
        "question": "¿Servicio de entrada?",
        "answer": "Indicación Farmacéutica: solicita solución para una molestia.",
        "factRefs": [
          "F1",
          "F7"
        ]
      },
      {
        "question": "¿Qué tratamiento debe descubrir?",
        "answer": "Metformina 850 mg oral con desayuno y cena; no figura en la ficha inicial.",
        "factRefs": [
          "F3"
        ]
      },
      {
        "question": "¿Puede afirmarse adherencia demostrada?",
        "answer": "No. Refiere 14/14 tomas en siete días, pero sin comprobación complementaria ni evaluación global. Clasificación global no determinable.",
        "factRefs": [
          "F4"
        ]
      },
      {
        "question": "¿Tipo y barrera de falta de adherencia?",
        "answer": "No aplicable: no hay problema identificado; no inventar barreras.",
        "factRefs": [
          "F4"
        ]
      },
      {
        "question": "¿PRM o RNM demostrado?",
        "answer": "No demostrado; el síntoma no prueba causalidad farmacológica ni efectividad de la metformina.",
        "factRefs": [
          "F1",
          "F3",
          "F7"
        ]
      },
      {
        "question": "¿Actuación?",
        "answer": "Valorar criterios de derivación y límites de datos; propuesta de autocuidado pendiente del protocolo específico de garganta. No prescribir antibiótico ni diagnóstico etiológico.",
        "factRefs": [
          "F1",
          "F2",
          "F7"
        ]
      }
    ]
  },
  "maria": {
    "title": "María — Dispensación de continuación con olvidos",
    "service": "DISPENSATION",
    "identity": {
      "nombre": "María",
      "edad": 67,
      "sexo": "Mujer"
    },
    "initialDemand": "Vengo a recoger mi medicación habitual.",
    "treatment": "Enalapril 20 mg oral una vez al día por la mañana; prescripción sintética de continuación vigente.",
    "facts": [
      {
        "id": "F1",
        "label": "DIS-F1",
        "value": "Hipertensión conocida desde hace ocho años. Enalapril 20 mg oral, una vez al día por la mañana, prescripción habitual",
        "disclosure": "Pregunta sobre qué medicamento necesita y cómo está prescrito"
      },
      {
        "id": "F2",
        "label": "DIS-F2",
        "value": "No es un tratamiento de inicio; lo utiliza desde hace años, sin cambio de pauta reciente",
        "disclosure": "Pregunta sobre inicio/continuación y cambios"
      },
      {
        "id": "F3",
        "label": "DIS-F3",
        "value": "María refiere dos dosis omitidas por olvido en los últimos siete días, frente a la pauta acordada de una toma cada mañana. No decidió abandonar el medicamento; desea seguirlo y relaciona las omisiones con cambios de rutina.",
        "disclosure": "Preguntas sobre uso real, olvidos y motivos"
      },
      {
        "id": "F4",
        "label": "DIS-F4",
        "value": "Vive sola, rutinas variables; cree que la medicación es importante pero no tiene claro para qué sirve",
        "disclosure": "Preguntas sobre comprensión y circunstancias; no adelantar barrera docente"
      },
      {
        "id": "F5",
        "label": "DIS-F5",
        "value": "No refiere reacciones adversas, otros medicamentos ni alergias conocidas en este caso. No hay mediciones actuales de presión ni datos de daño clínico",
        "disclosure": "Preguntas pertinentes; no inventar control tensional ni ausencia de todos los riesgos"
      },
      {
        "id": "F6",
        "label": "DIS-F6",
        "value": "Puede usar una alarma del móvil y acepta probar un recordatorio asociado a una rutina elegida con ella",
        "disclosure": "Tras propuesta y comprobación concreta, nunca como dato inicial"
      },
      {
        "id": "F7",
        "label": "Destinataria, prescripción y percepción",
        "value": "María solicita el medicamento para sí misma. Existe prescripción sintética vigente para continuación de enalapril 20 mg oral por la mañana, sin cambios recientes. Dice: me encuentro igual, no he notado molestias por las pastillas. No hay presión arterial disponible: percepción favorable no demuestra efectividad ni seguridad completas.",
        "disclosure": "Preguntas sobre destinatario, receta, cambios, cómo le va y problemas con el medicamento."
      }
    ],
    "adherence": {
      "conclusion": "NON_ADHERENT",
      "period": "Últimos siete días.",
      "evidence": "Dos dosis omitidas referidas de una pauta diaria acordada, atribuidas a olvido por cambios de rutina.",
      "factRefs": [
        "F1",
        "F3",
        "F4"
      ],
      "interpretation": "Falta de adherencia no intencionada con barrera práctica. La confusión del propósito requiere educación; vivir sola no demuestra falta de apoyo. No se deduce RNM manifestado ni control tensional."
    },
    "teacherSolution": "Reconocer Dispensación de continuación. Verificar destinatario, prescripción y posibles incidencias, pauta, cambios, uso real y percepción de efectividad/seguridad. Explorar y documentar omisiones y comprensión; proponer recordatorio viable y educación sobre el propósito. PRM sustentado: No toma la medicación/falta de adherencia; valorar además Falta de conocimiento del uso del medicamento en esta continuación, sin doble cómputo. No inferir un RNM manifestado sin datos de resultado. No alterar dosis. La incidencia requiere intervención y registro; el Episodio de Seguimiento de la guía no equivale a desarrollar el Servicio de Seguimiento Farmacoterapéutico.",
    "requirements": [
      {
        "label": "Dispensación y continuidad",
        "goal": "Verificar destinatario, prescripción, cambios y proceso de uso antes de decidir entrega.",
        "applicability": "APPLICABLE",
        "rationale": "Requisito propuesto para revisión, sin peso ni aprobación académica.",
        "factRefs": [
          "F1",
          "F2",
          "F7"
        ],
        "guidePages": "40–43"
      },
      {
        "label": "Uso y percepción",
        "goal": "Explorar omisiones, cómo le va y problemas, sin confundir percepción con resultados medidos.",
        "applicability": "APPLICABLE",
        "rationale": "Requisito propuesto para revisión, sin peso ni aprobación académica.",
        "factRefs": [
          "F3",
          "F5",
          "F7"
        ],
        "guidePages": "43"
      },
      {
        "label": "PRM y límites de RNM",
        "goal": "Identificar falta de adherencia y valorar conocimiento de uso; no atribuir RNM sin evidencia.",
        "applicability": "APPLICABLE",
        "rationale": "Requisito propuesto para revisión, sin peso ni aprobación académica.",
        "factRefs": [
          "F3",
          "F4",
          "F5"
        ],
        "guidePages": "34, 44–46"
      },
      {
        "label": "Intervención adaptada",
        "goal": "Acordar una ayuda para olvidos y comprobar viabilidad sin modificar dosis ni exigir aceptación como prueba de personalización.",
        "applicability": "APPLICABLE",
        "rationale": "Requisito propuesto para revisión, sin peso ni aprobación académica.",
        "factRefs": [
          "F4",
          "F6"
        ],
        "guidePages": "47–48, 81"
      },
      {
        "label": "Informe de derivación",
        "goal": "No exigir informe sin derivación configurada.",
        "applicability": "NOT_APPLICABLE",
        "rationale": "El caso no impone derivación con informe; no afirmar que nunca será necesaria.",
        "factRefs": [
          "F5",
          "F7"
        ],
        "guidePages": "47–48"
      },
      {
        "label": "Resultados longitudinales",
        "goal": "Diferenciar intervención registrada de seguimiento futuro.",
        "applicability": "NOT_APPLICABLE",
        "rationale": "La incidencia forma parte del recorrido; no se exigen resultados longitudinales ni servicio nuevo.",
        "factRefs": [
          "F3",
          "F6"
        ],
        "guidePages": "44, 48, 81"
      }
    ],
    "questionnaire": [
      {
        "question": "¿Servicio y subtipo?",
        "answer": "Dispensación de continuación, para sí misma.",
        "factRefs": [
          "F2",
          "F7"
        ]
      },
      {
        "question": "¿Pauta frente a uso?",
        "answer": "Una toma de 20 mg por la mañana; dos omisiones en siete días.",
        "factRefs": [
          "F1",
          "F3"
        ]
      },
      {
        "question": "¿Falta de adherencia y barrera?",
        "answer": "No intencionada: olvidos asociados a cambios de rutina; barrera práctica.",
        "factRefs": [
          "F3",
          "F4"
        ]
      },
      {
        "question": "¿PRM?",
        "answer": "No toma la medicación/falta de adherencia; además valorar falta de conocimiento del uso en continuación. No asumir que vivir sola sea PRM.",
        "factRefs": [
          "F3",
          "F4"
        ]
      },
      {
        "question": "¿RNM manifestado?",
        "answer": "No determinable: sin presión arterial ni daño clínico documentado; no confundir omisiones con inefectividad demostrada.",
        "factRefs": [
          "F5",
          "F7"
        ]
      },
      {
        "question": "¿Intervención?",
        "answer": "Educación del propósito y recordatorio adaptado, con viabilidad comprobada. No modificar pauta.",
        "factRefs": [
          "F4",
          "F6"
        ]
      },
      {
        "question": "¿Seguimiento o informe?",
        "answer": "Registrar la incidencia y actuación. No se exige informe ni resultado longitudinal por defecto.",
        "factRefs": [
          "F3",
          "F6"
        ]
      }
    ]
  }
} as const;

export function teacherDraftTemplate(id: TeacherDraftTemplateId): TeacherDraftFields {
  return teacherDraftFieldsSchema.parse(templates[id]);
}
