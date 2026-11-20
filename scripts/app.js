"use strict";

const STORAGE_KEYS = {
    saved: "fixerflight.savedDestinations",
    trips: "fixerflight.trips",
    flights: "fixerflight.savedFlights",
    lists: "fixerflight.lists",
    countries: "fixerflight.countryCache"
};

const COUNTRY_FIELDS = "currency,flag,iso2,iso3,capital";
const COUNTRY_INFO_URL = `https://countriesnow.space/api/v0.1/countries/info?returns=${COUNTRY_FIELDS}`;
const WORLD_BANK_COUNTRIES_URL = "https://api.worldbank.org/v2/country?format=json&per_page=400";
const WORLD_BANK_POPULATION_URL = "https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&per_page=400&mrv=1";

function showNotice(message, isError) {
    let notice = document.querySelector(".notificacion-app");
    if (!notice) {
        notice = document.createElement("p");
        notice.className = "notificacion-app";
        notice.setAttribute("role", "status");
        notice.setAttribute("aria-live", "polite");
        document.body.append(notice);
    }

    notice.textContent = message;
    notice.classList.toggle("notificacion-error", Boolean(isError));
    notice.hidden = false;
    window.clearTimeout(showNotice.timeout);
    showNotice.timeout = window.setTimeout(() => {
        notice.hidden = true;
    }, 5000);
}

function readCollection(key) {
    try {
        const value = localStorage.getItem(key);
        if (value === null) return [];
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) throw new Error("El formato guardado no es válido.");
        return parsed;
    } catch (error) {
        console.error(`No se pudo leer ${key} desde el almacenamiento local.`, error);
        showNotice("No se pudieron leer los datos guardados en este navegador.", true);
        return [];
    }
}

function writeCollection(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.error(`No se pudo guardar ${key} en el almacenamiento local.`, error);
        showNotice("No se pudieron guardar los cambios. Revisa el almacenamiento del navegador.", true);
        return false;
    }
}

function makeId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`El servicio respondió con estado ${response.status}.`);
    return response.json();
}

function weatherDescription(code) {
    if (code === 0) return "Despejado";
    if (code === 1 || code === 2) return "Parcialmente nublado";
    if (code === 3) return "Nublado";
    if ([45, 48].includes(code)) return "Niebla";
    if ([51, 53, 55, 56, 57].includes(code)) return "Llovizna";
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Lluvia";
    if ([71, 73, 75, 77, 85, 86].includes(code)) return "Nieve";
    if ([95, 96, 99].includes(code)) return "Tormenta";
    return "Clima actualizado";
}

function getDestinationName(destination) {
    return destination.country ? `${destination.name}, ${destination.country}` : destination.name;
}

function makeActionButton(label, action) {
    const button = document.createElement("button");
    button.className = "boton-punto";
    button.type = "button";
    button.dataset.action = action;
    button.textContent = label;
    return button;
}

function addTrip(trip) {
    const trips = readCollection(STORAGE_KEYS.trips);
    const newTrip = { id: makeId("trip"), createdAt: new Date().toISOString(), ...trip };
    if (!writeCollection(STORAGE_KEYS.trips, [...trips, newTrip])) return null;
    return newTrip;
}

async function showNearbyPlaces(destination, container) {
    container.textContent = "Buscando lugares cercanos…";
    const params = new URLSearchParams({
        action: "query",
        generator: "geosearch",
        ggscoord: `${destination.latitude}|${destination.longitude}`,
        ggsradius: "10000",
        ggslimit: "8",
        prop: "info",
        inprop: "url",
        format: "json",
        origin: "*"
    });

    try {
        const data = await fetchJson(`https://es.wikipedia.org/w/api.php?${params}`);
        const pages = Object.values(data.query?.pages || {}).sort((a, b) => a.index - b.index);
        if (pages.length === 0) {
            container.textContent = "No se encontraron artículos cercanos en Wikipedia.";
            return;
        }
        const list = document.createElement("ul");
        list.className = "lista-lugares";
        pages.forEach((page) => {
            const item = document.createElement("li");
            const link = document.createElement("a");
            link.href = page.canonicalurl;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = page.title;
            item.append(link);
            list.append(item);
        });
        container.replaceChildren(list);
    } catch (error) {
        console.error(`No se pudieron consultar lugares cercanos a ${destination.name}.`, error);
        container.textContent = "No fue posible consultar lugares. Inténtalo de nuevo más tarde.";
    }
}

function initDestinations() {
    const container = document.querySelector("#listaDestinos");
    const form = document.querySelector("#formularioDestino");
    const status = document.querySelector("#estadoDestinos");
    const regionFilter = document.querySelector("#filtroRegion");
    const searchInput = document.querySelector("#buscarDestino");
    const dialog = document.querySelector("#modalDestino");
    const detailContainer = document.querySelector("#detalleDestino");
    const closeButton = document.querySelector("#cerrarModalDestino");
    if (!container || !form || !status || !regionFilter || !searchInput || !dialog || !detailContainer) return;

    let countries = [];
    const cachedCountries = readCollection(STORAGE_KEYS.countries);
    if (cachedCountries.length > 0) {
        countries = cachedCountries;
        renderCountryResults();
        status.textContent = `${countries.length} países disponibles.`;
    }

    function renderCountryResults() {
        const query = searchInput.value.trim().toLocaleLowerCase("es");
        const region = regionFilter.value;
        const results = countries.filter((country) => {
            const matchesQuery = !query || [
                country.name,
                country.capital,
                country.region,
                country.subregion
            ].some((value) => value.toLocaleLowerCase("es").includes(query));
            return matchesQuery && (!region || country.regionCode === region);
        });
        container.replaceChildren(...results.slice(0, 100).map(buildCountryCard));
        if (countries.length > 0) {
            status.textContent = results.length > 100
                ? `Mostrando los primeros 100 de ${results.length} países. Escribe para filtrar.`
                : `${results.length} país(es) encontrado(s).`;
        }
    }

    searchInput.addEventListener("input", renderCountryResults);
    regionFilter.addEventListener("change", renderCountryResults);
    form.addEventListener("submit", (event) => event.preventDefault());
    closeButton?.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
        if (event.target === dialog) dialog.close();
    });

    container.addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;
        const country = countries.find((item) => item.id === button.closest("[data-destination-id]").dataset.destinationId);
        if (!country) return;

        if (button.dataset.action === "detalle") {
            dialog.showModal();
            await showCountryDetails(country, detailContainer);
        } else if (button.dataset.action === "guardar") {
            toggleSavedDestination(country, container);
        } else if (button.dataset.action === "planificar") {
            const trip = addTrip({
                name: `Viaje a ${country.name}`,
                origin: "Bogotá",
                destination: country.name,
                destinationData: country,
                startDate: "",
                endDate: "",
                passengers: 1,
                budget: "",
                comments: "",
                activities: []
            });
            if (trip) window.location.href = `planificador.html#${encodeURIComponent(trip.id)}`;
        }
    });

    container.addEventListener("change", (event) => {
        if (event.target.matches('select[data-action="lista"]')) {
            event.target.closest("[data-destination-id]").dataset.selectedList = event.target.value;
        }
    });
    container.addEventListener("click", (event) => {
        const button = event.target.closest('button[data-action="agregar-lista"]');
        if (!button) return;
        const card = button.closest("[data-destination-id]");
        const country = countries.find((item) => item.id === card.dataset.destinationId);
        const listId = card.querySelector('select[data-action="lista"]').value;
        if (!listId) {
            showNotice("Crea una lista en Guardados antes de agregarle destinos.", true);
            return;
        }
        addItemToList(listId, { type: "destination", id: country.id, label: country.name, item: country });
    });

    loadCountries().then((data) => {
        countries = data;
        renderCountryResults();
    }).catch((error) => {
        console.error("No se pudieron cargar países desde las APIs públicas.", error);
        if (countries.length === 0) {
            status.textContent = "No fue posible cargar los países. Comprueba tu conexión e inténtalo de nuevo.";
        } else {
            status.textContent = "Mostrando los países guardados en este dispositivo; la actualización no estuvo disponible.";
        }
    });
}

async function loadCountries() {
    const requests = [
        fetchJson(COUNTRY_INFO_URL),
        fetchJson(WORLD_BANK_COUNTRIES_URL),
        fetchJson(WORLD_BANK_POPULATION_URL)
    ];
    const [countryResponse, worldBankCountries, worldBankPopulation] = await Promise.all(requests);
    if (countryResponse.error || !Array.isArray(countryResponse.data)) {
        throw new Error(countryResponse.msg || "La API de países devolvió datos inválidos.");
    }
    if (!Array.isArray(worldBankCountries[1]) || !Array.isArray(worldBankPopulation[1])) {
        throw new Error("La API del Banco Mundial devolvió datos incompletos.");
    }

    const apiCountries = new Map(countryResponse.data.map((country) => [country.iso2, country]));
    const populationByCode = new Map(
        worldBankPopulation[1]
            .filter((entry) => entry.countryiso3code && Number.isFinite(entry.value))
            .map((entry) => [entry.countryiso3code, entry.value])
    );
    const countries = worldBankCountries[1]
        .filter((country) => country.iso2Code && country.region?.id && country.region.id !== "NA")
        .map((country) => {
            const extra = apiCountries.get(country.iso2Code) || {};
            const capital = extra.capital || country.capitalCity || "";
            const regionLabel = normalizeRegion(country.region.value, country.iso2Code);
            return {
                id: country.id,
                iso2: country.iso2Code,
                name: country.name,
                capital,
                region: regionLabel,
                regionCode: regionCode(regionLabel),
                subregion: country.region.value,
                population: populationByCode.get(country.id) || 0,
                flag: extra.flag || `https://flagcdn.com/w320/${country.iso2Code.toLocaleLowerCase("en")}.png`,
                currency: extra.currency || "",
                latitude: Number(country.latitude) || 0,
                longitude: Number(country.longitude) || 0
            };
        })
        .sort((a, b) => a.name.localeCompare(b.name, "es"));

    if (countries.length === 0) throw new Error("Las APIs no devolvieron países.");
    writeCollection(STORAGE_KEYS.countries, countries);
    return countries;
}

function normalizeRegion(region, iso2Code) {
    const value = region.toLocaleLowerCase("en");
    const oceaniaCodes = [
        "AS", "AU", "CK", "FJ", "FM", "GU", "KI", "MH", "MP", "NC", "NR",
        "NZ", "PF", "PG", "PW", "SB", "TK", "TO", "TV", "VU", "WS"
    ];
    const asiaCodes = [
        "AF", "AM", "AZ", "BH", "CY", "GE", "IL", "IR", "IQ", "JO", "KG",
        "KW", "KZ", "LB", "OM", "PK", "PS", "QA", "SA", "SY", "TJ", "TM",
        "TR", "UZ", "AE", "YE"
    ];
    if (oceaniaCodes.includes(iso2Code)) {
        return "Oceanía";
    }
    if (asiaCodes.includes(iso2Code)) return "Asia";
    if (iso2Code === "MT") return "Europa";
    if (value.includes("africa")) return "África";
    if (value.includes("europe")) return "Europa";
    if (value.includes("asia") || value.includes("middle east") || value.includes("pacific")) return "Asia";
    return "América";
}

function regionCode(label) {
    return {
        "África": "Africa",
        "América": "Americas",
        "Asia": "Asia",
        "Europa": "Europe",
        "Oceanía": "Oceania"
    }[label] || "";
}

function buildCountryCard(country) {
    const card = document.createElement("article");
    card.className = "tarjeta-destino tarjeta-pais";
    card.dataset.destinationId = country.id;

    const flag = document.createElement("img");
    flag.className = "bandera-pais";
    flag.src = country.flag;
    flag.alt = `Bandera de ${country.name}`;
    flag.loading = "lazy";
    flag.referrerPolicy = "no-referrer";
    flag.addEventListener("error", () => {
        flag.hidden = true;
    }, { once: true });

    const heading = document.createElement("h3");
    heading.textContent = country.name;
    const details = document.createElement("p");
    details.textContent = `Capital: ${country.capital || "No disponible"} · ${country.region}`;
    const population = document.createElement("p");
    population.textContent = country.population
        ? `Población: ${new Intl.NumberFormat("es-CO").format(country.population)}`
        : "Población: No disponible";

    const actions = document.createElement("div");
    actions.className = "acciones-destino";
    actions.append(
        makeActionButton("Ver detalles", "detalle"),
        makeActionButton("Guardar favorito", "guardar"),
        makeActionButton("Planificar viaje", "planificar")
    );
    const listControls = buildListControls(country);
    card.append(flag, heading, details, population, actions, listControls);
    updateCountrySaveButton(card);
    return card;
}

function buildListControls(country) {
    const wrapper = document.createElement("div");
    wrapper.className = "agregar-lista";
    const select = document.createElement("select");
    select.dataset.action = "lista";
    select.setAttribute("aria-label", `Selecciona una lista para ${country.name}`);
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Selecciona una lista";
    select.append(placeholder);
    readCollection(STORAGE_KEYS.lists).forEach((list) => {
        const option = document.createElement("option");
        option.value = list.id;
        option.textContent = list.name;
        select.append(option);
    });
    const add = makeActionButton("Agregar a lista", "agregar-lista");
    wrapper.append(select, add);
    return wrapper;
}

function updateCountrySaveButton(card) {
    const button = card.querySelector('button[data-action="guardar"]');
    if (!button) return;
    const saved = readCollection(STORAGE_KEYS.saved).some((item) => item.id === card.dataset.destinationId);
    button.textContent = saved ? "Quitar de favoritos" : "Guardar favorito";
    button.setAttribute("aria-pressed", String(saved));
}

function toggleSavedDestination(destination, container) {
    const saved = readCollection(STORAGE_KEYS.saved);
    const exists = saved.some((item) => item.id === destination.id);
    const next = exists
        ? saved.filter((item) => item.id !== destination.id)
        : [...saved, destination];
    if (writeCollection(STORAGE_KEYS.saved, next)) {
        if (container) {
            const card = container.querySelector(`[data-destination-id="${CSS.escape(destination.id)}"]`);
            if (card) updateCountrySaveButton(card);
        }
        showNotice(exists ? "Destino eliminado de Favoritos." : "Destino agregado a Favoritos.");
    }
}

async function showCountryDetails(country, container) {
    container.replaceChildren();
    const title = document.createElement("h2");
    title.id = "tituloDetalleDestino";
    title.textContent = country.name;
    const overview = document.createElement("p");
    overview.textContent = `Capital: ${country.capital || "No disponible"} · Región: ${country.region} · Población: ${country.population ? new Intl.NumberFormat("es-CO").format(country.population) : "No disponible"} · Moneda: ${country.currency || "No disponible"}`;
    const weather = document.createElement("p");
    weather.className = "clima-destino";
    weather.textContent = "Consultando clima y pronóstico…";
    const placesHeading = document.createElement("h3");
    placesHeading.textContent = `Lugares destacados cerca de ${country.capital || country.name}`;
    const places = document.createElement("div");
    places.className = "lugares-cercanos";
    places.textContent = "Consultando información geográfica…";
    container.append(title, overview, weather, placesHeading, places);
    await Promise.all([
        loadCountryWeather(country, weather),
        showNearbyPlaces(
            { ...country, name: country.capital || country.name, latitude: country.latitude, longitude: country.longitude },
            places
        )
    ]);
}

async function loadCountryWeather(country, element) {
    let { latitude, longitude } = country;
    if (country.capital) {
        const params = new URLSearchParams({
            name: `${country.capital} ${country.name}`,
            count: "1",
            language: "en",
            format: "json"
        });
        try {
            const geocoding = await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
            if (geocoding.results?.length) {
                latitude = geocoding.results[0].latitude;
                longitude = geocoding.results[0].longitude;
            }
        } catch (error) {
            console.error(`No se pudo geocodificar la capital de ${country.name}.`, error);
        }
    }

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || (latitude === 0 && longitude === 0)) {
        element.textContent = "No hay coordenadas disponibles para consultar el clima.";
        return;
    }

    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.search = new URLSearchParams({
        latitude,
        longitude,
        current: "temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code",
        daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code",
        forecast_days: "3",
        timezone: "auto"
    });
    try {
        const data = await fetchJson(url);
        if (!data.current || !data.daily?.time) throw new Error("La respuesta no contiene el pronóstico solicitado.");
        const current = `${weatherDescription(data.current.weather_code)} · ${Math.round(data.current.temperature_2m)} °C · viento ${Math.round(data.current.wind_speed_10m)} km/h`;
        const forecast = data.daily.time.map((date, index) => {
            const day = new Intl.DateTimeFormat("es-CO", { weekday: "long", timeZone: "UTC" })
                .format(new Date(`${date}T00:00:00Z`));
            return `${day}: ${Math.round(data.daily.temperature_2m_min[index])}°–${Math.round(data.daily.temperature_2m_max[index])}°C, lluvia ${data.daily.precipitation_probability_max[index] ?? "s/d"}%`;
        });
        element.textContent = `${current}. Pronóstico: ${forecast.join(" · ")}`;
    } catch (error) {
        console.error(`No se pudo consultar el pronóstico de ${country.name}.`, error);
        element.textContent = "No se pudo cargar el pronóstico en este momento.";
    }
}

function initSavedDestinations() {
    const container = document.querySelector("#listaGuardados");
    const emptyMessage = document.querySelector("#mensajeVacio");
    const flightsContainer = document.querySelector("#listaVuelosGuardados");
    const emptyFlights = document.querySelector("#mensajeVuelosVacio");
    const listForm = document.querySelector("#formularioLista");
    const listsContainer = document.querySelector("#contenedorListas");
    const listStatus = document.querySelector("#estadoListas");
    if (!container || !emptyMessage || !flightsContainer || !emptyFlights || !listForm || !listsContainer || !listStatus) return;

    function renderSaved() {
        const saved = readCollection(STORAGE_KEYS.saved);
        const flights = readCollection(STORAGE_KEYS.flights);
        emptyMessage.hidden = saved.length > 0;
        emptyFlights.hidden = flights.length > 0;
        container.replaceChildren(...saved.map((destination) => {
            const card = document.createElement("article");
            card.className = "tarjeta-destino";
            card.dataset.destinationId = destination.id;
            if (destination.flag) {
                const flag = document.createElement("img");
                flag.className = "bandera-pais";
                flag.src = destination.flag;
                flag.alt = `Bandera de ${destination.name}`;
                flag.loading = "lazy";
                flag.addEventListener("error", () => {
                    flag.hidden = true;
                }, { once: true });
                card.append(flag);
            }
            const title = document.createElement("h3");
            title.textContent = getDestinationName(destination);
            const description = document.createElement("p");
            description.textContent = destination.capital
                ? `Capital: ${destination.capital} · ${destination.region}`
                : "Destino guardado en este dispositivo.";
            const remove = makeActionButton("Quitar de favoritos", "quitar");
            remove.addEventListener("click", () => {
                const remaining = readCollection(STORAGE_KEYS.saved).filter((item) => item.id !== destination.id);
                if (writeCollection(STORAGE_KEYS.saved, remaining)) renderSaved();
            });
            const plan = makeActionButton("Añadir al planificador", "planificar");
            plan.addEventListener("click", () => {
                const trip = addTrip({
                    name: `Viaje a ${destination.name}`,
                    origin: "Bogotá",
                    destination: getDestinationName(destination),
                    destinationData: destination,
                    startDate: "",
                    endDate: "",
                    passengers: 1,
                    budget: "",
                    comments: "",
                    activities: []
                });
                if (trip) window.location.href = `planificador.html#${encodeURIComponent(trip.id)}`;
            });
            const listControls = buildSavedListControls();
            listControls.dataset.listItemId = destination.id;
            listControls.dataset.listItemType = "destination";
            card.append(title, description, remove, plan, listControls);
            return card;
        }));

        flightsContainer.replaceChildren(...flights.map((flight) => buildSavedFlightCard(flight, renderSaved)));
        renderCustomLists(listsContainer, listStatus);
    }

    listForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const input = listForm.elements.nombre;
        const name = input.value.trim();
        if (!name) {
            listStatus.textContent = "Escribe un nombre para la lista.";
            return;
        }
        const lists = readCollection(STORAGE_KEYS.lists);
        if (lists.some((list) => list.name.toLocaleLowerCase("es") === name.toLocaleLowerCase("es"))) {
            listStatus.textContent = "Ya existe una lista con ese nombre.";
            return;
        }
        if (writeCollection(STORAGE_KEYS.lists, [...lists, { id: makeId("list"), name, items: [] }])) {
            input.value = "";
            renderSaved();
            listStatus.textContent = `Lista "${name}" creada.`;
        }
    });

    container.addEventListener("click", (event) => {
        const button = event.target.closest('button[data-action="agregar-lista"]');
        if (!button) return;
        const wrapper = button.closest(".agregar-lista");
        const listId = wrapper.querySelector("select").value;
        const card = button.closest(".tarjeta-destino");
        const destination = readCollection(STORAGE_KEYS.saved).find((item) => item.id === card.dataset.destinationId);
        if (!destination) return;
        if (!listId) {
            showNotice("Selecciona una lista o crea una nueva.", true);
            return;
        }
        addItemToList(listId, { type: "destination", id: destination.id, label: getDestinationName(destination), item: destination });
        renderSaved();
    });

    listsContainer.addEventListener("click", (event) => {
        const deleteList = event.target.closest("[data-delete-list]");
        if (deleteList) {
            const lists = readCollection(STORAGE_KEYS.lists).filter((list) => list.id !== deleteList.dataset.deleteList);
            if (writeCollection(STORAGE_KEYS.lists, lists)) renderSaved();
            return;
        }
        const removeItem = event.target.closest("[data-remove-list-item]");
        if (removeItem) {
            const lists = readCollection(STORAGE_KEYS.lists);
            const list = lists.find((item) => item.id === removeItem.dataset.listId);
            if (!list) return;
            list.items = list.items.filter((item) => item.id !== removeItem.dataset.removeListItem);
            if (writeCollection(STORAGE_KEYS.lists, lists)) renderSaved();
            return;
        }
        const addButton = event.target.closest('button[data-action="agregar-lista"]');
        if (addButton) {
            const card = addButton.closest("[data-list-id]");
            const listId = card.dataset.listId;
            const selection = card.querySelector("select").value;
            const [type, id] = selection.split(":");
            const item = type === "flight"
                ? readCollection(STORAGE_KEYS.flights).find((flight) => flight.id === id)
                : readCollection(STORAGE_KEYS.saved).find((destination) => destination.id === id);
            if (!item) {
                showNotice("Guarda primero el elemento que deseas agregar a una lista.", true);
                return;
            }
            addItemToList(listId, {
                type,
                id,
                label: type === "flight" ? describeFlight(item) : getDestinationName(item),
                item
            });
            renderSaved();
        }
    });

    renderSaved();
}

function buildSavedListControls() {
    const wrapper = document.createElement("div");
    wrapper.className = "agregar-lista";
    const select = document.createElement("select");
    select.setAttribute("aria-label", "Seleccionar lista");
    readCollection(STORAGE_KEYS.lists).forEach((list) => {
        const option = document.createElement("option");
        option.value = list.id;
        option.textContent = list.name;
        select.append(option);
    });
    if (select.options.length === 0) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "Crea una lista abajo";
        select.append(option);
        select.disabled = true;
    }
    const button = makeActionButton("Agregar a lista", "agregar-lista");
    button.disabled = select.disabled;
    wrapper.append(select, button);
    return wrapper;
}

function renderCustomLists(container, status) {
    const lists = readCollection(STORAGE_KEYS.lists);
    const destinations = readCollection(STORAGE_KEYS.saved);
    const flights = readCollection(STORAGE_KEYS.flights);
    status.textContent = lists.length ? `${lists.length} lista(s). Puedes guardar destinos y búsquedas de vuelos.` : "Crea una lista para organizar tus destinos y búsquedas favoritas.";
    container.replaceChildren(...lists.map((list) => {
        const card = document.createElement("article");
        card.className = "tarjeta-destino tarjeta-lista";
        card.dataset.listId = list.id;
        const heading = document.createElement("h4");
        heading.textContent = list.name;
        const description = document.createElement("p");
        description.textContent = `${list.items.length} elemento(s)`;
        const select = document.createElement("select");
        select.setAttribute("aria-label", `Agregar un elemento a ${list.name}`);
        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "Agregar destino o vuelo guardado";
        select.append(placeholder);
        if (destinations.length) {
            const group = document.createElement("optgroup");
            group.label = "Destinos";
            destinations.forEach((destination) => {
                const option = document.createElement("option");
                option.value = `destination:${destination.id}`;
                option.textContent = getDestinationName(destination);
                group.append(option);
            });
            select.append(group);
        }
        if (flights.length) {
            const group = document.createElement("optgroup");
            group.label = "Búsquedas de vuelos";
            flights.forEach((flight) => {
                const option = document.createElement("option");
                option.value = `flight:${flight.id}`;
                option.textContent = describeFlight(flight);
                group.append(option);
            });
            select.append(group);
        }
        const addButton = makeActionButton("Agregar", "agregar-lista");
        const deleteButton = makeActionButton("Eliminar lista", "eliminar-lista");
        deleteButton.dataset.deleteList = list.id;
        const items = document.createElement("ul");
        items.className = "elementos-lista";
        list.items.forEach((item) => {
            const row = document.createElement("li");
            const label = document.createElement("span");
            label.textContent = `${item.type === "flight" ? "Vuelo" : "Destino"}: ${item.label}`;
            const remove = makeActionButton("Quitar", "quitar");
            remove.dataset.removeListItem = item.id;
            remove.dataset.listId = list.id;
            row.append(label, remove);
            items.append(row);
        });
        if (list.items.length === 0) {
            const empty = document.createElement("li");
            empty.textContent = "Esta lista todavía está vacía.";
            items.append(empty);
        }
        card.append(heading, description, select, addButton, deleteButton, items);
        return card;
    }));
}

function addItemToList(listId, item) {
    const lists = readCollection(STORAGE_KEYS.lists);
    const list = lists.find((entry) => entry.id === listId);
    if (!list) {
        showNotice("No se encontró la lista seleccionada.", true);
        return false;
    }
    if (list.items.some((entry) => entry.type === item.type && entry.id === item.id)) {
        showNotice("Ese elemento ya está en la lista.");
        return false;
    }
    list.items.push(item);
    if (!writeCollection(STORAGE_KEYS.lists, lists)) return false;
    showNotice("Elemento agregado a la lista.");
    return true;
}

function describeFlight(flight) {
    const dates = flight.departure
        ? `${flight.departure}${flight.returnDate ? ` a ${flight.returnDate}` : ""}`
        : "fechas por definir";
    return `${flight.origin} → ${flight.destination} · ${dates}`;
}

function buildSavedFlightCard(flight, rerender) {
    const card = document.createElement("article");
    card.className = "tarjeta-destino tarjeta-vuelo-guardado";
    const heading = document.createElement("h4");
    heading.textContent = describeFlight(flight);
    const details = document.createElement("p");
    details.textContent = `${flight.passengers || 1} viajero(s) · ${flight.cabin || "Clase por definir"} · Guardada ${formatDate((flight.createdAt || "").slice(0, 10))}${Number.isFinite(flight.distanceKm) ? ` · Distancia aproximada ${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(flight.distanceKm)} km` : ""}`;
    const notes = document.createElement("p");
    notes.textContent = flight.notes || "Sin notas adicionales.";
    const actions = document.createElement("div");
    actions.className = "acciones-destino";
    const edit = document.createElement("a");
    edit.className = "boton-punto";
    edit.href = `index.html#${encodeURIComponent(flight.id)}`;
    edit.textContent = "Editar plan";
    const remove = makeActionButton("Eliminar búsqueda", "eliminar");
    remove.addEventListener("click", () => {
        const flights = readCollection(STORAGE_KEYS.flights).filter((item) => item.id !== flight.id);
        if (writeCollection(STORAGE_KEYS.flights, flights)) rerender();
    });
    remove.textContent = "Eliminar plan";
    actions.append(edit, remove);
    card.append(heading, details, notes, actions);
    return card;
}

function formatDate(value) {
    if (!value) return "Sin definir";
    const [year, month, day] = value.split("-").map(Number);
    return new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "UTC" })
        .format(new Date(Date.UTC(year, month - 1, day)));
}

function tripDuration(startDate, endDate) {
    if (!startDate || !endDate) return "Sin definir";
    const start = Date.parse(`${startDate}T00:00:00Z`);
    const end = Date.parse(`${endDate}T00:00:00Z`);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return "Fechas por revisar";
    const days = Math.round((end - start) / 86400000) + 1;
    return `${days} día${days === 1 ? "" : "s"}`;
}

function getCoordinates(location) {
    const params = new URLSearchParams({
        name: location,
        count: "1",
        language: "es",
        format: "json"
    });
    return fetchJson(`https://geocoding-api.open-meteo.com/v1/search?${params}`)
        .then((data) => {
            const result = data.results?.[0];
            return result
                ? { latitude: result.latitude, longitude: result.longitude }
                : null;
        });
}

function getFlightPlanFromForm(form, routeEstimate) {
    const data = new FormData(form);
    const origin = data.get("origen").toString().trim();
    const destination = data.get("destino").toString().trim();
    const departure = data.get("fecha-ida").toString();
    const returnDate = form.elements["fecha-vuelta"].disabled
        ? ""
        : data.get("fecha-vuelta").toString();
    return {
        id: makeId("flight"),
        origin,
        destination,
        departure,
        returnDate,
        passengers: Math.min(9, Math.max(1, Number(data.get("pasajeros")) || 1)),
        cabin: data.get("clase").toString(),
        notes: data.get("notas").toString().trim(),
        ...(routeEstimate || {}),
        createdAt: new Date().toISOString()
    };
}

function saveFlightPlan(flight, flightIdToUpdate = "") {
    const flights = readCollection(STORAGE_KEYS.flights);
    const flightIndex = flights.findIndex((item) => item.id === flightIdToUpdate);
    if (flightIdToUpdate && flightIndex === -1) {
        showNotice("El plan que intentas editar ya no está guardado.", true);
        return false;
    }
    const duplicate = flights.find((item) =>
        item.id !== flightIdToUpdate
        && item.origin.toLocaleLowerCase("es") === flight.origin.toLocaleLowerCase("es")
        && item.destination.toLocaleLowerCase("es") === flight.destination.toLocaleLowerCase("es")
        && item.departure === flight.departure
        && item.returnDate === flight.returnDate
        && item.passengers === flight.passengers
        && item.cabin === flight.cabin
        && (item.notes || "") === flight.notes
    );
    if (duplicate) {
        showNotice("Ese plan ya está guardado en tu libreta.");
        return false;
    }
    const savedFlight = flightIndex === -1
        ? flight
        : { ...flight, id: flightIdToUpdate, createdAt: flights[flightIndex].createdAt };
    const updatedFlights = flightIndex === -1
        ? [...flights, savedFlight]
        : flights.map((item, index) => index === flightIndex ? savedFlight : item);
    if (!writeCollection(STORAGE_KEYS.flights, updatedFlights)) return false;
    showNotice(flightIndex === -1
        ? "Plan de vuelo guardado en este dispositivo. No se ha realizado ninguna reserva."
        : "Plan actualizado en este dispositivo. No se ha realizado ninguna reserva.");
    return true;
}

function calculateAirDistance(first, second) {
    const radians = (degrees) => degrees * Math.PI / 180;
    const latitudeDifference = radians(second.latitude - first.latitude);
    const longitudeDifference = radians(second.longitude - first.longitude);
    const haversine = Math.sin(latitudeDifference / 2) ** 2
        + Math.cos(radians(first.latitude)) * Math.cos(radians(second.latitude))
        * Math.sin(longitudeDifference / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

async function estimateFlightRoute(origin, destination) {
    const [originCoordinates, destinationCoordinates] = await Promise.all([
        getCoordinates(origin),
        getCoordinates(destination)
    ]);
    if (!originCoordinates || !destinationCoordinates) {
        throw new Error("No se pudo encontrar una de las ciudades. Revisa el nombre e inténtalo de nuevo.");
    }

    const distanceKm = calculateAirDistance(originCoordinates, destinationCoordinates);
    const durationMinutes = Math.round(distanceKm / 800 * 60);
    let weather = "Clima no disponible";
    try {
        const url = new URL("https://api.open-meteo.com/v1/forecast");
        url.search = new URLSearchParams({
            latitude: destinationCoordinates.latitude,
            longitude: destinationCoordinates.longitude,
            current: "temperature_2m,weather_code",
            timezone: "auto"
        });
        const data = await fetchJson(url);
        if (typeof data.current?.temperature_2m === "number") {
            weather = `${weatherDescription(data.current.weather_code)} · ${Math.round(data.current.temperature_2m)} °C`;
        }
    } catch (error) {
        console.error(`No se pudo consultar el clima de ${destination}.`, error);
    }

    return {
        distanceKm,
        durationMinutes,
        originCoordinates,
        destinationCoordinates,
        weather
    };
}

function initPlanner() {
    const form = document.querySelector("#formularioViaje");
    const list = document.querySelector("#contenedorViajes");
    const activityForm = document.querySelector("#formularioActividad");
    const activitiesList = document.querySelector("#listaActividades");
    const flights = document.querySelector("#contenedorVuelos");
    if (!form || !list || !activityForm || !activitiesList || !flights) return;

    const startInput = form.elements.salida;
    const endInput = form.elements.regreso;
    const activityDate = activityForm.elements.fecha;
    const today = new Date();
    const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    startInput.min = todayString;
    endInput.min = todayString;
    activityDate.min = todayString;
    startInput.addEventListener("change", () => {
        endInput.min = startInput.value || todayString;
        if (endInput.value && endInput.value < endInput.min) endInput.value = "";
    });

    let trips = readCollection(STORAGE_KEYS.trips);
    let selectedId = "";
    const coordinatesCache = new Map();
    const routeEstimates = new Map();

    function cachedCoordinates(location) {
        const key = location.toLocaleLowerCase("es");
        if (!coordinatesCache.has(key)) coordinatesCache.set(key, getCoordinates(location));
        return coordinatesCache.get(key);
    }

    async function renderRouteEstimate(trip, element) {
        const destinationName = trip.destinationData?.capital
            ? `${trip.destinationData.capital}, ${trip.destination}`
            : trip.destination;
        try {
            const [origin, destination] = await Promise.all([
                cachedCoordinates(trip.origin || "Bogotá"),
                cachedCoordinates(destinationName)
            ]);
            if (!element.isConnected || selectedId !== trip.id) return;
            if (!origin || !destination) {
                element.textContent = "No se encontraron ubicaciones suficientes para estimar la distancia.";
                return;
            }
            const distance = calculateAirDistance(origin, destination);
            const totalMinutes = Math.round(distance / 800 * 60);
            routeEstimates.set(trip.id, {
                distanceKm: distance,
                durationMinutes: totalMinutes,
                originCoordinates: origin,
                destinationCoordinates: destination
            });
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            const duration = hours ? `${hours} h ${minutes} min` : `${minutes} min`;
            element.textContent = distance < 1
                ? "El origen y el destino parecen ser el mismo lugar."
                : `Distancia aérea aproximada: ${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(distance)} km · vuelo directo estimado a 800 km/h: ${duration}. No incluye escalas ni tiempos en aeropuerto.`;
        } catch (error) {
            console.error(`No se pudo estimar el recorrido de ${trip.origin} a ${trip.destination}.`, error);
            if (element.isConnected && selectedId === trip.id) {
                element.textContent = "No se pudo estimar la distancia en este momento.";
            }
        }
    }

    function renderTrips() {
        trips = readCollection(STORAGE_KEYS.trips);
        list.replaceChildren();
        trips.forEach((trip) => {
            const item = document.createElement("div");
            item.className = "viaje-item";
            const select = document.createElement("button");
            select.type = "button";
            select.className = "viaje-seleccionar";
            select.dataset.tripId = trip.id;
            select.setAttribute("aria-pressed", String(trip.id === selectedId));
            select.textContent = trip.name;
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "viaje-eliminar";
            remove.dataset.removeTrip = trip.id;
            remove.setAttribute("aria-label", `Eliminar ${trip.name}`);
            remove.textContent = "×";
            item.append(select, remove);
            list.append(item);
        });
        if (!trips.some((trip) => trip.id === selectedId)) selectedId = trips[0]?.id || "";
        renderTripDetails();
        list.querySelectorAll(".viaje-seleccionar").forEach((button) => {
            button.setAttribute("aria-pressed", String(button.dataset.tripId === selectedId));
        });
    }

    function renderTripDetails() {
        const trip = trips.find((item) => item.id === selectedId);
        const title = document.querySelector("#destinoSeleccionado");
        const info = document.querySelector("#informacionViaje");
        const state = document.querySelector("#estadoViaje");
        const route = document.querySelector("#rutaViaje");
        const departure = document.querySelector("#fechaSalida");
        const returnDate = document.querySelector("#fechaRegreso");
        const duration = document.querySelector("#duracionViaje");
        const summary = document.querySelector("#resumenViaje");

        if (!trip) {
            title.textContent = "Selecciona un destino";
            info.textContent = "Todavía no has agregado ningún viaje.";
            state.textContent = "Sin planificar";
            route.replaceChildren(messageParagraph("Crea un viaje o añádelo desde Destinos."));
            flights.replaceChildren(messageParagraph("Consulta opciones de vuelo para las fechas de tu viaje."));
            departure.textContent = "--";
            returnDate.textContent = "--";
            duration.textContent = "--";
            summary.replaceChildren(messageParagraph("Selecciona un viaje para ver su resumen."));
            activityDate.disabled = true;
            activityForm.querySelector('button[type="submit"]').disabled = true;
            activitiesList.replaceChildren(messageParagraph("Selecciona un viaje para organizar sus actividades."));
            return;
        }

        title.textContent = trip.destination;
        info.textContent = `${trip.origin || "Origen pendiente"} · ${trip.passengers || 1} viajero(s)`;
        state.textContent = trip.startDate && trip.endDate
            ? "Fechas definidas"
            : trip.startDate || trip.endDate
                ? "Fechas parciales"
                : "Por completar";
        const estimate = document.createElement("p");
        estimate.className = "estimacion-ruta";
        estimate.textContent = "Calculando distancia aérea aproximada…";
        route.replaceChildren(estimate);
        renderRouteEstimate(trip, estimate);

        const saveFlight = makeActionButton("Guardar trayecto en mi libreta", "guardar-trayecto");
        const flightNote = document.createElement("p");
        flightNote.className = "nota-busqueda";
        flightNote.textContent = "Este es un apunte personal del trayecto, no una búsqueda de disponibilidad ni una reserva.";
        flights.replaceChildren(saveFlight, flightNote);

        departure.textContent = formatDate(trip.startDate);
        returnDate.textContent = formatDate(trip.endDate);
        duration.textContent = tripDuration(trip.startDate, trip.endDate);
        const summaryText = document.createElement("p");
        const summaryParts = [
            `${trip.name}: salida desde ${trip.origin || "por definir"} hacia ${trip.destination}.`,
            trip.startDate ? `Salida: ${formatDate(trip.startDate)}.` : "Agrega las fechas para completar el plan.",
            `Viajeros: ${trip.passengers || 1}.`,
            trip.budget ? `Presupuesto estimado: ${new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(trip.budget))}.` : "",
            trip.comments ? `Notas: ${trip.comments}` : ""
        ];
        summaryText.textContent = summaryParts.filter(Boolean).join(" ");
        summary.replaceChildren(summaryText);

        activityDate.disabled = false;
        activityForm.querySelector('button[type="submit"]').disabled = false;
        activityDate.min = trip.startDate || todayString;
        activityDate.max = trip.endDate || "";
        renderActivities(trip);
    }

    function messageParagraph(text) {
        const paragraph = document.createElement("p");
        paragraph.className = "mensaje-vacio";
        paragraph.textContent = text;
        return paragraph;
    }

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const data = new FormData(form);
        const startDate = data.get("salida").toString();
        const endDate = data.get("regreso").toString();
        if (startDate && endDate && endDate < startDate) {
            showNotice("La fecha de regreso debe ser igual o posterior a la salida.", true);
            return;
        }
        const trip = addTrip({
            name: data.get("nombre").toString().trim(),
            origin: data.get("origen").toString().trim(),
            destination: data.get("destino").toString().trim(),
            startDate,
            endDate,
            passengers: Number(data.get("viajeros")) || 1,
            budget: data.get("presupuesto").toString(),
            comments: data.get("comentarios").toString().trim(),
            activities: []
        });
        if (trip) {
            form.reset();
            form.elements.origen.value = "Bogotá";
            selectedId = trip.id;
            renderTrips();
            showNotice("Viaje creado y guardado en este dispositivo.");
        }
    });

    function renderActivities(trip) {
        const activities = [...(trip.activities || [])].sort((a, b) => a.date.localeCompare(b.date));
        if (activities.length === 0) {
            activitiesList.replaceChildren(messageParagraph("Todavía no hay actividades en este itinerario."));
            return;
        }
        activitiesList.replaceChildren(...activities.map((activity) => {
            const item = document.createElement("article");
            item.className = "actividad-item";
            const heading = document.createElement("h4");
            heading.textContent = `${formatDate(activity.date)} · ${activity.name}`;
            const description = document.createElement("p");
            description.textContent = activity.place || "Sin notas adicionales.";
            const remove = makeActionButton("Quitar actividad", "eliminar-actividad");
            remove.dataset.activityId = activity.id;
            item.append(heading, description, remove);
            return item;
        }));
    }

    activityForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const trip = trips.find((item) => item.id === selectedId);
        if (!trip) {
            showNotice("Primero crea o selecciona un viaje.", true);
            return;
        }
        const data = new FormData(activityForm);
        const date = data.get("fecha").toString();
        if ((trip.startDate && date < trip.startDate) || (trip.endDate && date > trip.endDate)) {
            showNotice("La actividad debe estar dentro de las fechas del viaje.", true);
            return;
        }
        const activity = {
            id: makeId("activity"),
            date,
            name: data.get("actividad").toString().trim(),
            place: data.get("lugar").toString().trim()
        };
        const updatedTrips = readCollection(STORAGE_KEYS.trips).map((item) => item.id === trip.id
            ? { ...item, activities: [...(item.activities || []), activity] }
            : item);
        if (writeCollection(STORAGE_KEYS.trips, updatedTrips)) {
            activityForm.reset();
            trips = updatedTrips;
            renderTrips();
            showNotice("Actividad agregada al itinerario.");
        }
    });

    activitiesList.addEventListener("click", (event) => {
        const button = event.target.closest("[data-activity-id]");
        if (!button) return;
        const updatedTrips = readCollection(STORAGE_KEYS.trips).map((trip) => trip.id === selectedId
            ? { ...trip, activities: (trip.activities || []).filter((activity) => activity.id !== button.dataset.activityId) }
            : trip);
        if (writeCollection(STORAGE_KEYS.trips, updatedTrips)) {
            trips = updatedTrips;
            renderTrips();
            showNotice("Actividad eliminada.");
        }
    });

    flights.addEventListener("click", (event) => {
        const button = event.target.closest('[data-action="guardar-trayecto"]');
        if (!button) return;
        const trip = trips.find((item) => item.id === selectedId);
        if (!trip) return;
        saveFlightPlan({
            id: makeId("flight"),
            origin: trip.origin || "Bogotá",
            destination: trip.destination,
            departure: trip.startDate || "",
            returnDate: trip.endDate || "",
            passengers: trip.passengers || 1,
            cabin: trip.cabin || "Por definir",
            notes: trip.comments || "",
            ...(routeEstimates.get(trip.id) || {}),
            createdAt: new Date().toISOString()
        });
    });

    list.addEventListener("click", (event) => {
        const removeButton = event.target.closest("[data-remove-trip]");
        if (removeButton) {
            const remaining = trips.filter((trip) => trip.id !== removeButton.dataset.removeTrip);
            if (writeCollection(STORAGE_KEYS.trips, remaining)) {
                if (selectedId === removeButton.dataset.removeTrip) selectedId = "";
                renderTrips();
            }
            return;
        }
        const selectButton = event.target.closest("[data-trip-id]");
        if (selectButton) {
            selectedId = selectButton.dataset.tripId;
            renderTrips();
        }
    });

    renderTrips();
    const requestedId = window.location.hash.slice(1);
    if (requestedId && trips.some((trip) => trip.id === requestedId)) {
        selectedId = requestedId;
        renderTrips();
    }
}

function initFlightSearch() {
    const form = document.querySelector("#formularioVuelos");
    const saveButton = document.querySelector("#guardarBusquedaVuelo");
    const searchButton = form?.querySelector('button[type="submit"]');
    const result = document.querySelector("#resultadoTrayecto");
    if (!form || !saveButton || !searchButton || !result) return;
    const departure = form.elements["fecha-ida"];
    const returnDate = form.elements["fecha-vuelta"];
    const tripType = form.querySelectorAll('input[name="tipo-viaje"]');
    let routeEstimate = null;
    let editingFlightId = "";
    const today = new Date();
    const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    departure.min = todayString;
    returnDate.min = todayString;

    function updateTripDates() {
        const isRoundTrip = form.querySelector('input[name="tipo-viaje"]:checked').value === "ida-vuelta";
        returnDate.required = isRoundTrip;
        returnDate.disabled = !isRoundTrip;
        returnDate.min = departure.value || todayString;
        if (returnDate.disabled) returnDate.value = "";
        else if (returnDate.value && returnDate.value < returnDate.min) returnDate.value = "";
    }
    tripType.forEach((input) => input.addEventListener("change", updateTripDates));
    departure.addEventListener("change", updateTripDates);
    updateTripDates();

    function validateDates() {
        if (!returnDate.disabled && returnDate.value && departure.value && returnDate.value < departure.value) {
            showNotice("La fecha de regreso debe ser igual o posterior a la salida.", true);
            return false;
        }
        return true;
    }

    saveButton.addEventListener("click", () => {
        if (!form.reportValidity()) return;
        if (!validateDates()) return;
        const data = new FormData(form);
        const sameRoute = routeEstimate
            && routeEstimate.origin.toLocaleLowerCase("es") === data.get("origen").toString().trim().toLocaleLowerCase("es")
            && routeEstimate.destination.toLocaleLowerCase("es") === data.get("destino").toString().trim().toLocaleLowerCase("es");
        if (saveFlightPlan(getFlightPlanFromForm(form, sameRoute ? routeEstimate.estimate : null), editingFlightId)) {
            editingFlightId = "";
            window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
        }
    });

    form.addEventListener("input", (event) => {
        if (event.target.name === "origen" || event.target.name === "destino") {
            routeEstimate = null;
            result.replaceChildren();
        }
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!form.reportValidity() || !validateDates()) return;
        const data = new FormData(form);
        const origin = data.get("origen").toString().trim();
        const destination = data.get("destino").toString().trim();
        const submitLabel = searchButton.textContent;
        searchButton.disabled = true;
        searchButton.textContent = "Consultando APIs gratuitas…";
        result.textContent = "Buscando las ciudades y calculando una distancia aproximada…";
        try {
            const estimate = await estimateFlightRoute(origin, destination);
            routeEstimate = { origin, destination, estimate };
            const hours = Math.floor(estimate.durationMinutes / 60);
            const minutes = estimate.durationMinutes % 60;
            const duration = hours ? `${hours} h ${minutes} min` : `${minutes} min`;
            result.textContent = `Trayecto ${origin} → ${destination}: ${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 }).format(estimate.distanceKm)} km en línea recta. Tiempo teórico a 800 km/h: ${duration}. Clima actual en destino: ${estimate.weather}. Esto no es un horario, una oferta ni una reserva.`;
        } catch (error) {
            routeEstimate = null;
            console.error("No se pudo calcular el trayecto con Open-Meteo.", error);
            result.textContent = error.message || "No se pudo calcular el trayecto. Comprueba tu conexión e inténtalo de nuevo.";
            showNotice("No fue posible consultar las ciudades. Revisa los datos o inténtalo más tarde.", true);
        } finally {
            searchButton.disabled = false;
            searchButton.textContent = submitLabel;
        }
    });

    const encodedFlightId = window.location.hash.slice(1);
    let requestedFlightId = encodedFlightId;
    try {
        requestedFlightId = decodeURIComponent(encodedFlightId);
    } catch (error) {
        console.error("El enlace al plan contiene un identificador no válido.", error);
        showNotice("No se pudo cargar el plan porque el enlace no es válido.", true);
    }
    const requestedFlight = readCollection(STORAGE_KEYS.flights)
        .find((flight) => flight.id === requestedFlightId);
    if (requestedFlight) {
        editingFlightId = requestedFlight.id;
        form.elements.origen.value = requestedFlight.origin;
        form.elements.destino.value = requestedFlight.destination;
        form.elements["fecha-ida"].value = requestedFlight.departure || "";
        form.elements["fecha-vuelta"].value = requestedFlight.returnDate || "";
        form.elements.pasajeros.value = requestedFlight.passengers || 1;
        form.elements.clase.value = requestedFlight.cabin || "Economy";
        form.elements.notas.value = requestedFlight.notes || "";
        const isRoundTrip = Boolean(requestedFlight.returnDate);
        form.querySelector(`input[name="tipo-viaje"][value="${isRoundTrip ? "ida-vuelta" : "solo-ida"}"]`).checked = true;
        updateTripDates();
        if (Number.isFinite(requestedFlight.distanceKm)) {
            routeEstimate = {
                origin: requestedFlight.origin,
                destination: requestedFlight.destination,
                estimate: requestedFlight
            };
        }
        result.textContent = "Plan cargado desde Guardados. Guarda los cambios para actualizar este apunte.";
    }
}

const page = document.body.dataset.page;
if (page === "inicio") initFlightSearch();
if (page === "destinos") initDestinations();
if (page === "guardados") initSavedDestinations();
if (page === "planificador") initPlanner();
