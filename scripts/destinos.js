// Estos son puntos de interés de ejemplo con valores definidos por nosotros.
const puntosInteres = [
    // Punto 1: la entrada a la Torre Eiffel tiene un valor estimado.
    {
        id: "torre-eiffel",
        nombre: "Torre Eiffel",
        ciudad: "París",
        pais: "Francia",
        categoria: "Monumento",
        descripcion: "Un lugar emblemático para disfrutar de las vistas de París.",
        precio: "$ 120.000 COP",
        mejorEpoca: "Abril a junio"
    },
    // Punto 2: el Museo del Louvre tiene un precio de entrada definido.
    {
        id: "museo-louvre",
        nombre: "Museo del Louvre",
        ciudad: "París",
        pais: "Francia",
        categoria: "Museo",
        descripcion: "Un museo famoso por sus obras de arte y su arquitectura.",
        precio: "$ 90.000 COP",
        mejorEpoca: "Marzo a mayo"
    },
    // Punto 3: el Coliseo es una visita histórica en Roma.
    {
        id: "coliseo-romano",
        nombre: "Coliseo Romano",
        ciudad: "Roma",
        pais: "Italia",
        categoria: "Historia",
        descripcion: "Un antiguo anfiteatro en el centro histórico de Roma.",
        precio: "$ 85.000 COP",
        mejorEpoca: "Abril a junio"
    },
    // Punto 4: la Ciudad Amurallada es un paseo de entrada libre.
    {
        id: "ciudad-amurallada",
        nombre: "Ciudad Amurallada",
        ciudad: "Cartagena",
        pais: "Colombia",
        categoria: "Centro histórico",
        descripcion: "Calles coloridas, plazas y murallas junto al mar Caribe.",
        precio: "Entrada libre",
        mejorEpoca: "Diciembre a abril"
    },
    // Punto 5: visitar el Cristo Redentor tiene un costo aproximado.
    {
        id: "cristo-redentor",
        nombre: "Cristo Redentor",
        ciudad: "Río de Janeiro",
        pais: "Brasil",
        categoria: "Monumento",
        descripcion: "Un monumento en la cima del cerro Corcovado.",
        precio: "$ 140.000 COP",
        mejorEpoca: "Mayo a octubre"
    },
    // Punto 6: Shibuya es un barrio que se puede recorrer sin pagar entrada.
    {
        id: "shibuya",
        nombre: "Cruce de Shibuya",
        ciudad: "Tokio",
        pais: "Japón",
        categoria: "Barrio",
        descripcion: "Una zona conocida por sus calles, tiendas y cruce peatonal.",
        precio: "Entrada libre",
        mejorEpoca: "Marzo a mayo"
    }
];

// Esta clave es la misma que utiliza la página Guardados.
const claveGuardadosDestinos = "fixerFlightDestinosGuardados";
const listaDestinos = document.querySelector("#listaDestinos");
const destinosGuardados = JSON.parse(localStorage.getItem(claveGuardadosDestinos) || "[]");

// Crea una tarjeta sencilla con los datos de cada punto de interés.
puntosInteres.forEach((destino) => {
    const tarjeta = document.createElement("article");
    tarjeta.className = "tarjeta-punto";

    const categoria = document.createElement("span");
    categoria.className = "categoria-punto";
    categoria.textContent = destino.categoria;

    const titulo = document.createElement("h3");
    titulo.textContent = destino.nombre;

    const lugar = document.createElement("p");
    lugar.textContent = `${destino.ciudad}, ${destino.pais}`;

    const descripcion = document.createElement("p");
    descripcion.textContent = destino.descripcion;

    const precio = document.createElement("p");
    precio.className = "dato-punto";
    precio.textContent = `Entrada aproximada: ${destino.precio}`;

    const mejorEpoca = document.createElement("p");
    mejorEpoca.className = "dato-punto";
    mejorEpoca.textContent = `Mejor época: ${destino.mejorEpoca}`;

    const botonGuardar = document.createElement("button");
    botonGuardar.className = "boton-punto";
    botonGuardar.type = "button";

    const yaEstaGuardado = destinosGuardados.some((item) => item.id === destino.id);
    botonGuardar.textContent = yaEstaGuardado ? "Ya está guardado" : "Guardar lugar";
    botonGuardar.disabled = yaEstaGuardado;

    // Al guardar, el lugar queda disponible en la página Guardados.
    botonGuardar.addEventListener("click", () => {
        const guardadosActuales = JSON.parse(localStorage.getItem(claveGuardadosDestinos) || "[]");
        const yaSeGuardo = guardadosActuales.some((item) => item.id === destino.id);

        if (!yaSeGuardo) {
            guardadosActuales.push(destino);
            localStorage.setItem(claveGuardadosDestinos, JSON.stringify(guardadosActuales));
        }

        botonGuardar.textContent = "Ya está guardado";
        botonGuardar.disabled = true;
    });

    tarjeta.append(categoria, titulo, lugar, descripcion, precio, mejorEpoca, botonGuardar);
    listaDestinos.appendChild(tarjeta);
});
