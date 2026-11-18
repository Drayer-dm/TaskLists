import { isImageDataUrl, parseTask, parseTasks, toStoredTask } from './task.model';

// Validación de datos externos (almacenamiento y API): lo inválido se descarta
describe('task.model', () => {
  const valid = {
    id: 1,
    title: 'Comprar pan',
    description: 'En la esquina',
    createdAt: '2026-11-18T12:00:00.000Z',
    updatedAt: '2026-11-18T13:00:00.000Z',
  };

  it('convierte una tarea válida (las fechas vuelven a ser Date)', () => {
    const task = parseTask(valid);
    expect(task?.createdAt).toBeInstanceOf(Date);
    expect(task?.updatedAt.toISOString()).toBe(valid.updatedAt);
  });

  it('sin updatedAt (datos antiguos) usa la fecha de creación', () => {
    const { updatedAt: _updatedAt, ...old } = valid;
    expect(parseTask(old)?.updatedAt.toISOString()).toBe(valid.createdAt);
  });

  it.each([
    ['sin id', { ...valid, id: undefined }],
    ['id que no es número', { ...valid, id: '1' }],
    ['título vacío', { ...valid, title: '   ' }],
    ['título muy largo', { ...valid, title: 'x'.repeat(61) }],
    ['descripción muy larga', { ...valid, description: 'x'.repeat(201) }],
    ['fecha inválida', { ...valid, createdAt: 'ayer' }],
    ['no es un objeto', 'tarea'],
    ['null', null],
  ])('descarta una tarea con %s', (_case, value) => {
    expect(parseTask(value)).toBeNull();
  });

  it('descarta ubicaciones fuera de rango y climas mal formados, pero conserva la tarea', () => {
    const task = parseTask({
      ...valid,
      location: { latitude: 95, longitude: 0, accuracy: 5 },
      weather: { temperature: 'calor', code: 1, description: 'x' },
    });
    expect(task).not.toBeNull();
    expect(task?.location).toBeUndefined();
    expect(task?.weather).toBeUndefined();
  });

  it('sólo acepta fotos como imagen en data URL (no URLs remotas ni otros tipos)', () => {
    expect(isImageDataUrl('data:image/jpeg;base64,AAAA')).toBe(true);
    expect(isImageDataUrl('https://sitio.com/foto.jpg')).toBe(false);
    expect(isImageDataUrl('data:text/html;base64,AAAA')).toBe(false);
    expect(parseTask({ ...valid, photo: 'javascript:alert(1)' })?.photo).toBeUndefined();
  });

  it('parseTasks filtra los elementos inválidos de una lista', () => {
    expect(parseTasks([valid, { basura: true }, null]).length).toBe(1);
    expect(parseTasks('no es lista')).toEqual([]);
  });

  it('toStoredTask puede dejar fuera la foto (para enviar al servidor)', () => {
    const task = { ...parseTask(valid)!, photo: 'data:image/jpeg;base64,AAAA' };
    expect(toStoredTask(task).photo).toBeDefined();
    expect(toStoredTask(task, false).photo).toBeUndefined();
    expect(toStoredTask(task).createdAt).toBe(valid.createdAt);
  });
});
