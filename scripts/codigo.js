    // 1. Seleccionamos todos los enlaces del menú y todas las secciones
    const links = document.querySelectorAll('.nav-menu a[data-page]');
    const pages = document.querySelectorAll('.page');

    // 2. Escuchamos el clic en cada enlace
    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault(); // 🔑 evita que el navegador haga scroll o recargue

            const targetId = link.dataset.page; // "inicio", "destinos"...

            // 3. Ocultamos TODAS las secciones
            pages.forEach(p => p.classList.remove('active'));

            // 4. Mostramos solo la que queremos
            document.getElementById(targetId).classList.add('active');

            // 5. Opcional: marcar el enlace activo visualmente
            links.forEach(l => l.classList.remove('active-link'));
            link.classList.add('active-link');
        });
    });
