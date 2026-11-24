# Archivos de la integración MORPHEO

Comparación exacta contra el ZIP REA suministrado. 209 archivos originales idénticos; ningún archivo original eliminado.

| Archivo | Cambio | Propósito |
|---|---|---|
| `README.md` | Modificado | Entrada a la documentación MORPHEO conservando la guía REA. |
| `backend/alembic/versions/0007_agile_projects.py` | Nuevo | Tablas e índices nuevos; encadena a la 0006 original REA. |
| `backend/app/api/routers/agile.py` | Nuevo | API con permisos, filtros, bloqueos, sprints, importación y actividad. |
| `backend/app/core/audit.py` | Modificado | Evitar duplicar auditoría de las inserciones del propio historial ágil. |
| `backend/app/main.py` | Modificado | Registrar router ágil y versión; preservar seguridad y handlers REA. |
| `backend/app/models/__init__.py` | Modificado | Registrar modelos ágiles en metadata Alembic. |
| `backend/app/models/agile.py` | Nuevo | Persistencia de proyectos, integrantes, sprints, tarjetas, comentarios e historial. |
| `backend/app/schemas/agile.py` | Nuevo | Contratos y validaciones de entrada/salida. |
| `backend/requirements-dev.txt` | Modificado | aiosqlite para pruebas aisladas. |
| `backend/requirements.txt` | Modificado | openpyxl y defusedxml para importación XLSX. |
| `backend/tests/migration_test.py` | Modificado | Actualizar revisión esperada a 0007 en la prueba PostgreSQL existente. |
| `backend/tests/test_agile_integration.py` | Nuevo | Pruebas API con JWT y persistencia SQLite aislada. |
| `backend/tests/test_agile_schemas.py` | Nuevo | Pruebas de esquemas y duración de sprints. |
| `docs/MORPHEO.md` | Nuevo | Alcance, permisos, API, importación, pruebas y despliegue; limitaciones verificadas. |
| `docs/MORPHEO_FILES.md` | Nuevo | Inventario de cambios y comprobación de preservación. |
| `frontend/public/agile-template.csv` | Nuevo | Plantilla descargable de importación. |
| `frontend/src/App.tsx` | Modificado | Ruta protegida y carga diferida del módulo. |
| `frontend/src/api/agile.ts` | Nuevo | Cliente HTTP tipado y paginación. |
| `frontend/src/components/agile/WorkspaceTools.tsx` | Nuevo | Configuración, actividad, cierre revisable, mapeo y cronología. |
| `frontend/src/components/layout/Sidebar.tsx` | Modificado | Acceso desde navegación existente. |
| `frontend/src/i18n/parts/agile.en.json` | Nuevo | Textos de interfaz en inglés. |
| `frontend/src/i18n/parts/agile.es.json` | Nuevo | Textos de interfaz en español. |
| `frontend/src/pages/admin/AdminAgileProjects.tsx` | Nuevo | Espacio de trabajo ágil y controles accesibles. |
| `frontend/tests/agile.spec.ts` | Nuevo | Pruebas Playwright de escritorio ES y móvil EN con API simulada. |

No se incluyen dependencias instaladas, cachés, builds, capturas ni datos de las pruebas.
