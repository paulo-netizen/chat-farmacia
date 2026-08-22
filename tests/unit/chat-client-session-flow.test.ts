import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('../../app/chat/ChatClient.tsx', import.meta.url),
  'utf8',
);

function sectionBetween(start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);

  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe('ChatClient explicit session flow source guard', () => {
  it('mounts with GET-only active-session recovery and never POSTs in useEffect', () => {
    const loadSection = sectionBetween(
      'const loadActiveSession',
      'useEffect(() =>',
    );
    const effectSection = sectionBetween(
      'useEffect(() =>',
      'async function handleStartCase',
    );

    expect(loadSection).toContain("fetch('/api/sessions/active'");
    expect(loadSection).toMatch(/method:\s*['"]GET['"]/);
    expect(effectSection).toMatch(/void\s+loadActiveSession\(\)/);
    expect(effectSection).not.toMatch(/method:\s*['"]POST['"]/);
    expect(effectSection).not.toContain("fetch('/api/sessions'");
  });

  it('has exactly one session POST inside the explicit start handler', () => {
    const startSection = sectionBetween(
      'async function handleStartCase',
      'async function handleSend',
    );
    const sessionPosts = source.match(
      /fetch\(\s*['"]\/api\/sessions['"]\s*,\s*\{\s*method:\s*['"]POST['"]/g,
    );

    expect(sessionPosts).toHaveLength(1);
    expect(startSection).toContain("fetch('/api/sessions'");
    expect(startSection).toMatch(/method:\s*['"]POST['"]/);
    expect(source).toContain('Comenzar caso');
    expect(source).toMatch(/onClick=\{\(\)\s*=>\s*\{\s*void\s+handleStartCase\(\)/);
    expect(source).toMatch(/disabled=\{startingCase\}/);
  });

  it('validates POST then performs canonical GET with a sessionId consistency guard', () => {
    const loadSection = sectionBetween(
      'const loadActiveSession',
      'useEffect(() =>',
    );
    const startSection = sectionBetween(
      'async function handleStartCase',
      'async function handleSend',
    );

    expect(startSection).toMatch(
      /const\s+postDto\s*=\s*createStudentSessionDto\(await\s+res\.json\(\)\)/,
    );
    expect(startSection).toMatch(
      /await\s+loadActiveSession\(postDto\.sessionId\)/,
    );
    expect(startSection.indexOf("fetch('/api/sessions'"))
      .toBeLessThan(startSection.indexOf('loadActiveSession(postDto.sessionId)'));
    expect(loadSection).toMatch(
      /expectedSessionId\s*!==\s*recovered\.session\.sessionId/,
    );
    expect(loadSection).toMatch(
      /res\.status\s*===\s*204[\s\S]*expectedSessionId\s*!==\s*undefined/,
    );
  });

  it('rebuilds the public DTO and persisted messages through allowlists', () => {
    expect(source).toMatch(
      /const\s+session\s*=\s*createStudentSessionDto\(payload\.session\)/,
    );
    expect(source).toMatch(/Array\.isArray\(payload\.messages\)/);
    expect(source).toContain("message.role !== 'student'");
    expect(source).toContain("message.role !== 'patient'");
    expect(source).toMatch(/typeof\s+message\.content\s*!==\s*['"]string['"]/);
    expect(source).toMatch(
      /return\s*\{\s*role:\s*message\.role,\s*content:\s*message\.content,?\s*\}/,
    );
    expect(source).toContain('setSessionData(recovered.session)');
    expect(source).toContain('setMessages(recovered.messages)');
    expect(source).not.toMatch(/\(await\s+res\.json\(\)\)\s+as\s+/);
  });

  it('uses recovery for retry and leaves 204 ready for another explicit choice', () => {
    const loadSection = sectionBetween(
      'const loadActiveSession',
      'useEffect(() =>',
    );
    const errorSection = sectionBetween(
      'if (error)',
      'if (!sessionData)',
    );

    expect(loadSection).toMatch(
      /res\.status\s*===\s*204[\s\S]*setSessionData\(null\)[\s\S]*setMessages\(\[\]\)/,
    );
    expect(errorSection).toMatch(/void\s+loadActiveSession\(\)/);
    expect(errorSection).not.toContain('router.refresh');
    expect(source).not.toContain('router.refresh()');
  });

  it('contains no synthetic patient transcript and no protected case fields', () => {
    const oldGreeting =
      'Hola, soy el paciente. Puedes hacerme las preguntas que consideres para entender mejor mi situación con la medicación.';
    const effectSection = sectionBetween(
      'useEffect(() =>',
      'async function handleStartCase',
    );

    expect(source).not.toContain(oldGreeting);
    expect(source).toMatch(
      /useState<ChatMessage\[\]>\(\[\]\)/,
    );
    expect(effectSection).not.toContain("role: 'patient'");
    expect(effectSection).not.toContain('setMessages([');

    for (const forbidden of [
      'caseId',
      'caseVersionId',
      'groundTruth',
      'evaluator',
      'provenance',
    ]) {
      expect(source).not.toContain(forbidden);
    }

    for (const publicLabel of [
      'Nombre:',
      'Edad:',
      'Sexo:',
      'Tratamiento disponible en Receta Electrónica:',
    ]) {
      expect(source).toContain(publicLabel);
    }
  });
});
