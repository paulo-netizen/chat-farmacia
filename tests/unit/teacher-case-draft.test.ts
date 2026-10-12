import { describe, it, expect, vi } from 'vitest';
vi.mock('server-only',()=>({}));
import { teacherDraftTemplate } from '@/lib/cases/v2/teacher-case-draft-templates';
import { teacherDraftFieldsSchema, studentDraftPreview } from '@/lib/cases/v2/teacher-case-draft';

describe('structured SPFA 2026 drafts, not approved cases',()=>{
  it.each(['lucia','maria'] as const)('validates %s and exposes only identity',id=>{
    const d=teacherDraftTemplate(id);
    expect(teacherDraftFieldsSchema.parse(d)).toEqual(d);
    expect(studentDraftPreview(d)).toEqual(d.identity);
    expect(Object.keys(studentDraftPreview(d)).sort()).toEqual(['edad','nombre','sexo']);
    expect(JSON.stringify(studentDraftPreview(d))).not.toContain(d.treatment);
  });
  it('preserves non determinability versus omissions without deriving adherence from silence',()=>{
    const l=teacherDraftTemplate('lucia'),m=teacherDraftTemplate('maria');
    expect(l.adherence.conclusion).toBe('NOT_DETERMINABLE');
    expect(l.adherence.interpretation).toContain('No equivale a adherencia global demostrada');
    expect(m.adherence.conclusion).toBe('NON_ADHERENT');
    expect(m.adherence.evidence).toContain('Dos dosis omitidas');
  });
  it('returns independent templates and detached validated input',()=>{
    const d=teacherDraftTemplate('lucia');const copy=teacherDraftFieldsSchema.parse(d);
    d.facts[0].value='changed';expect(copy.facts[0].value).not.toBe('changed');expect(teacherDraftTemplate('lucia').facts[0].value).not.toBe('changed');
  });
  it.each([
    (d:any)=>d.identity.nombre='',(d:any)=>d.identity.edad=-1,(d:any)=>d.initialDemand='',
    (d:any)=>d.facts.push({...d.facts[0]}),(d:any)=>d.requirements[0].factRefs=['F999'],
    (d:any)=>d.adherence.factRefs=[],(d:any)=>d.requirements[0].factRefs=[],
    (d:any)=>d.questionnaire[0].factRefs=['F999'],(d:any)=>d.status='PUBLISHED',
    (d:any)=>d.service='FOLLOW_UP',(d:any)=>d.adherence.conclusion='ADHERENT',
  ])('rejects invalid or invented data',mutate=>{const d=teacherDraftTemplate('lucia');mutate(d);expect(teacherDraftFieldsSchema.safeParse(d).success).toBe(false);});
});
