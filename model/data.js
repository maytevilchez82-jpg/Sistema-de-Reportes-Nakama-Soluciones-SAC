//datos//
window.APP_MODEL = {
    inventoryBySheet: {
        Principal: {
            columns: [
                "Empleado",
                "Equipo",
                "Marca",
                "Fecha de devolución",
                "Descripción del problema",
                "Acción tomada",
                "Fecha que se le entregó uno nuevo",
                "Estado"
            ],
            fieldMap: {
                empleado: "Empleado",
                equipo: "Equipo",
                marca: "Marca",
                fechaDevolucion: "Fecha de devolución",
                descripcionProblema: "Descripción del problema",
                accionTomada: "Acción tomada",
                fechaEntregaNuevo: "Fecha que se le entregó uno nuevo",
                estado: "Estado"
            },
            rows: [
                {
                    Empleado: "Cecy Salcedo Aranda",
                    Equipo: "Cargador de laptop USB-C",
                    Marca: "Lenovo",
                    "Fecha de devolución": "2026-03-27",
                    "Descripción del problema": "El cargador no suministra energía correctamente",
                    "Acción tomada": "Se entregó un cargador en correcto funcionamiento",
                    "Fecha que se le entregó uno nuevo": "2026-03-27",
                    Estado: "Resuelto"
                },
                {
                    Empleado: "Pedro Hernandez",
                    Equipo: "Cargador de laptop USB-C",
                    Marca: "Lenovo",
                    "Fecha de devolución": "2026-04-13",
                    "Descripción del problema": "Falla reportada en el cargador de laptop",
                    "Acción tomada": "Se entregó un cargador en correcto funcionamiento",
                    "Fecha que se le entregó uno nuevo": "2026-04-13",
                    Estado: "Resuelto"
                },
                {
                    Empleado: "Pedro Hernandez",
                    Equipo: "Cargador de laptop USB-C",
                    Marca: "Lenovo",
                    "Fecha de devolución": "2026-04-21",
                    "Descripción del problema": "Falla reportada en el cargador de laptop",
                    "Acción tomada": "Se entregó un cargador en correcto funcionamiento con caja",
                    "Fecha que se le entregó uno nuevo": "2026-04-21",
                    Estado: "Resuelto"
                }
            ]
        }
    },
    activeInventorySheet: "Principal",
    reportes: []
};
