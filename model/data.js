/**
 * =============================================================================
 * ARCHIVO: model/data.js
 * CAPA:   Modelo (datos iniciales)
 * =============================================================================
 * Qué es:     Almacena la estructura base del inventario antes de cargar un Excel.
 * Para qué:  Define columnas, mapeo de campos y filas de ejemplo en memoria.
 * Quién lo usa: controller/app.js lee y escribe en window.APP_MODEL.
 * =============================================================================
 */

// Objeto global del modelo — toda la app consulta estos datos
window.APP_MODEL = {

    // Inventario organizado por hojas (como pestañas de Excel)
    inventoryBySheet: {

        // Hoja principal con datos de demostración
        Principal: {

            // Nombres de columnas que se muestran en la tabla
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

            // Relación entre nombre interno del código y columna del Excel
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

            // Filas de ejemplo (se reemplazan al importar un Excel real)
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

    // Nombre de la hoja activa en el panel Inventario
    activeInventorySheet: "Principal",

    // Datos derivados para el panel Reporte (se generan desde el inventario)
    reportes: []
};
