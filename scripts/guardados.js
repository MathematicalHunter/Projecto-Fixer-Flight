// Esta clave permite que Destinos y Guardados compartan los mismos lugares.
const claveGuardados = "fixerFlightDestinosGuardados";
const listaGuardados = document.querySelector("#listaGuardados");
const mensajeVacio = document.querySelector("#mensajeVacio");

// Muestra en pantalla los lugares que se han guardado.
function mostrarGuardados() {
    const destinos = JSON.parse(localStorage.getItem(claveGuardados) || "[]");
    listaGuardados.innerHTML = "";

    mensajeVacio.hidden = destinos.length > 0;

    destinos.forEach((destino) => {
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

        const datos = document.createElement("p");
        datos.className = "dato-punto";
        datos.textContent = `Entrada aproximada: ${destino.precio}`;

        const botonQuitar = document.createElement("button");
        botonQuitar.className = "boton-punto boton-quitar";
        botonQuitar.type = "button";
        botonQuitar.textContent = "Quitar de guardados";

        // Al quitar un lugar, actualizamos la lista y volvemos a mostrarla.
        botonQuitar.addEventListener("click", () => {
            const destinosActualizados = destinos.filter((item) => item.id !== destino.id);
            localStorage.setItem(claveGuardados, JSON.stringify(destinosActualizados));
            mostrarGuardados();
        });

        tarjeta.append(categoria, titulo, lugar, descripcion, datos, botonQuitar);
        listaGuardados.appendChild(tarjeta);
    });
}

mostrarGuardados();
