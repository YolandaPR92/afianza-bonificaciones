export async function fetchMensHistorial(mensId: number) {
  const data = await fetch(`/api/mensualidades/${mensId}/evidencias`).then((r) => r.json());
  return data.evidencias as any[];
}
