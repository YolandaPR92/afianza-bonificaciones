// Script de siembra de datos ficticios. Reutiliza la misma capa async de src/lib/db.ts
// (mismo pool de Postgres que usa la app), no una conexión aparte.
import { run, pool } from "../src/lib/db";
import bcrypt from "bcryptjs";

async function insert(sql: string, params: any[]): Promise<number> {
  const res = await run<any>(sql, params);
  return Number(res.rows[0].id);
}

async function main() {
  console.log("Sembrando datos ficticios…");

  const verdant = await insert("INSERT INTO Cliente (nombre, cif, consultorAsignado) VALUES ($1, $2, $3) RETURNING id", ["Verdant Tech Solutions", "B00000001", "Alfonso"]);
  const kairos = await insert("INSERT INTO Cliente (nombre, cif, consultorAsignado) VALUES ($1, $2, $3) RETURNING id", ["Kairós Digital", "B00000002", "Alfonso"]);

  const laura = await insert(
    `INSERT INTO Persona (clienteId, nombre, idUsuario, puesto, departamento, titulacion, fechaIncorporacion, fechaAltaBonificacion) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [verdant, "Laura Méndez Soto", "00000001A", "Ingeniera de software", "I+D", "Grado en Ingeniería Informática", "2023-04-01", "2025-03-01"]
  );
  const diego = await insert(
    `INSERT INTO Persona (clienteId, nombre, idUsuario, puesto, departamento, titulacion, fechaIncorporacion, fechaAltaBonificacion) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [verdant, "Diego Ferrán Costa", "00000002B", "Arquitecto de datos", "I+D", "Máster en Ciencia de Datos", "2022-09-15", "2025-03-01"]
  );
  const sara = await insert(
    `INSERT INTO Persona (clienteId, nombre, idUsuario, puesto, departamento, titulacion, fechaIncorporacion, fechaAltaBonificacion) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [kairos, "Sara Nuñez Prado", "00000003C", "Desarrolladora backend", "Tecnología", "Ingeniería en Sistemas", "2021-01-10", "2024-11-01"]
  );

  const cloudreserve = await insert(
    `INSERT INTO Proyecto (clienteId, nombre, codigo, descripcionBreve, tecnologias, fechaInicio) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [verdant, "CloudReserve", "PRY-2026-001", "Plataforma de gestión de reservas", "Node.js, React, PostgreSQL", "2026-01-01"]
  );
  const databridge = await insert(
    `INSERT INTO Proyecto (clienteId, nombre, codigo, descripcionBreve, tecnologias, fechaInicio) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [kairos, "DataBridge", "PRY-2025-014", "Módulo de integración de datos", "Java, Angular", "2025-06-01"]
  );

  const v1 = await insert("INSERT INTO Vinculo (personaId, proyectoId, rol, dedicacion) VALUES ($1, $2, $3, $4) RETURNING id", [laura, cloudreserve, "Desarrolladora", 60]);
  const v2 = await insert("INSERT INTO Vinculo (personaId, proyectoId, rol, dedicacion) VALUES ($1, $2, $3, $4) RETURNING id", [diego, cloudreserve, "Arquitecto", 40]);
  const v3 = await insert("INSERT INTO Vinculo (personaId, proyectoId, rol, dedicacion) VALUES ($1, $2, $3, $4) RETURNING id", [sara, databridge, "Backend", 70]);

  const m1 = await insert("INSERT INTO Mensualidad (vinculoId, mes, anio, estado) VALUES ($1, 1, 2026, 'validada') RETURNING id", [v1]);
  await insert(
    `INSERT INTO Evidencia (mensualidadId, version, subidoPor, comentarioCliente, estado, revisadoPor, fechaRevision, comentarioRevision, checkPeriodo, checkNombre, checkTecnico)
     VALUES ($1, 1, $2, $3, 'validada', $4, '2026-02-05', $5, true, true, true) RETURNING id`,
    [m1, "laura@verdanttech.test", "Desarrollo del endpoint de reservas y pruebas unitarias durante enero de 2026, por Laura Méndez Soto.", "admin@consultora.test", "Evidencia validada correctamente."]
  );

  await insert("INSERT INTO Mensualidad (vinculoId, mes, anio, estado) VALUES ($1, 2, 2026, 'pendiente') RETURNING id", [v1]);

  const m3 = await insert("INSERT INTO Mensualidad (vinculoId, mes, anio, estado) VALUES ($1, 3, 2026, 'rechazada') RETURNING id", [v1]);
  await insert(
    `INSERT INTO Evidencia (mensualidadId, version, subidoPor, comentarioCliente, estado, revisadoPor, fechaRevision, comentarioRevision, checkPeriodo, checkNombre, checkTecnico)
     VALUES ($1, 1, $2, $3, 'rechazada', $4, '2026-03-05', $5, false, true, false) RETURNING id`,
    [m3, "laura@verdanttech.test", "Trabajo de marzo.", "admin@consultora.test", "No se identifica el mes ni las tareas técnicas concretas. Aportar documentación que describa la actividad de marzo de 2026."]
  );

  const m4 = await insert("INSERT INTO Mensualidad (vinculoId, mes, anio, estado) VALUES ($1, 1, 2026, 'validada') RETURNING id", [v2]);
  await insert(
    `INSERT INTO Evidencia (mensualidadId, version, subidoPor, comentarioCliente, estado, revisadoPor, fechaRevision, comentarioRevision, checkPeriodo, checkNombre, checkTecnico)
     VALUES ($1, 1, $2, $3, 'validada', $4, '2026-02-04', 'Correcto.', true, true, true) RETURNING id`,
    [m4, "diego@verdanttech.test", "Diseño del esquema de base de datos para CloudReserve, enero 2026, Diego Ferrán Costa.", "admin@consultora.test"]
  );

  const m5 = await insert("INSERT INTO Mensualidad (vinculoId, mes, anio, estado) VALUES ($1, 2, 2026, 'en_revision') RETURNING id", [v3]);
  await insert(
    `INSERT INTO Evidencia (mensualidadId, version, subidoPor, comentarioCliente, estado) VALUES ($1, 1, $2, $3, 'en_revision') RETURNING id`,
    [m5, "sara@kairosdigital.test", "Registro de horas y tareas de integración del módulo de notificaciones, febrero 2026, Sara Nuñez Prado."]
  );

  const pass = async (p: string) => bcrypt.hash(p, 10);
  const usuarios: [string, string, string, number | null, number | null][] = [
    ["admin@consultora.test", await pass("admin123"), "admin_consultora", null, null],
    ["tecnico@consultora.test", await pass("tecnico123"), "tecnico", null, null],
    ["admin@verdanttech.test", await pass("cliente123"), "admin_cliente", verdant, null],
    ["laura@verdanttech.test", await pass("cliente123"), "investigador", verdant, laura],
    ["admin@kairosdigital.test", await pass("cliente123"), "admin_cliente", kairos, null],
  ];
  for (const [email, hash, rol, clienteId, personaId] of usuarios) {
    await run("INSERT INTO Usuario (email, passwordHash, rol, clienteId, personaId) VALUES ($1, $2, $3, $4, $5)", [email, hash, rol, clienteId, personaId]);
  }

  console.log("Listo. Usuarios de prueba creados (ver README).");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => pool.end());
