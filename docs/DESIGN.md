# AMC Demo · Sistema de diseño

## Dirección
Aplicación administrativa con navegación azul marino, superficies claras y acentos celestes en la navegación activa y el recorrido de ejemplo. La identidad visual es provisional y usa AMC en texto.

HTML semántico + Tailwind CSS compilado + módulos JavaScript. Sin framework, CDN ni servicios externos durante la presentación. Sin login. Los perfiles son demostrativos y no aportan seguridad real.

## Uso de UI UX Pro Max
Skill: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill (copia local en .agents/skills/ui-ux-pro-max).

Se ejecutó la búsqueda de sistema de diseño. La primera consulta industrial produjo coincidencias educativas que se descartaron. Una segunda consulta B2B/SaaS aportó Plus Jakarta Sans y criterios útiles de legibilidad. Los patrones comerciales de landing y glassmorphism no se adoptaron por no corresponder al flujo administrativo.

Las búsquedas de stack no produjeron coincidencias verificadas. Se aplicaron las pautas generales de la skill y la documentación oficial de Tailwind. La paleta es una decisión de diseño propia para esta demo, no una recomendación validada para AMC por la base de datos.

## Tokens
- Navegación azul marino `#10274a`.
- Botón principal azul `#2155a5` con texto blanco.
- Acento celeste `#c7e5ff` con texto `#123d70`.
- Fondo `#f3f6fb` y paneles blancos.
- Texto principal `#152945` y secundario `#50647e`.
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
- En pantallas pequeñas, navegación de cuatro accesos y tablas presentadas como fichas.
- Copiar componentes a una composición vacía crea un borrador editable e independiente del origen.
- La calculadora muestra las cantidades originales y ajustadas. Cada edición aplica un factor común respecto del origen. El resultado se puede guardar con un producto nuevo.
- Registrar producción suma la cantidad obtenida al producto seleccionado y descuenta el consumo total por materia prima en una sola escritura local. El consumo se muestra y registra en la unidad del stock, con hasta seis decimales.
- Las fichas de materias primas enlazan a todas las fórmulas relacionadas, incluidas las de productos inactivos.

## Alcance
Catálogo, altas/ediciones/desactivaciones, fórmula completa, materias primas, auditoría local básica y perfiles simulados. Categorías y unidades son catálogos fijos para esta demostración.

La demo incluye existencias ficticias y una entrada de producción con descuento de materias primas. Lotes, densidades, merma, costos y versiones formales requieren relevamiento. Las composiciones son ilustrativas.
