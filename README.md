# AMC · Demo de productos y fórmulas

Prototipo para una reunión comercial. Datos ficticios; sin backend, login ni permisos reales.

## Ejecutar

Requiere Node.js 22 o superior y npm.

    npm ci
    npm run build
    npm run dev

Abrir http://127.0.0.1:4173. No abrir index.html mediante file://: los módulos JavaScript necesitan un servidor HTTP.

El build compila Tailwind, toma los íconos originales de Lucide y copia la fuente local. La carpeta _site/ contiene únicamente lo necesario para publicar.

    npm test

Las pruebas cubren el modelo y el flujo de interfaz mediante DOM simulado. No sustituyen la revisión visual en navegadores y dispositivos reales.

## Qué funciona

- Buscar por código o nombre, filtrar por categoría, estado y presencia de fórmula.
- Crear y editar productos y materias primas, con códigos únicos por catálogo.
- Desactivar registros conservando sus relaciones.
- Crear, editar, validar y consultar fórmulas con cantidades y unidades independientes.
- Decimales con coma o punto; errores junto a cada campo.
- Fecha y responsable local de modificaciones, con actividad reciente.
- Perfil de consulta y administración simulados.
- Guardado en localStorage y restablecimiento de los datos de ejemplo.
- Advertencias por cambios pendientes y fallos de almacenamiento.

Los datos persisten solamente en el navegador y origen usados. No se comparten entre usuarios ni dispositivos. Usar exclusivamente los ejemplos ficticios incluidos para publicar la demo.

## Guion para la reunión (5 minutos)

1. Abrir Productos y buscar “multiuso”.
2. Entrar en Limpiador multiuso y recorrer sus componentes.
3. Cambiar una cantidad a 0; guardar y mostrar el error.
4. Corregir a 82,5; guardar y mostrar el responsable y la fecha.
5. Ir a Materias primas, crear “Componente reunión” con código MP-REUNION y unidad mL.
6. Volver al producto, agregar el componente, completar su cantidad y guardar.
7. Cambiar el perfil superior a Solo consulta.
8. Usar Restablecer demo para repetir la presentación.

No interpretar los ejemplos como formulaciones químicas válidas.

## GitHub Pages

La carpeta es un proyecto nuevo, sin remote configurado. Subirlo al repositorio elegido, usando main.

1. En GitHub, abrir Settings → Pages → Build and deployment → Source: GitHub Actions.
2. Subir el proyecto. El workflow .github/workflows/pages.yml instala, prueba, compila y publica _site/.
3. La URL final estará en el deployment github-pages.

Todas las rutas de recursos son relativas y la navegación usa hash, por lo que admite https://usuario.github.io/repositorio/ sin configuración extra ni errores 404 al entrar a un producto.

Alternativamente, publicar _site/ con el mecanismo estático que prefieran. No publicar node_modules.

## Diseño y mantenimiento

- src/app.js: vistas, formularios, eventos y navegación.
- src/model.js: datos de ejemplo, validaciones y persistencia.
- src/styles.css: Tailwind y componentes visuales.
- src/icons.js: generado desde Lucide por el build; no editar manualmente.
- docs/DESIGN.md: decisiones de diseño.
- .agents/skills/ui-ux-pro-max: skill local para futuras tareas.

Fuentes autoalojadas e íconos de Lucide conservan sus licencias en assets. La licencia MIT de la skill está en THIRD_PARTY_LICENSES.txt. La identidad visual es provisional.

## Continuar el trabajo con otro asistente

La skill usada es **UI UX Pro Max**, de https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.

La copia del proyecto está en .agents/skills/ui-ux-pro-max. AGENTS.md indica leerla para trabajos de interfaz y conservar las decisiones de docs/DESIGN.md. Abrir el repositorio como proyecto permite que los asistentes compatibles descubran esas instrucciones; otros asistentes pueden necesitar que se las indiquen explícitamente.

Mensaje sugerido para retomar:

> Leé AGENTS.md, docs/DESIGN.md y .agents/skills/ui-ux-pro-max/SKILL.md antes de modificar la interfaz. Conservá HTML + Tailwind + JavaScript, los íconos de Lucide y el flujo de productos y fórmulas. Ejecutá las pruebas y el build al terminar.
