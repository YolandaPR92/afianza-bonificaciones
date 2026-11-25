import { Pool, types } from "pg";

// COUNT(*) y otras columnas bigint llegan del driver como string (para no perder precisión
// en enteros de 64 bits). La app nunca maneja cifras tan grandes, así que las parseamos como
// number aquí una sola vez — si no, cosas como `version + 1` harían concatenación de texto
// ("0" + 1 = "01") en vez de una suma.
types.setTypeParser(20 /* int8/bigint */, (val: string) => parseInt(val, 10));

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS Cliente (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  cif TEXT,
  consultorAsignado TEXT,
  estado TEXT NOT NULL DEFAULT 'Activo',
  createdAt TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE Cliente
  ADD COLUMN IF NOT EXISTS minEvidenciasValidasMes INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS Persona (
  id SERIAL PRIMARY KEY,
  clienteId INTEGER NOT NULL REFERENCES Cliente(id),
  nombre TEXT NOT NULL,
  idUsuario TEXT,
  puesto TEXT,
  departamento TEXT,
  titulacion TEXT,
  fechaIncorporacion TEXT,
  fechaAltaBonificacion TEXT,
  fechaBajaBonificacion TEXT,
  estado TEXT NOT NULL DEFAULT 'Activo',
  createdAt TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS Usuario (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  passwordHash TEXT NOT NULL,
  rol TEXT NOT NULL,
  clienteId INTEGER REFERENCES Cliente(id),
  personaId INTEGER UNIQUE REFERENCES Persona(id),
  autorizadoEdicion BOOLEAN NOT NULL DEFAULT false,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS Proyecto (
  id SERIAL PRIMARY KEY,
  clienteId INTEGER NOT NULL REFERENCES Cliente(id),
  nombre TEXT NOT NULL,
  codigo TEXT,
  descripcionBreve TEXT,
  descripcionTecnica TEXT,
  tecnologias TEXT,
  fechaInicio TEXT,
  fechaFin TEXT,
  estado TEXT NOT NULL DEFAULT 'Activo',
  createdAt TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS Vinculo (
  id SERIAL PRIMARY KEY,
  personaId INTEGER NOT NULL REFERENCES Persona(id),
  proyectoId INTEGER NOT NULL REFERENCES Proyecto(id),
  rol TEXT,
  dedicacion INTEGER,
  fechaInicio TEXT,
  fechaFin TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS Mensualidad (
  id SERIAL PRIMARY KEY,
  vinculoId INTEGER NOT NULL REFERENCES Vinculo(id),
  mes INTEGER NOT NULL,
  anio INTEGER NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente',
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(vinculoId, mes, anio)
);

CREATE TABLE IF NOT EXISTS Evidencia (
  id SERIAL PRIMARY KEY,
  mensualidadId INTEGER NOT NULL REFERENCES Mensualidad(id),
  version INTEGER NOT NULL,
  subidoPor TEXT,
  fechaSubida TIMESTAMP NOT NULL DEFAULT NOW(),
  comentarioCliente TEXT,
  checkPeriodo BOOLEAN NOT NULL DEFAULT false,
  checkNombre BOOLEAN NOT NULL DEFAULT false,
  checkTecnico BOOLEAN NOT NULL DEFAULT false,
  estado TEXT NOT NULL DEFAULT 'en_revision',
  revisadoPor TEXT,
  fechaRevision TIMESTAMP,
  comentarioRevision TEXT
);

CREATE TABLE IF NOT EXISTS Archivo (
  id SERIAL PRIMARY KEY,
  evidenciaId INTEGER NOT NULL REFERENCES Evidencia(id),
  nombre TEXT NOT NULL,
  ruta TEXT NOT NULL,
  tipo TEXT,
  tamano INTEGER,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS Ejercicio (
  id SERIAL PRIMARY KEY,
  clienteId INTEGER NOT NULL REFERENCES Cliente(id),
  nombre TEXT NOT NULL,
  fechaInicio TEXT NOT NULL,
  fechaFin TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'abierto',
  createdAt TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS MotivoRechazo (
  codigo TEXT PRIMARY KEY,
  motivo TEXT NOT NULL,
  comoSubsanar TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  orden INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS LineaProyecto (
  id SERIAL PRIMARY KEY,
  proyectoId INTEGER NOT NULL REFERENCES Proyecto(id),
  nombre TEXT NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS EventoAuditoria (
  id SERIAL PRIMARY KEY,
  entidad TEXT NOT NULL,
  entidadId INTEGER NOT NULL,
  accion TEXT NOT NULL,
  usuario TEXT,
  detalle TEXT,
  fecha TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS Notificacion (
  id SERIAL PRIMARY KEY,
  mensualidadId INTEGER REFERENCES Mensualidad(id),
  destinatario TEXT,
  tipo TEXT,
  mensaje TEXT,
  leida BOOLEAN NOT NULL DEFAULT false,
  fecha TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Columnas de Persona/Vinculo/Mensualidad/Archivo para la revisión de evidencias por
-- archivo, el ejercicio fiscal y los avisos automáticos. Este proyecto parte de
-- "Expediente Digital" (ver README) pero deja fuera el IDC, el RNT, la cotización/ahorro
-- y el cifrado de DNI/NAF — de ahí que Persona no tenga naf/dni/tipoContrato/etc.: eran
-- datos que solo alimentaba el IDC, que aquí no existe.
ALTER TABLE Persona
  ADD COLUMN IF NOT EXISTS usuariosHerramientas TEXT,
  ADD COLUMN IF NOT EXISTS usuarioVinculado BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS queDebeAportar TEXT;

ALTER TABLE Vinculo
  ADD COLUMN IF NOT EXISTS pctCoordinacion INTEGER,
  ADD COLUMN IF NOT EXISTS pctDespliegues INTEGER,
  ADD COLUMN IF NOT EXISTS pctSoporte INTEGER,
  ADD COLUMN IF NOT EXISTS pctGestion INTEGER,
  ADD COLUMN IF NOT EXISTS observacionesFicha TEXT;

-- pctNoIDi (despliegues + soporte + gestión; la coordinación técnica no resta porque
-- se considera I+D+i) se calcula siempre a partir de los tres porcentajes: una columna
-- generada no puede quedar desincronizada por un UPDATE que toque solo uno de ellos.
ALTER TABLE Vinculo
  ADD COLUMN IF NOT EXISTS pctNoIDi INTEGER GENERATED ALWAYS AS (
    COALESCE(pctDespliegues, 0) + COALESCE(pctSoporte, 0) + COALESCE(pctGestion, 0)
  ) STORED;

ALTER TABLE Mensualidad
  ADD COLUMN IF NOT EXISTS ejercicioId INTEGER REFERENCES Ejercicio(id);

-- "tipo" ya existe en Archivo y guarda el MIME type del adjunto subido; la clasificación
-- de contenido (pr/commit/ticket/...) es un dato distinto, así que usa un nombre propio.
ALTER TABLE Archivo
  ADD COLUMN IF NOT EXISTS resultado TEXT CHECK (resultado IN ('valida', 'debil', 'no_valida')),
  ADD COLUMN IF NOT EXISTS motivoCodigo TEXT REFERENCES MotivoRechazo(codigo),
  ADD COLUMN IF NOT EXISTS comentarioCliente TEXT,
  ADD COLUMN IF NOT EXISTS notaInterna TEXT,
  ADD COLUMN IF NOT EXISTS tipoContenido TEXT CHECK (tipoContenido IN ('pr', 'commit', 'ticket', 'documento', 'perfil', 'otro')),
  ADD COLUMN IF NOT EXISTS lineaProyectoId INTEGER REFERENCES LineaProyecto(id),
  ADD COLUMN IF NOT EXISTS hashImagen TEXT,
  ADD COLUMN IF NOT EXISTS revisadoPor TEXT,
  ADD COLUMN IF NOT EXISTS revisadoEn TIMESTAMP,
  -- Fecha del trabajo que el técnico ve en la evidencia: "YYYY-MM-DD", la introduce él
  -- mismo al revisar, no se detecta sola.
  ADD COLUMN IF NOT EXISTS fechaTrabajo TEXT;
`;

// Catálogo de motivos de rechazo, editable por admin_consultora. Se siembra aquí, no en
// prisma/seed.ts, porque es catálogo de la app (lo necesita cualquier entorno nuevo), no
// datos ficticios de desarrollo.
const SEED_SQL = `
INSERT INTO MotivoRechazo (codigo, motivo, comoSubsanar, orden) VALUES
  ('M1', 'No se identifica al trabajador: el usuario de GitHub o Jira no se vincula con su nombre.', 'Aportar una vez una captura del perfil de GitHub/Jira donde se vean el usuario y el nombre.', 1),
  ('M2', 'Sin fecha absoluta, fecha sin año o fuera del periodo bonificado.', 'Capturar con día, mes y año visibles. Solo evidencias del mes que se justifica.', 2),
  ('M3', 'No se puede ligar a un proyecto con ficha de proyecto.', 'Usar solo trabajos de los proyectos con ficha, o crear la ficha del proyecto que falta.', 3),
  ('M4', 'Actividad no técnica: documentación de procesos, gestión, entrevistas, permisos, reuniones administrativas.', 'Sustituirla por una evidencia de desarrollo técnico.', 4),
  ('M4b', 'Es técnica, pero sin novedad ni incertidumbre: evolutivo estándar, maquetación o UI, cambio trivial de configuración o esquema.', 'Priorizar PR o tickets donde se vea un problema técnico, una alternativa evaluada o una decisión de diseño (ADR, pruebas, métricas).', 5),
  ('M5', 'Mantenimiento, corrección de errores (fix), refactor, solo tests, CI/CD, despliegues u operación de sistemas.', 'No aportarlas: además restan, porque demuestran tareas no I+D+i. Aportar desarrollos nuevos o mejoras sustanciales.', 6),
  ('M6', 'El formato no acredita: listados, tableros, totales agregados, perfiles o imágenes compuestas no verificables.', '1-2 capturas concretas por mes (PR o ticket abierto) donde se lean el contenido técnico, el autor y la fecha.', 7),
  ('M7', 'Duplicada.', NULL, 8),
  ('M8', 'Incoherente con el control horario: fechada en fin de semana, en vacaciones o en un día sin fichaje.', 'Aportar evidencias de días laborables fichados, o explicar la incidencia.', 9),
  ('M9', 'Sin evidencia para ese mes.', 'Aportar al menos 1-2 evidencias válidas del mes.', 10)
ON CONFLICT (codigo) DO NOTHING;
`;

// Postgres pliega (a minúsculas) cualquier identificador no citado, tanto al crear las
// tablas como al parsear cada consulta — así que "clienteId" se guarda y se consulta
// siempre como "clienteid", de forma consistente. Lo único que eso rompe es el lado JS:
// las filas que devuelve el driver llegan con claves en minúsculas ("clienteid"), pero
// todo el código de la app accede a ellas en camelCase ("row.clienteId"). Esta tabla
// traduce de vuelta las claves conocidas (columnas reales + alias "AS" usados en JOINs)
// para que cada fila devuelta por all()/get()/run() tenga las claves que el resto de la
// app espera, sin tener que tocar ni una sola consulta SQL existente.
const CAMEL_CASE_KEYS = [
  "clienteId", "idUsuario", "fechaIncorporacion", "fechaAltaBonificacion", "fechaBajaBonificacion", "createdAt",
  "passwordHash", "personaId", "autorizadoEdicion",
  "descripcionBreve", "descripcionTecnica", "fechaInicio", "fechaFin",
  "proyectoId", "vinculoId",
  "mensualidadId", "subidoPor", "fechaSubida", "comentarioCliente", "checkPeriodo", "checkNombre", "checkTecnico",
  "revisadoPor", "fechaRevision", "comentarioRevision",
  "evidenciaId",
  "entidadId",
  "consultorAsignado",
  "personaNombre", "personaClienteId", "proyectoNombre", "proyectoCodigo", "proyectoClienteId", "clienteNombre",
  "usuariosHerramientas", "usuarioVinculado", "queDebeAportar",
  "pctCoordinacion", "pctDespliegues", "pctSoporte", "pctGestion", "pctNoIDi", "observacionesFicha",
  "ejercicioId", "motivoCodigo", "tipoContenido", "lineaProyectoId", "hashImagen", "revisadoEn",
  "comoSubsanar",
  "minEvidenciasValidasMes",
  "motivoTexto", "motivoComoSubsanar", "lineaProyectoNombre", "clienteMinEvidenciasValidasMes",
  "fechaTrabajo",
];

const LOWER_TO_CAMEL: Record<string, string> = {};
for (const name of CAMEL_CASE_KEYS) {
  LOWER_TO_CAMEL[name.toLowerCase()] = name;
}

function toCamelRow<T>(row: Record<string, any>): T {
  const out: Record<string, any> = {};
  for (const key of Object.keys(row)) {
    out[LOWER_TO_CAMEL[key] || key] = row[key];
  }
  return out as T;
}

const globalForDb = global as unknown as { pgPool?: Pool };

function init(): Pool {
  return new Pool({ connectionString: process.env.DATABASE_URL });
}

export const pool: Pool = globalForDb.pgPool || init();
if (process.env.NODE_ENV !== "production") globalForDb.pgPool = pool;

let schemaReady: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = pool.query(SCHEMA_SQL).then(() => pool.query(SEED_SQL)).then(() => undefined);
  }
  return schemaReady;
}

export async function all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  await ensureSchema();
  const result = await pool.query(sql, params);
  return result.rows.map((r) => toCamelRow<T>(r));
}

export async function get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  await ensureSchema();
  const result = await pool.query(sql, params);
  return result.rows[0] ? toCamelRow<T>(result.rows[0]) : undefined;
}

export async function run<T = any>(sql: string, params: any[] = []): Promise<{ rows: T[]; rowCount: number }> {
  await ensureSchema();
  const result = await pool.query(sql, params);
  return { rows: result.rows.map((r) => toCamelRow<T>(r)), rowCount: result.rowCount ?? 0 };
}
