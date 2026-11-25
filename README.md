# Afianza | Bonificaciones Sociales PI — Versión Alfa

Aplicación web (Next.js) centrada exclusivamente en la **revisión de evidencias** del personal
investigador para las bonificaciones sociales por I+D+i.

Este proyecto nace como una versión simplificada de un programa anterior más amplio
(`expediente-digital-alfa`), que además importaba IDC/RNT de la Seguridad Social y calculaba
cotización y ahorro. Esa parte queda aparcada en el proyecto original, con toda su información
intacta; aquí solo se mantiene el código de la parte que de verdad se usa día a día: dar de alta
clientes/personas/proyectos, generar las mensualidades y revisar las evidencias que aporta cada
cliente.

La paleta de color se inspira en la identidad visual de [afianza.es](https://www.afianza.es/)
(azules marino y acento celeste), adaptada con tipografía propia (IBM Plex Sans / Source Serif 4)
sin reutilizar ningún activo de marca de Afianza.

---

## Puesta en marcha

Requiere Node.js 18+ y acceso a la misma base de datos Postgres (Neon) que usa el proyecto original.

```bash
cp .env.example .env   # o copia el .env del proyecto original: comparten la misma base de datos
npm install
npm run dev            # arranca en http://localhost:3000
```

El esquema de tablas se crea (o actualiza) automáticamente al arrancar el servidor
(`ensureSchema()` en `src/lib/db.ts`), sin necesidad de migraciones manuales. Al compartir base de
datos con el proyecto original, esta app simplemente no usa las tablas de IDC/RNT/cotización que
puedan seguir existiendo ahí.

Para sembrar datos de prueba ficticios:

```bash
npm run seed
```

## Usuarios de prueba

| Email | Contraseña | Rol | Acceso |
|---|---|---|---|
| admin@consultora.test | admin123 | admin_consultora | Panel Interno — acceso total |
| tecnico@consultora.test | tecnico123 | tecnico | Panel Interno — revisión |
| admin@verdanttech.test | cliente123 | admin_cliente | Portal Cliente — ve a todo su personal |
| laura@verdanttech.test | cliente123 | investigador | Portal Cliente — solo su propia ficha |
| admin@kairosdigital.test | cliente123 | admin_cliente | Portal Cliente — aislado del cliente anterior |

---

## Qué hace esta versión

- **Datos maestros**: altas de clientes, personas, proyectos, vínculos persona-proyecto,
  ejercicios fiscales y usuarios; edición y baja (sin borrar histórico) de todos ellos.
- **Generación de mensualidades en lote** por ejercicio.
- **Revisión de evidencias**: filtros por cliente/proyecto/persona/ejercicio/mes/año/estado,
  revisión por archivo (válida/débil/no válida, motivo, tipo de contenido, fecha del trabajo),
  checklist de validez (periodo, nombre, contenido técnico), detección de posibles duplicados por
  hash de imagen, histórico completo por mensualidad.
- **Autenticación propia** (JWT + bcrypt) con 4 roles: `admin_consultora`, `tecnico`,
  `admin_cliente`, `investigador`, con aislamiento de datos por cliente verificado en servidor.
- **Registro de auditoría** de las acciones relevantes.

## Qué NO incluye (a propósito)

Todo lo relacionado con IDC, RNT, cotización/ahorro y el cifrado de DNI/NAF se quitó por completo
de este proyecto (código, rutas de API, tablas, tests, dependencias) para centrar el programa en
la revisión de evidencias. Esa funcionalidad sigue disponible, intacta, en el proyecto original
`expediente-digital-alfa/expediente-app`.

---

## Estructura del proyecto

```
src/
  app/
    login/              página de login
    portal/              portal cliente
    interno/             panel interno (dashboard, datos maestros, revisión de evidencias)
    api/                  rutas de la API (una carpeta por recurso)
  lib/
    db.ts                 capa de datos (Postgres/pg + creación de esquema)
    auth.ts               sesión, cookies, control de roles
    audit.ts              registro de auditoría
    elegibilidad.ts        avisos automáticos sobre dedicación colateral
    avisosArchivo.ts        avisos automáticos sobre archivos de evidencia
    hashImagen.ts           hash perceptual para detectar evidencias duplicadas
  components/
    TopBar.tsx
    HistorialModal.tsx
scripts/
  importar_orbitant.ts    importador puntual de los CSV de ORBITANT (primer cliente real)
prisma/
  schema.prisma           modelo de referencia (no se usa en tiempo de ejecución)
  seed.ts                  datos de prueba ficticios
uploads/                   archivos subidos (no versionar en git)
```
