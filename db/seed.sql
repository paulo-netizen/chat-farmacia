insert into users (email, password_hash, name, role)
values (
  'profesor@demo.local',
  crypt('Profe123!', gen_salt('bf')),
  'Profesor Demo',
  'teacher'
)
on conflict (email) do nothing;

insert into users (email, password_hash, name, role)
select
  'alumno00' || i || '@demo.local',
  crypt('Alumno123!', gen_salt('bf')),
  'Alumno 00' || i,
  'student'
from generate_series(1,5) as s(i)
on conflict (email) do nothing;

insert into cases (title, description, spec, ground_truth, difficulty, status)
values (
  'Paciente con hipertensión y mala adherencia',
  'Paciente adulto con HTA que olvida tomar medicación y muestra barreras relacionadas con la rutina y comprensión del tratamiento.',
  jsonb_build_object(
    'nombre', 'María',
    'edad', 67,
    'sexo', 'F',
    'motivo_consulta', 'Revisión de la medicación para la tensión',
    'antecedentes', 'Hipertensión diagnosticada hace 8 años. No otras patologías relevantes.',
    'tratamiento', 'Enalapril 20 mg cada 24 h por la mañana',
    'contexto', 'Vive sola, refiere horarios irregulares para las comidas y el sueño.',
    'descripcion_paciente', 'Paciente algo preocupada, con cierta confusión sobre para qué sirve la medicación.'
  ),
  jsonb_build_object(
    'tipo_no_adherencia', 'no intencional',
    'barrera_principal', 'olvido',
    'intervenciones_validas', jsonb_build_array(
      'Uso de pastillero/recordatorios',
      'Educación sobre la importancia de la regularidad',
      'Vincular la toma a una rutina diaria (desayuno, cepillado de dientes)'
    )
  ),
  1,
  'approved'
);
