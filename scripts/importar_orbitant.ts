// Carga de ORBITANT como primer cliente real (sección 10 del encargo). Lee los CSV
// desde una carpeta FUERA del repo (contienen nombres reales de personas) indicada por
// la variable de entorno ORBITANT_DATOS_DIR. Reutiliza la misma capa de datos que la
// app (src/lib/db.ts), no una conexión aparte. Idempotente: se puede volver a ejecutar
// sin duplicar nada, todo es find-or-create por clave natural.
import { readFileSync } from "fs";
import path from "path";
import { all, get, run, pool } from "../src/lib/db";
import { filasObjeto } from "../src/lib/csv";

const DIR = process.env.ORBITANT_DATOS_DIR;
if (!DIR) {
  throw new Error(
    "Define ORBITANT_DATOS_DIR con la ruta de la carpeta que contiene Personal.csv, Detalle.csv, Observaciones.csv " +
    "(una carpeta fuera del repo: estos CSV tienen nombres reales de personas)."
  );
}

const MESES: Record<string, number> = { Julio: 7, Agosto: 8, Septiembre: 9 };
const ANIO = 2026;
const TIPO_CONTENIDO: Record<string, string> = { PR: "pr", Commit: "commit", Ticket: "ticket", Otro: "otro", Listado: "otro", "Chat/acta": "otro" };
const RESULTADO: Record<string, string> = { "Válida": "valida", "No válida": "no_valida", "Débil": "debil" };

function leer(nombre: string): string {
  return readFileSync(path.join(DIR!, nombre), "utf-8");
}

function ddmmyyyyAIso(s: string): string | null {
  const m = s.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function pct(s: string): number | null {
  const t = s.replace("%", "").trim();
  if (!t) return null;
  const n = parseInt(t, 10);
  return Number.isNaN(n) ? null : n;
}

async function findOrCreateCliente(nombre: string): Promise<number> {
  const existe = await get<any>("SELECT id FROM Cliente WHERE nombre=$1", [nombre]);
  if (existe) return existe.id;
  return (await run<any>("INSERT INTO Cliente (nombre) VALUES ($1) RETURNING id", [nombre])).rows[0].id;
}

async function findOrCreateEjercicio(clienteId: number, nombre: string, fechaInicio: string, fechaFin: string): Promise<number> {
  const existe = await get<any>("SELECT id FROM Ejercicio WHERE clienteId=$1 AND nombre=$2", [clienteId, nombre]);
  if (existe) return existe.id;
  return (await run<any>(
    "INSERT INTO Ejercicio (clienteId, nombre, fechaInicio, fechaFin) VALUES ($1,$2,$3,$4) RETURNING id",
    [clienteId, nombre, fechaInicio, fechaFin]
  )).rows[0].id;
}

async function findOrCreateProyecto(clienteId: number, nombre: string): Promise<number> {
  const existe = await get<any>("SELECT id FROM Proyecto WHERE clienteId=$1 AND nombre=$2", [clienteId, nombre]);
  if (existe) return existe.id;
  return (await run<any>("INSERT INTO Proyecto (clienteId, nombre) VALUES ($1,$2) RETURNING id", [clienteId, nombre])).rows[0].id;
}

async function findOrCreateLinea(proyectoId: number, nombre: string): Promise<number> {
  const existe = await get<any>("SELECT id FROM LineaProyecto WHERE proyectoId=$1 AND nombre=$2", [proyectoId, nombre]);
  if (existe) return existe.id;
  return (await run<any>("INSERT INTO LineaProyecto (proyectoId, nombre) VALUES ($1,$2) RETURNING id", [proyectoId, nombre])).rows[0].id;
}

async function findOrCreatePersona(clienteId: number, nombre: string, datos: Record<string, any>): Promise<number> {
  const existe = await get<any>("SELECT id FROM Persona WHERE clienteId=$1 AND nombre=$2", [clienteId, nombre]);
  if (existe) return existe.id;
  return (await run<any>(
    `INSERT INTO Persona (clienteId, nombre, fechaAltaBonificacion, fechaBajaBonificacion, usuariosHerramientas, usuarioVinculado, queDebeAportar)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [clienteId, nombre, datos.fechaAltaBonificacion, datos.fechaBajaBonificacion, datos.usuariosHerramientas, datos.usuarioVinculado, datos.queDebeAportar]
  )).rows[0].id;
}

async function findOrCreateVinculo(personaId: number, proyectoId: number, datos: Record<string, any>): Promise<number> {
  const existe = await get<any>("SELECT id FROM Vinculo WHERE personaId=$1 AND proyectoId=$2", [personaId, proyectoId]);
  if (existe) return existe.id;
  return (await run<any>(
    `INSERT INTO Vinculo (personaId, proyectoId, pctCoordinacion, pctDespliegues, pctSoporte, pctGestion, observacionesFicha)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [personaId, proyectoId, datos.pctCoordinacion, datos.pctDespliegues, datos.pctSoporte, datos.pctGestion, datos.observacionesFicha]
  )).rows[0].id;
}

async function findOrCreateMensualidad(vinculoId: number, ejercicioId: number, mes: number, anio: number): Promise<number> {
  const existe = await get<any>("SELECT id FROM Mensualidad WHERE vinculoId=$1 AND mes=$2 AND anio=$3", [vinculoId, mes, anio]);
  if (existe) return existe.id;
  return (await run<any>(
    "INSERT INTO Mensualidad (vinculoId, ejercicioId, mes, anio, estado) VALUES ($1,$2,$3,$4,'pendiente') RETURNING id",
    [vinculoId, ejercicioId, mes, anio]
  )).rows[0].id;
}

async function findOrCreateEvidencia(mensualidadId: number, version: number, datos: Record<string, any>): Promise<number> {
  const existe = await get<any>("SELECT id FROM Evidencia WHERE mensualidadId=$1 AND version=$2", [mensualidadId, version]);
  if (existe) return existe.id;
  return (await run<any>(
    `INSERT INTO Evidencia (mensualidadId, version, subidoPor, estado, revisadoPor, fechaRevision, comentarioRevision, checkPeriodo, checkNombre, checkTecnico)
     VALUES ($1,$2,$3,$4,$5,NOW(),$6,$7,$8,$9) RETURNING id`,
    [
      mensualidadId, version, "importacion_orbitant", datos.estado, "admin@consultora.test",
      "Importado desde la revisión real de ORBITANT (entrega 1).",
      datos.estado === "validada", datos.estado === "validada", datos.estado === "validada",
    ]
  )).rows[0].id;
}

async function crearArchivoSiNoExiste(evidenciaId: number, datos: Record<string, any>): Promise<boolean> {
  const existe = await get<any>("SELECT id FROM Archivo WHERE evidenciaId=$1 AND nombre=$2", [evidenciaId, datos.nombre]);
  if (existe) return false;
  await run(
    `INSERT INTO Archivo (evidenciaId, nombre, ruta, resultado, motivoCodigo, comentarioCliente, notaInterna, tipoContenido, lineaProyectoId, revisadoPor, revisadoEn)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())`,
    [
      evidenciaId, datos.nombre, datos.nombre, datos.resultado, datos.motivoCodigo || null,
      datos.comentarioCliente || null, datos.notaInterna || null, datos.tipoContenido, datos.lineaProyectoId,
      "admin@consultora.test",
    ]
  );
  return true;
}

async function main() {
  console.log(`Leyendo CSV de ${DIR}…`);
  const personalFilas = filasObjeto(leer("Personal.csv"));
  const detalleFilas = filasObjeto(leer("Detalle.csv"));
  const observacionesFilas = filasObjeto(leer("Observaciones.csv"));

  const clienteId = await findOrCreateCliente("ORBITANT");
  const ejercicioId = await findOrCreateEjercicio(clienteId, "2026", `${ANIO}-01-01`, `${ANIO}-12-31`);
  const proyectoAfianzaId = await findOrCreateProyecto(clienteId, "Afianza");
  const proyectoHolaflyId = await findOrCreateProyecto(clienteId, "Holafly");

  // Proyecto de cada persona: el primero que no sea "Fuera de proyecto" en sus filas de Detalle.
  const proyectoPorPersona = new Map<string, number>();
  for (const fila of detalleFilas) {
    if (proyectoPorPersona.has(fila.Perfil)) continue;
    const linea = fila["Línea / subproyecto"];
    if (linea.startsWith("L1 Afianza")) proyectoPorPersona.set(fila.Perfil, proyectoAfianzaId);
    else if (linea.startsWith("L2 Holafly")) proyectoPorPersona.set(fila.Perfil, proyectoHolaflyId);
  }

  const lineaIdPorNombre = new Map<string, number>();
  async function resolverLinea(nombre: string, proyectoId: number): Promise<number | null> {
    if (nombre === "Fuera de proyecto") return null;
    const clave = `${proyectoId}:${nombre}`;
    if (!lineaIdPorNombre.has(clave)) lineaIdPorNombre.set(clave, await findOrCreateLinea(proyectoId, nombre));
    return lineaIdPorNombre.get(clave)!;
  }

  const personaIdPorNombre = new Map<string, number>();
  let personasCreadas = 0;
  for (const fila of personalFilas) {
    const nombre = fila.Perfil;
    const proyectoId = proyectoPorPersona.get(nombre);
    if (!proyectoId) {
      console.warn(`Aviso: "${nombre}" no tiene ninguna fila en Detalle.csv con línea de proyecto; se omite.`);
      continue;
    }
    const alertaValoracion = [
      fila["Alerta ficha"] && `Alerta: ${fila["Alerta ficha"]}`,
      fila["Valoración"] && `Valoración: ${fila["Valoración"]}`,
      fila["Observaciones ficha"],
    ].filter(Boolean).join(" | ");

    const personaId = await findOrCreatePersona(clienteId, nombre, {
      fechaAltaBonificacion: ddmmyyyyAIso(fila["Alta bonificada"]),
      fechaBajaBonificacion: ddmmyyyyAIso(fila["Baja"]),
      usuariosHerramientas: fila["Usuario GitHub / Jira"] || null,
      usuarioVinculado: fila["Usuario vinculado"]?.toLowerCase() === "sí",
      queDebeAportar: fila["Qué debe aportar"] || null,
    });
    personaIdPorNombre.set(nombre, personaId);
    personasCreadas++;

    await findOrCreateVinculo(personaId, proyectoId, {
      pctCoordinacion: pct(fila["% coordinación"]),
      pctDespliegues: pct(fila["% despliegues"]),
      pctSoporte: pct(fila["% soporte"]),
      pctGestion: pct(fila["% gestión / económico"]),
      observacionesFicha: alertaValoracion || null,
    });
  }
  console.log(`Personas: ${personasCreadas} procesadas.`);

  // Agrupa Detalle.csv por (persona, mes) — cada grupo es una Evidencia con un Archivo
  // por fila. Las filas con mes "Fuera de periodo" o "Sin fecha" no tienen mes real:
  // se listan al final para seguimiento manual, no se importan como mensualidad.
  const grupos = new Map<string, { personaId: number; mes: number; filas: Record<string, any>[] }>();
  const sinMes: Record<string, any>[] = [];
  for (const fila of detalleFilas) {
    const mes = MESES[fila.Mes];
    const personaId = personaIdPorNombre.get(fila.Perfil);
    if (!personaId) { console.warn(`Aviso: archivo de "${fila.Perfil}" sin persona cargada; se omite.`); continue; }
    if (!mes) { sinMes.push(fila); continue; }
    const clave = `${personaId}:${mes}`;
    if (!grupos.has(clave)) grupos.set(clave, { personaId, mes, filas: [] });
    grupos.get(clave)!.filas.push(fila);
  }

  let archivosCreados = 0;
  let evidenciasCreadas = 0;
  for (const { personaId, mes, filas } of grupos.values()) {
    const proyectoId = await get<any>("SELECT proyectoId FROM Vinculo WHERE personaId=$1", [personaId]).then((v) => v!.proyectoId);
    const vinculoId = await get<any>("SELECT id FROM Vinculo WHERE personaId=$1", [personaId]).then((v) => v!.id);
    const mensualidadId = await findOrCreateMensualidad(vinculoId, ejercicioId, mes, ANIO);

    const validas = filas.filter((f) => RESULTADO[f.Resultado] === "valida").length;
    const estado = validas >= 1 ? "validada" : "rechazada";
    const evidenciaId = await findOrCreateEvidencia(mensualidadId, 1, { estado });
    evidenciasCreadas++;

    for (const fila of filas) {
      const lineaProyectoId = await resolverLinea(fila["Línea / subproyecto"], proyectoId);
      const creado = await crearArchivoSiNoExiste(evidenciaId, {
        nombre: fila.Archivo,
        resultado: RESULTADO[fila.Resultado] || null,
        motivoCodigo: fila.Motivo || null,
        comentarioCliente: fila["Comentario (para el cliente)"],
        notaInterna: fila["Nota interna"],
        tipoContenido: TIPO_CONTENIDO[fila.Tipo] || "otro",
        lineaProyectoId,
      });
      if (creado) archivosCreados++;
    }

    await run("UPDATE Mensualidad SET estado=$1 WHERE id=$2", [estado, mensualidadId]);
  }
  console.log(`Mensualidades/evidencias: ${evidenciasCreadas} procesadas, ${archivosCreados} archivos nuevos.`);

  if (sinMes.length > 0) {
    console.log(`\n${sinMes.length} fila(s) de Detalle.csv sin mes real ("Fuera de periodo" / "Sin fecha"), no importadas — revisar a mano:`);
    for (const f of sinMes) console.log(`  - ${f.Perfil} · ${f.Mes} · ${f["Línea / subproyecto"]} · ${f.Archivo}`);
  }

  let observacionesNuevas = 0;
  for (const fila of observacionesFilas) {
    const detalle = `${fila.Tema}: ${fila["Observación"]} → ${fila["Acción"]}`;
    const existe = await get<any>(
      "SELECT id FROM EventoAuditoria WHERE entidad='Cliente' AND entidadId=$1 AND accion='observacion_orbitant' AND detalle=$2",
      [clienteId, detalle]
    );
    if (existe) continue;
    await run("INSERT INTO EventoAuditoria (entidad, entidadId, accion, usuario, detalle) VALUES ('Cliente', $1, 'observacion_orbitant', 'importacion_orbitant', $2)", [
      clienteId, detalle,
    ]);
    observacionesNuevas++;
  }
  console.log(`Observaciones: ${observacionesNuevas} nuevas de ${observacionesFilas.length} en el CSV.`);

  console.log("\nListo.");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => pool.end());
