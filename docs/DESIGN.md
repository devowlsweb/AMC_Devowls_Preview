# AMC Demo · Sistema de diseño

## Dirección
Aplicación administrativa clara, con navegación verde petróleo, superficies claras y un acento lima reservado a la navegación activa y al recorrido de ejemplo. Identidad provisional: AMC en texto, sin inventar el logo del cliente ni adoptar la identidad del presupuesto.

HTML semántico + Tailwind CSS compilado + módulos JavaScript. Sin framework, CDN ni servicios externos durante la presentación. Sin login. Los perfiles son demostrativos y no aportan seguridad real.

## Uso de UI UX Pro Max
Skill: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill (copia local en .agents/skills/ui-ux-pro-max).

Se ejecutó la búsqueda de sistema de diseño. La primera consulta industrial produjo coincidencias educativas que se descartaron. Una segunda consulta B2B/SaaS aportó Plus Jakarta Sans y criterios útiles de legibilidad. Los patrones comerciales de landing y glassmorphism no se adoptaron por no corresponder al flujo administrativo.

Las búsquedas de stack no produjeron coincidencias verificadas. Se aplicaron las pautas generales de la skill y la documentación oficial de Tailwind. La paleta es una decisión de diseño propia para esta demo, no una recomendación validada para AMC por la base de datos.

## Tokens
- Navegación: #123c36.
- Acción principal: #166553 sobre blanco.
- Acento: #d4ec80 con texto #163e2f.
- Fondo: #f5f7f6. Superficie: blanco.
- Texto: #172f2b. Texto secundario: #62716e.
- Tipografía: Plus Jakarta Sans variable, autoalojada; fallback system-ui.
- Espaciado: múltiplos de 4 px; paneles 20–28 px.
- Radios: controles 8 px, paneles 12 px, modales 16 px.
- Íconos: Lucide oficial, misma familia y trazo; no dibujar paths a mano.

## Interacción
- Una acción principal por tarea.
- Enlaces para navegación; botones para acciones; campos con etiquetas visibles.
- Foco visible, enlace para saltar contenido y confirmación de cambios pendientes.
- Errores en cada campo y resumen enfocado al fallar una operación.
- Cantidades decimales con punto o coma. Unidades explícitas, sin sumar magnitudes diferentes.
- Estados diferenciados por texto, no solamente color.
- Diálogos nativos, cancelables; advertencia al cerrar formularios modificados.
- Movimiento discreto y respeto por prefers-reduced-motion.
- En pantallas pequeñas, navegación horizontal y tablas presentadas como fichas.

## Alcance
Catálogo, altas/ediciones/desactivaciones, fórmula completa, materias primas, auditoría local básica y perfiles simulados. Categorías y unidades son catálogos fijos para esta demostración.

No incluir stock, producción, calculadora de lotes, densidades, merma, costos ni versiones formales sin nuevo relevamiento. La composición ficticia no es una receta de fabricación.
