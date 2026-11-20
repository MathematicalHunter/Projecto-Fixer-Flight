# FixerFlight

Aplicación web estática en español que funciona como una libreta personal para planificar trayectos y viajes. No reserva ni agenda vuelos. Sigue las funciones definidas en `PLAN.pdf` y usa el documento de Planify como referencia complementaria.

## Ejecutar localmente

Sirve la carpeta desde un servidor HTTP local, por ejemplo con la extensión Live Server de VS Code o `python -m http.server 8000`. Abre luego `http://localhost:8000`. No uses `file://`: el navegador puede bloquear las solicitudes a las APIs.

## Funcionalidades

- **Inicio:** calcula distancia aérea aproximada y clima del destino mediante APIs gratuitas; guarda notas del trayecto en el dispositivo.
- **Destinos:** catálogo de países, búsqueda por nombre/capital/región, detalles, clima, pronóstico y artículos geográficos.
- **Guardados:** favoritos, planes de vuelo guardados y listas personalizadas.
- **Planificador:** organiza fechas, presupuesto, notas y actividades; estima distancia/tiempo orientativo. No agenda ni reserva vuelos.

## APIs y servicios

- [CountriesNow](https://countriesnow.space/) proporciona banderas, capitales y monedas.
- [World Bank API](https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api-documentation) aporta catálogo de países/regiones y población.
- [Open-Meteo Geocoding](https://open-meteo.com/en/docs/geocoding-api) y [Forecast](https://open-meteo.com/en/docs) aportan geocodificación, condiciones actuales y previsión meteorológica.
- [Wikipedia API](https://www.mediawiki.org/wiki/API:Geosearch) consulta artículos geográficos cercanos.

Los servicios públicos no requieren una clave para las solicitudes usadas aquí. Necesitan conexión y pueden aplicar límites o estar temporalmente fuera de servicio. La app muestra mensajes alternativos cuando la red o una API no está disponible.

## Planes, almacenamiento y cuentas

No se consultan tarifas ni disponibilidad de aerolíneas: no se encontró una API anónima y gratuita adecuada para ofrecer esos datos sin credenciales. Open-Meteo se usa para geocodificar ciudades y estimar una distancia en línea recta, no para calcular rutas/horarios de aerolínea. No se usa Google Maps ni se realizan reservas.

Destinos, listas, planes de vuelo y viajes se almacenan en `localStorage` del navegador. Son locales a ese dispositivo/navegador, no se sincronizan ni constituyen una cuenta. No se solicitan ni guardan contraseñas; no se necesita registro.

## Organización del código

- `index.html`, `destinos.html`, `guardados.html` y `planificador.html`: páginas funcionales principales.
- `scripts/app.js`: inicialización por `data-page`, consumo de APIs, almacenamiento local, favoritos/listas y planificación.
- `css/`: estilos de las páginas y componentes.
- `imagenes/`: recursos visuales locales.

Las claves persistidas se encuentran centralizadas en `STORAGE_KEYS` al inicio de `scripts/app.js`. Para borrar datos de prueba o comenzar de nuevo, elimina los elementos `fixerflight.*` del almacenamiento local del sitio desde las herramientas del navegador.

## Manuales

- `MANUAL_USUARIO.txt`: guía paso a paso con referencias a capturas en `capturas/`.
- `MANUAL_PROGRAMADOR.txt`: estructura, flujos principales, almacenamiento e integraciones.
- `APIS_Y_SERVICIOS.txt`: servicios utilizados, funciones y justificación de selección.
