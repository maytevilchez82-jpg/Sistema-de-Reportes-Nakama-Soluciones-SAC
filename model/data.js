//datos//
window.APP_MODEL = {
    inventoryBySheet: {
        Principal: {
            columns: [
                'Empleado',
                'Equipo',
                'Marca',
                'Fecha de devolución',
                'Descripción del problema',
                'Acción tomada',
                'Fecha que se le entregó uno nuevo',
                'Estado'
            ],
            fieldMap: {
                empleado: 'Empleado',
                equipo: 'Equipo',
                marca: 'Marca',
                fechaDevolucion: 'Fecha de devolución',
                descripcion: 'Descripción del problema',
                accion: 'Acción tomada',
                fechaEntrega: 'Fecha que se le entregó uno nuevo',
                estado: 'Estado'
            },
            rows: [
                {
                    Empleado: 'Cecy Salcedo Aranda',
                    Equipo: 'Cargador de laptop USB-C',
                    Marca: 'Lenovo',
                    'Fecha de devolución': '3/27/2026',
                    'Descripción del problema': 'El cargador no suministra energía correctamente',
                    'Acción tomada': 'Se entregó un cargador en correcto funcionamiento',
                    'Fecha que se le entregó uno nuevo': '3/27/2026',
                    Estado: 'Resuelto'
                },
                {
                    Empleado: 'Pedro Hernandez',
                    Equipo: 'Cargador de laptop USB-C',
                    Marca: 'Lenovo',
                    'Fecha de devolución': '4/13/2026',
                    'Descripción del problema': 'Falla reportada en el cargador de laptop',
                    'Acción tomada': 'Se entregó un cargador en correcto funcionamiento.',
                    'Fecha que se le entregó uno nuevo': '4/13/2026',
                    Estado: 'Resuelto'
                },
                {
                    Empleado: 'Pedro Hernandez',
                    Equipo: 'Cargador de laptop USB-C',
                    Marca: 'Lenovo',
                    'Fecha de devolución': '4/21/2026',
                    'Descripción del problema': 'falla reportada en el cargador de laptop',
                    'Acción tomada': 'Se entregó un cargador en correcto funcionamiento con caja.',
                    'Fecha que se le entregó uno nuevo': '4/21/2026',
                    Estado: 'Resuelto'
                },
                {
                    Empleado: 'Carlos López',
                    Equipo: 'Laptop',
                    Marca: 'Dell',
                    'Fecha de devolución': '3/15/2026',
                    'Descripción del problema': 'Pantalla rota después de caída',
                    'Acción tomada': 'Se reparó la pantalla',
                    'Fecha que se le entregó uno nuevo': '3/20/2026',
                    Estado: 'Resuelto'
                },
                {
                    Empleado: 'Maria García',
                    Equipo: 'Laptop',
                    Marca: 'HP',
                    'Fecha de devolución': '4/05/2026',
                    'Descripción del problema': 'Batería no carga',
                    'Acción tomada': 'Se reemplazó la batería',
                    'Fecha que se le entregó uno nuevo': '4/08/2026',
                    Estado: 'Resuelto'
                },
                {
                    Empleado: 'Juan Martínez',
                    Equipo: 'Mouse',
                    Marca: 'Logitech',
                    'Fecha de devolución': '2/28/2026',
                    'Descripción del problema': 'El clic izquierdo no funciona',
                    'Acción tomada': 'Se entregó un mouse nuevo',
                    'Fecha que se le entregó uno nuevo': '3/01/2026',
                    Estado: 'Resuelto'
                },
                {
                    Empleado: 'Ana Rodríguez',
                    Equipo: 'Teclado',
                    Marca: 'Corsair',
                    'Fecha de devolución': '3/10/2026',
                    'Descripción del problema': 'Varias teclas no responden',
                    'Acción tomada': 'Se entregó un teclado nuevo',
                    'Fecha que se le entregó uno nuevo': '3/12/2026',
                    Estado: 'Resuelto'
                },
                {
                    Empleado: 'Luis Fernández',
                    Equipo: 'Monitor',
                    Marca: 'Samsung',
                    'Fecha de devolución': '4/02/2026',
                    'Descripción del problema': 'Pantalla con líneas',
                    'Acción tomada': 'Se reemplazó el monitor',
                    'Fecha que se le entregó uno nuevo': '4/05/2026',
                    Estado: 'Resuelto'
                },
                {
                    Empleado: 'Sofia Torres',
                    Equipo: 'Laptop',
                    Marca: 'Lenovo',
                    'Fecha de devolución': '4/18/2026',
                    'Descripción del problema': 'Fallo grave en el disco duro',
                    'Acción tomada': 'Se reemplazó el disco duro',
                    'Fecha que se le entregó uno nuevo': '4/22/2026',
                    Estado: 'Resuelto'
                },
                {
                    Empleado: 'Roberto Silva',
                    Equipo: 'Mouse',
                    Marca: 'Razer',
                    'Fecha de devolución': '4/10/2026',
                    'Descripción del problema': 'Rueda de scroll rota',
                    'Acción tomada': 'Se entregó un mouse nuevo',
                    'Fecha que se le entregó uno nuevo': '4/12/2026',
                    Estado: 'Resuelto'
                }
            ]
        }
    },
    activeInventorySheet: 'Principal',
    reportes: []
};
