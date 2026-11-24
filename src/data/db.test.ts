import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { AppDb, applyImport, ensureSeeded, exportAll, parseExport, planImport } from './db';

let n = 0;
const freshDb = () => new AppDb(`test-${n++}`);

describe('baza', () => {
  it('pierwsze uruchomienie importuje historię i ustawienia, drugie niczego nie dubluje', async () => {
    const d = freshDb();
    await ensureSeeded(d, '2026-11-24');
    const count = await d.sessions.count();
    expect(count).toBe(12);
    expect((await d.settings.get('main'))?.ftpW).toBe(290);
    expect(await d.planned.count()).toBeGreaterThan(0);
    await ensureSeeded(d, '2026-11-24');
    expect(await d.sessions.count()).toBe(count);
  });

  it('nie nadpisuje zmienionych ustawień przy ponownym starcie', async () => {
    const d = freshDb();
    await ensureSeeded(d);
    await d.settings.update('main', { ftpW: 300 });
    await ensureSeeded(d);
    expect((await d.settings.get('main'))?.ftpW).toBe(300);
  });

  it('kopia odtwarza się na czystej instalacji', async () => {
    const a = freshDb();
    await ensureSeeded(a);
    await a.sessions.put({
      id: 'x1', date: '2026-11-25', workoutId: 'b_z2', kind: 'bike', title: 'Z2', phase: 'P2',
      bike: { avgW: 205 }, source: 'app', createdAt: '', updatedAt: '',
    });
    const file = parseExport(JSON.stringify(await exportAll(a)));

    const b = freshDb();
    const plan = await planImport(file, b);
    expect(plan.newSessions.length).toBe(13);
    await applyImport(plan, { overwriteConflicts: false, replaceSettings: true }, b);
    expect((await b.sessions.get('x1'))?.bike?.avgW).toBe(205);
    expect((await b.settings.get('main'))?.ftpW).toBe(290);
  });

  it('zgłasza konflikty zamiast nadpisywać po cichu', async () => {
    const d = freshDb();
    await ensureSeeded(d);
    const file = parseExport(JSON.stringify(await exportAll(d)));
    file.sessions[0] = { ...file.sessions[0], notes: 'zmienione' };
    const plan = await planImport(file, d);
    expect(plan.conflicts.length).toBe(1);
    expect(plan.sameSessions).toBe(11);
    await applyImport(plan, { overwriteConflicts: false, replaceSettings: false }, d);
    expect((await d.sessions.get(file.sessions[0].id))?.notes).not.toBe('zmienione');
  });

  it('odrzuca obcy plik z czytelnym komunikatem', () => {
    expect(() => parseExport('{"foo":1}')).toThrow(/plik kopii/);
  });
});
