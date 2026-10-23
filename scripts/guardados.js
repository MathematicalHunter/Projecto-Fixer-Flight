(() => {
    const grid = document.querySelector("#rejillaGuardados");
    const searchInput = document.querySelector("#buscarGuardados");
    const countTotal = document.querySelector("#totalGuardados");
    const status = document.querySelector("#estadoResultados");
    const emptyState = document.querySelector("#sinResultados");
    const filterButtons = [...document.querySelectorAll(".filtro-tipo")];
    let cards = [...grid.querySelectorAll(".tarjeta-guardado")];
    let activeFilter = "todos";

    const normalize = (value) => value
        .toLocaleLowerCase("es")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    const update = () => {
        const searchTerm = normalize(searchInput.value.trim());
        let visibleCount = 0;

        cards.forEach((card) => {
            const matchesType = activeFilter === "todos" || card.dataset.tipo === activeFilter;
            const searchableText = normalize(`${card.dataset.busqueda} ${card.textContent}`);
            const matchesSearch = searchableText.includes(searchTerm);
            card.hidden = !matchesType || !matchesSearch;
            if (!card.hidden) visibleCount += 1;
        });

        countTotal.textContent = String(cards.length);
        filterButtons.forEach((button) => {
            const type = button.dataset.filtro;
            const count = type === "todos"
                ? cards.length
                : cards.filter((card) => card.dataset.tipo === type).length;
            button.querySelector("span").textContent = String(count);
        });

        emptyState.hidden = visibleCount > 0;
        if (visibleCount > 0) {
            status.textContent = `Se muestran ${visibleCount} ${visibleCount === 1 ? "opción" : "opciones"}.`;
        } else if (cards.length === 0) {
            status.textContent = "No tienes opciones guardadas.";
        } else {
            status.textContent = "No hay guardados que coincidan con esta búsqueda o filtro.";
        }
    };

    filterButtons.forEach((button) => {
        button.addEventListener("click", () => {
            activeFilter = button.dataset.filtro;
            filterButtons.forEach((filterButton) => {
                const isActive = filterButton === button;
                filterButton.classList.toggle("activo", isActive);
                filterButton.setAttribute("aria-pressed", String(isActive));
            });
            update();
        });
    });

    searchInput.addEventListener("input", update);

    grid.addEventListener("click", (event) => {
        const button = event.target.closest(".quitar-guardado");
        if (!button) return;

        const card = button.closest(".tarjeta-guardado");
        cards = cards.filter((savedCard) => savedCard !== card);
        card.remove();
        update();
    });

    update();
})();
