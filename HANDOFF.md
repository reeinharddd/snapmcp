# snapmcp — Handoff Document

> **Generated**: 2026-06-09 | **203 tests, 0 failures** | **Build: ✅**

---

## Estado Actual

### Lo que está listo

| Área | Detalle |
|------|---------|
| **9 MCP tools** | terminal, code, browser, file, markdown, html, diff, pdf, **batch** |
| **Line range** | `capture_file` y `capture_code` aceptan `startLine`/`endLine` |
| **Batch** | `capture_batch` — hasta 10 capturas en una llamada |
| **CI** | ubuntu + macos + windows, bun + node |
| **Windows** | postinstall arreglado (`where` en vez de `which`, `USERPROFILE` fallback) |
| **27 temas** | Todos los de Shiki con colores definidos en el renderer |
| **Logger** | `SNAPMCP_LOG_LEVEL` funcional, log estructurado |
| **Testing** | 203 tests — unitarios, integración con Playwright, E2E del protocolo MCP, validación de configs |

### Para la próxima sesión

---

## 🔴 Prioridad Alta — Capture GIF / Sequence

### Qué construir

Dos nuevas tools MCP para capturar procesos completos como GIFs animados:

#### 1. `capture_sequence`

Toma una lista ordenada de pasos, captura cada uno, devuelve las imágenes individuales **Y** opcionalmente un GIF compilado.

```typescript
server.tool(
  "capture_sequence",
  "Capture each step of a process as individual files + optional compiled GIF.",
  {
    steps: z.array(z.object({
      type: z.enum(["terminal", "code", "file", "browser", "markdown", "diff", "html"]),
      params: z.record(z.any()),
      stepNumber: z.number().int().min(1).optional(),
      label: z.string().optional(),
    })),
    compileGif: z.boolean().default(false),
    frameDelay: z.number().int().min(10).max(5000).default(800),
    loop: z.boolean().default(true),
    output: z.string().optional(),
  },
  // ...
);
```

#### 2. `capture_gif`

Directamente crear un GIF a partir de capturas.

```typescript
server.tool(
  "capture_gif",
  "Create an animated GIF from sequential captures.",
  {
    title: z.string().default("animation"),
    captures: z.array(z.object({
      type: z.enum(["terminal", "code", "file", "browser", "markdown", "diff", "html"]),
      params: z.record(z.any()),
      label: z.string().optional(),
    })).min(2).max(60),
    frameDelay: z.number().int().min(10).max(5000).default(800),
    loop: z.boolean().default(true),
    output: z.string().optional(),
  },
  // ...
);
```

### Enfoque recomendado

**Opción A — gifencoder (arrancar acá)**:
- Usar el package `gifencoder` de npm
- Leer los PNGs generados por las capturas existentes
- Compilarlos en GIF con delays configurables
- Sin dependencias externas (todo Node.js)

```
PNG frames → gifencoder → animated GIF
```

**Opción B — FFmpeg (mejora futura)**:
- Shell out a FFmpeg para compilar frames
- Soporte para WebP animado, MP4, optimización de paleta
- Opcional, con fallback graceful

### Archivos a crear/modificar

| Archivo | Acción |
|---------|--------|
| `src/gif.ts` | **CREAR** — GIF encoder usando gifencoder |
| `src/index.ts` | **MODIFICAR** — agregar tools capture_sequence y capture_gif |
| `package.json` | **MODIFICAR** — agregar dependencia `gifencoder` |
| `tests/capture-sequence.test.ts` | **CREAR** — tests unitarios |
| `tests/integration/capture-gif.test.ts` | **CREAR** — test de integración con Playwright |

### Caso de uso educativo

Estudiante resolviendo un problema de programación:
```bash
# El agente toma captura de CADA paso:
1. capture_file con el código inicial → step-01.png
2. capture_terminal mostrando el comando compilar → step-02.png
3. capture_terminal mostrando el output de compilación → step-03.png
4. capture_terminal mostrando tests fallando → step-04.png
5. capture_file mostrando el fix → step-05.png
6. capture_terminal mostrando tests pasando → step-06.png

# Todo compilado en un GIF:
7. capture_sequence → proceso-completo.gif
```

---

## 🟡 Prioridad Media — Documentos con Capturas

### `capture_to_document`

Nueva tool que ejecuta capturas y las compila en un documento:

```typescript
server.tool(
  "capture_to_document",
  "Create a document (Markdown/PDF/HTML) with embedded step-by-step captures.",
  {
    title: z.string(),
    captures: z.array(z.object({
      type: z.enum(["terminal", "code", "file", "browser", "markdown", "diff", "html"]),
      params: z.record(z.any()),
      caption: z.string().optional(),
    })),
    format: z.enum(["markdown", "pdf", "html"]).default("markdown"),
    includeTimestamps: z.boolean().default(false),
    output: z.string().optional(),
  },
  // ...
);
```

- Markdown: imágenes embebidas como base64 (portátil)
- HTML: `<figure>` + `<img>` + `<figcaption>`
- PDF: renderizar HTML con Playwright

---

## 🟢 Prioridad Baja — CLI y DX

### Comandos nuevos

| Comando | Descripción |
|---------|-------------|
| `snapmcp init` | Wizard interactivo — elige tema, formato, detecta clientes MCP instalados, genera configs |
| `snapmcp doctor` | Diagnóstico — Chromium, Node, permisos, sandbox, tema, captura de prueba |
| `snapmcp test` | Captura de prueba para verificar que todo funciona |

### Docker publish

Crear `.github/workflows/docker.yml` para publicar automáticamente a GHCR en tags y main.

---

## Skills Sugeridas para la Próxima Sesión

| Skill | Para qué |
|-------|----------|
| `sdd-propose` | Formalizar la feature de GIF como proposal |
| `sdd-design` | Diseñar el pipeline de encoding GIF |
| `sdd-tasks` | Partir el trabajo restante en tareas |
| `sdd-apply-premium` | Implementar el GIF encoder (código complejo) |
| `mcp-developer` | Patrones para definición de tools MCP |
| `sdd-verify` | Validar que los GIFs se generan correctamente |
| `handoff` | Crear sub-handoffs para agents paralelos |

---

## Cómo Recuperar Contexto en la Próxima Sesión

```javascript
// 1. Cargar contexto de sesiones anteriores
mem_context({ project: "snapmcp" });

// 2. Buscar el plan completo
mem_search({ query: "snapmcp comprehensive plan" });
// → topic_key: architecture/snapmcp-comprehensive-testing-and-features-plan

// 3. Obtener detalles de la última observación
mem_get_observation({ id: <id from search> });

// 4. Arrancar tests para verificar estado
// bun test → debe dar 203 pass, 0 fail
```
