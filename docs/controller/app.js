function login() {
    let user = document.getElementById("usuario").value.trim();
    let pass = document.getElementById("password").value.trim();

    if (user === "admin" && pass === "admin") {
        document.getElementById("login-section").style.display = "none";
        document.getElementById("dashboard").style.display = "block";
    } else {
        alert("Usuario o contraseña incorrectos");
    }
}

// Variable global para el filtro de mes
let selectedMonth = '';

function filterReportesByMonth(month) {
    selectedMonth = month;
    renderReportes();
}

function logout() {
    document.getElementById("dashboard").style.display = "none";
    document.getElementById("login-section").style.display = "flex";

    document.getElementById("usuario").value = "";
    document.getElementById("password").value = "";
}

function showPanel(panelId) {
    const panels = ['inventory', 'analysis', 'alerts', 'reportes'];
    panels.forEach(id => {
        const panel = document.getElementById(`${id}-panel`);
        if (panel) {
            if (id === panelId) {
                panel.classList.remove('hidden');
            } else {
                panel.classList.add('hidden');
            }
        }
    });

    const navIds = ['inventory', 'analysis', 'alerts', 'reportes'];
    navIds.forEach(id => {
        const nav = document.getElementById(`nav-${id}`);
        if (nav) {
            if (id === panelId) {
                nav.classList.add('active');
            } else {
                nav.classList.remove('active');
            }
        }
    });

    // Renderizar el contenido del panel cuando se cambia
    if (panelId === 'alerts') {
        renderAlerts();
    } else if (panelId === 'reportes') {
        initializeCharts();
        renderReportes();
    } else if (panelId === 'analysis') {
        initializeCharts();
        renderAnalysis();
    } else if (panelId === 'inventory') {
        renderInventory();
    }
}

function getAlertsFromInventory() {
    const inventory = window.APP_MODEL && Array.isArray(window.APP_MODEL.inventory) ? window.APP_MODEL.inventory.filter(isInventoryRowFilled) : [];
    const alerts = [];

    if (!inventory.length) {
        alerts.push('No hay registros en el inventario');
        return alerts;
    }

    // Detectar casos sin resolver
    const unresolved = inventory.filter(item => {
        const estado = String(item.estado || '').toLowerCase();
        return !/resuelto|solucionado|entregado|ok/i.test(estado);
    });

    if (unresolved.length > 0) {
        alerts.push(`⚠ ${unresolved.length} caso(s) sin resolver`);
    }

    // Detectar casos críticos no resueltos
    const critical = unresolved.filter(item => {
        const desc = String(item.descripcion || '').toLowerCase();
        return /critico|urgente|prioritario|fallo grave|error|daño|rotura|no funciona/i.test(desc);
    });

    if (critical.length > 0) {
        alerts.push(`🔴 ${critical.length} caso(s) crítico(s) pendiente(s)`);
    }

    // Detectar tipos de equipo con alta tasa de fallos
    const typeStats = {};
    const now = new Date();
    let overdueCount = 0;

    inventory.forEach(item => {
        const type = String(item.equipo || 'Desconocido').trim() || 'Desconocido';
        const estado = String(item.estado || '').toLowerCase();
        const isResolved = /resuelto|solucionado|entregado|ok/i.test(estado);
        const date = parseDate(item.fechaDevolucion) || parseDate(item.fechaEntrega);

        if (!typeStats[type]) {
            typeStats[type] = { total: 0, fallos: 0, overdue: 0 };
        }
        typeStats[type].total += 1;
        if (!isResolved) {
            typeStats[type].fallos += 1;
        }
        if (date && daysBetween(date, now) >= 30 && !isResolved) {
            typeStats[type].overdue += 1;
            overdueCount += 1;
        }
    });

    // Alertar sobre tipos de equipo con > 50% de fallos
    Object.keys(typeStats).forEach(type => {
        const stats = typeStats[type];
        const failureRate = (stats.fallos / stats.total) * 100;
        if (failureRate > 50) {
            alerts.push(`⚠ Alta tasa de fallos en ${type} (${Math.round(failureRate)}%)`);
        }
    });

    // Alertar sobre casos vencidos
    if (overdueCount > 0) {
        alerts.push(`📅 ${overdueCount} caso(s) vencido(s) sin resolver (>30 días)`);
    }

    if (!alerts.length) {
        alerts.push('✓ No hay alertas urgentes en este momento');
    }

    return alerts;
}

function renderAlerts() {
    const list = document.querySelector('.alert-list');
    if (!list || !window.APP_MODEL) return;

    const alerts = getAlertsFromInventory();
    list.innerHTML = alerts.map(alert => `
        <div class="alert-card">
            <p>${alert}</p>
        </div>
    `).join('');
}

function generateReportesFromInventory() {
    const inventory = window.APP_MODEL && Array.isArray(window.APP_MODEL.inventory) ? window.APP_MODEL.inventory.filter(isInventoryRowFilled) : [];
    const reportes = [];
    
    inventory.forEach(item => {
        if (item.descripcion && item.descripcion.trim()) {
            const date = parseDate(item.fechaDevolucion) || parseDate(item.fechaEntrega) || new Date();
            reportes.push({
                empleado: String(item.empleado || '').trim() || 'N/A',
                producto: item.equipo || 'Desconocido',
                problema: item.descripcion,
                mes: date.getMonth() + 1,
                año: date.getFullYear(),
                fecha: date
            });
        }
    });
    
    if (!window.APP_MODEL) {
        window.APP_MODEL = {};
    }
    window.APP_MODEL.reportes = reportes;
}


function getFilteredReportes() {
    generateReportesFromInventory();
    let filtered = window.APP_MODEL.reportes || [];
    
    if (selectedMonth) {
        const monthNum = parseInt(selectedMonth, 10);
        const currentYear = new Date().getFullYear();
        filtered = filtered.filter(item => item.mes === monthNum && item.año === currentYear);
    }
    
    return filtered;
}

function renderReportes() {
    generateReportesFromInventory();
    const tbody = document.querySelector('.report-table tbody');
    if (!tbody || !window.APP_MODEL) return;

    const reportes = getFilteredReportes();
    tbody.innerHTML = reportes.map(item => `
        <tr>
            <td>${item.empleado || 'N/A'}</td>
            <td>${item.producto}</td>
            <td>${item.problema}</td>
        </tr>
    `).join('');
    renderReportChart();
}

function loadInventoryFromStorage() {
    const stored = localStorage.getItem('inventoryData');
    if (!stored) {
        if (!window.APP_MODEL) {
            window.APP_MODEL = {};
        }
        window.APP_MODEL.inventory = [];
        return;
    }

    try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
            if (!window.APP_MODEL) {
                window.APP_MODEL = {};
            }
            window.APP_MODEL.inventory = parsed;
        } else {
            if (!window.APP_MODEL) {
                window.APP_MODEL = {};
            }
            window.APP_MODEL.inventory = [];
        }
    } catch (error) {
        console.warn('Error leyendo inventoryData desde localStorage', error);
        if (!window.APP_MODEL) {
            window.APP_MODEL = {};
        }
        window.APP_MODEL.inventory = [];
    }
}

function saveInventoryToStorage() {
    if (!window.APP_MODEL || !window.APP_MODEL.inventory) return;
    try {
        localStorage.setItem('inventoryData', JSON.stringify(window.APP_MODEL.inventory));
    } catch (error) {
        console.warn('Error guardando inventoryData en localStorage', error);
    }
}

function updateInventoryItem(index, field, value) {
    if (!window.APP_MODEL || !window.APP_MODEL.inventory) return;
    const row = window.APP_MODEL.inventory[index];
    if (!row || !(field in row)) return;
    row[field] = value;
    saveInventoryToStorage();
    
    // Actualizar todos los paneles en cascada
    setTimeout(() => {
        renderMetrics();
        renderAnalysis();
        renderAlerts();
        renderReportes();
        updateAnalysisCharts();
    }, 100);
}


let analysisTrendChart = null;
let analysisTypeChart = null;
let reportChart = null;
const analysisTypeColors = ['#e17055', '#6c5ce7', '#74b9ff', '#00b894', '#00d2d3'];

function formatMonthShortEs(date) {
    // Ej: "ene", "feb" → "Ene", "Feb"; también elimina el punto si el navegador lo añade.
    const raw = date.toLocaleString('es-ES', { month: 'short' }).replace('.', '').trim();
    if (!raw) return '';
    return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function renderTypeLegend(labels, colors) {
    const legend = document.getElementById('analysis-type-legend');
    if (!legend) return;

    legend.innerHTML = labels.map((label, index) => {
        const color = colors[index] || '#ccc';
        return `
            <li><span class="legend-color" style="background:${color}"></span>${label}</li>
        `;
    }).join('');
}

function buildTrendData() {
    const inventory = window.APP_MODEL && Array.isArray(window.APP_MODEL.inventory) ? window.APP_MODEL.inventory.filter(isInventoryRowFilled) : [];
    const now = new Date();
    const labels = [];
    const counts = [];

    for (let offset = 5; offset >= 0; offset--) {
        const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
        labels.push(formatMonthShortEs(date));
        counts.push(0);
    }

    inventory.forEach(item => {
        // Para tendencia usamos la fecha del evento de falla (devolución/reporte).
        // Si no existe, usamos entrega como fallback.
        const date = parseDate(item.fechaDevolucion) || parseDate(item.fechaEntrega);
        if (!date) return;
        const monthsDiff = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
        if (monthsDiff >= 0 && monthsDiff < 6) {
            const index = 5 - monthsDiff;
            // Tendencia de fallos históricos: cada fila representa un evento registrado en el Excel.
            counts[index] += 1;
        }
    });

    const prediction = predictNextFailureCount(counts);
    const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextLabel = formatMonthShortEs(nextDate);

    return {
        labels: labels.concat([nextLabel]),
        counts: counts.concat([prediction.count]),
        predictionLabel: nextLabel,
        predictionCount: prediction.count,
        predictionReason: prediction.reason
    };
}

function predictNextFailureCount(counts) {
    const values = counts.slice();
    const n = values.length;
    if (n === 0) {
        return { count: 0, reason: 'No hay datos históricos suficientes.' };
    }
    const total = values.reduce((a, b) => a + b, 0);
    if (total === 0) {
        return { count: 0, reason: 'No hay fallos registrados en los últimos 6 meses.' };
    }

    const sumX = values.reduce((sum, _, index) => sum + index, 0);
    const sumY = values.reduce((sum, value) => sum + value, 0);
    const meanX = sumX / n;
    const meanY = sumY / n;
    let numerator = 0;
    let denominator = 0;

    values.forEach((value, index) => {
        numerator += (index - meanX) * (value - meanY);
        denominator += Math.pow(index - meanX, 2);
    });

    const slope = denominator === 0 ? 0 : numerator / denominator;
    const lastValue = values[n - 1];
    let predicted = Math.round(lastValue + slope);

    if (predicted < 0) predicted = 0;
    // Si hay historial (total>0) y el último mes tuvo fallos, evitamos caer a 0 por ruido.
    if (predicted === 0 && lastValue > 0) predicted = Math.max(1, lastValue);

    const direction = slope > 0 ? 'aumentando' : slope < 0 ? 'disminuyendo' : 'estable';
    const reason = `Tendencia ${direction} sobre los últimos 6 meses.`;

    return { count: predicted, reason };
}

const EQUIPMENT_TYPES = [
    'Cargador de laptop USB-C',
    'Laptop',
    'Mouse',
    'Teclado',
    'Monitor'
];

function buildTypeDistribution() {
    const inventory = window.APP_MODEL && Array.isArray(window.APP_MODEL.inventory) ? window.APP_MODEL.inventory.filter(isInventoryRowFilled) : [];
    
    // Distribución histórica de eventos registrados en el Excel por tipo de equipo.
    const failureCounts = {};
    EQUIPMENT_TYPES.forEach(type => {
        failureCounts[type] = 0;
    });

    inventory.forEach(item => {
        const type = String(item.equipo || '').trim();
        
        // Si el equipo no está en la lista predefinida, ignorarlo para el gráfico
        if (EQUIPMENT_TYPES.includes(type)) {
            failureCounts[type] += 1;
        }
    });

    const labels = EQUIPMENT_TYPES.filter(t => failureCounts[t] > 0);
    const data = labels.map(t => failureCounts[t]);
    if (!labels.length) {
        return { labels: ['Sin datos'], data: [1] };
    }

    return { 
        labels,
        data
    };
}

function buildReportChartData() {
    const reports = getFilteredReportes();
    const counts = {};
    reports.forEach(item => {
        const product = String(item.producto || 'Desconocido').trim() || 'Desconocido';
        counts[product] = (counts[product] || 0) + 1;
    });

    const labels = Object.keys(counts).slice(0, 5);
    const data = labels.map(label => counts[label]);
    return { labels, data };
}

function initializeCharts() {
    const trendCtx = document.getElementById('analysis-trend-chart');
    const typeCtx = document.getElementById('analysis-type-chart');
    const reportCtx = document.getElementById('report-chart');

    if (trendCtx && !analysisTrendChart) {
        analysisTrendChart = new Chart(trendCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Fallos',
                    data: [],
                    borderColor: '#0984e3',
                    backgroundColor: 'rgba(9, 132, 227, 0.15)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointBackgroundColor: '#0984e3'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: { grid: { display: false } },
                    y: { beginAtZero: true, ticks: { stepSize: 1 } }
                }
            }
        });
    }

    if (typeCtx && !analysisTypeChart) {
        analysisTypeChart = new Chart(typeCtx, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: analysisTypeColors,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    if (reportCtx && !reportChart) {
        reportChart = new Chart(reportCtx, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [{
                    label: 'Problemas',
                    data: [],
                    backgroundColor: '#6c5ce7'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: { ticks: { maxRotation: 30, minRotation: 0 } },
                    y: { beginAtZero: true }
                }
            }
        });
    }

    updateAnalysisCharts();
    renderReportChart();
}

function updateAnalysisCharts(data) {
    const trendData = buildTrendData();
    if (analysisTrendChart) {
        analysisTrendChart.data.labels = trendData.labels;
        analysisTrendChart.data.datasets[0].data = trendData.counts;
        analysisTrendChart.data.datasets[0].pointBackgroundColor = trendData.counts.map((_, index) => index === trendData.counts.length - 1 ? '#d63031' : '#0984e3');
        analysisTrendChart.update();
    }

    const typeData = buildTypeDistribution();
    if (analysisTypeChart) {
        analysisTypeChart.data.labels = typeData.labels;
        analysisTypeChart.data.datasets[0].data = typeData.data;
        analysisTypeChart.update();
        renderTypeLegend(typeData.labels, analysisTypeColors);
    }

    renderReportChart();
}

function renderReportChart() {
    if (!reportChart) return;
    const reportData = buildReportChartData();
    reportChart.data.labels = reportData.labels;
    reportChart.data.datasets[0].data = reportData.data;
    reportChart.update();
}

function addInventoryRow() {
    if (!window.APP_MODEL) {
        window.APP_MODEL = {};
    }
    if (!Array.isArray(window.APP_MODEL.inventory)) {
        window.APP_MODEL.inventory = [];
    }

    window.APP_MODEL.inventory.push({
        empleado: '',
        equipo: '',
        marca: '',
        fechaDevolucion: '',
        descripcion: '',
        accion: '',
        fechaEntrega: '',
        estado: ''
    });

    saveInventoryToStorage();
    
    // Actualizar todos los paneles
    setTimeout(() => {
        renderInventory();
        renderMetrics();
        renderAnalysis();
        renderAlerts();
        renderReportes();
    }, 100);
}

function deleteInventoryRow(index) {
    if (!window.APP_MODEL || !window.APP_MODEL.inventory) return;
    window.APP_MODEL.inventory.splice(index, 1);
    saveInventoryToStorage();
    
    // Actualizar todos los paneles
    setTimeout(() => {
        renderInventory();
        renderMetrics();
        renderAnalysis();
        renderAlerts();
        renderReportes();
    }, 100);
}

function isInventoryRowFilled(row) {
    return Object.values(row).some(value => String(value || '').trim() !== '');
}

function getInventoryMetrics() {
    const inventory = window.APP_MODEL && Array.isArray(window.APP_MODEL.inventory) ? window.APP_MODEL.inventory : [];
    const filledInventory = inventory.filter(isInventoryRowFilled);
    const total = filledInventory.length;
    const resolvedCount = filledInventory.filter(item => item.estado && /resuelto/i.test(item.estado)).length;
    const alertsCount = filledInventory.filter(item => {
        const estado = item.estado || '';
        const isResolved = /resuelto|solucionado|entregado|ok/i.test(estado);
        return !isResolved;
    }).length;
    const utilization = total ? Math.round((resolvedCount / total) * 100) : 0;
    return {
        total,
        utilization,
        alertsCount
    };
}

function renderMetrics() {
    const metrics = getInventoryMetrics();
    const activeEl = document.getElementById('card-active');
    const utilizationEl = document.getElementById('card-utilization');
    const alertsEl = document.getElementById('card-alerts');

    if (activeEl) activeEl.innerText = metrics.total;
    if (utilizationEl) utilizationEl.innerText = `${metrics.utilization}%`;
    if (alertsEl) alertsEl.innerText = metrics.alertsCount;
}

function parseDate(value) {
    if (!value) return null;
    const cleaned = String(value).trim();
    // Excel a veces guarda fechas como serial (ej: 46145). Convertimos: 1899-12-30 + serial días.
    if (/^\d{5}$/.test(cleaned)) {
        const serial = Number(cleaned);
        if (Number.isFinite(serial) && serial > 20000 && serial < 80000) {
            const excelEpoch = new Date(1899, 11, 30);
            const dt = new Date(excelEpoch.getTime() + serial * 86400000);
            return isNaN(dt) ? null : dt;
        }
    }
    // Formato ISO (input type="date"): yyyy-mm-dd
    const iso = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (iso) {
        const y = Number(iso[1]);
        const m = Number(iso[2]);
        const d = Number(iso[3]);
        const dt = new Date(y, m - 1, d);
        return isNaN(dt) ? null : dt;
    }
    const date = new Date(cleaned);
    if (!isNaN(date)) {
        return date;
    }
    const match = cleaned.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (match) {
        const a = Number(match[1]);
        const b = Number(match[2]);
        const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
        if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(year)) return null;

        // Heurística robusta:
        // - Si a > 12 y b <= 12 => dd/mm
        // - Si b > 12 y a <= 12 => mm/dd
        // - Si ambos <= 12 => preferimos dd/mm (formato habitual en ES)
        let day;
        let month;
        if (a > 12 && b <= 12) {
            day = a;
            month = b;
        } else if (b > 12 && a <= 12) {
            day = b;
            month = a;
        } else {
            day = a;
            month = b;
        }
        const dt = new Date(year, month - 1, day);
        return isNaN(dt) ? null : dt;
    }
    return null;
}

function daysBetween(start, end) {
    const ms = 1000 * 60 * 60 * 24;
    return Math.round((end - start) / ms);
}

function formatDateEs(date) {
    if (!date || isNaN(date)) return '';
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

function formatDateLongEs(date) {
    if (!date || isNaN(date)) return '';
    // Ej: "3 de julio de 2026"
    const day = date.getDate();
    const month = date.toLocaleString('es-ES', { month: 'long' });
    const year = date.getFullYear();
    return `${day} de ${month} de ${year}`;
}

function formatDateForInput(value) {
    const date = parseDate(value);
    if (!date || isNaN(date)) return '';
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function getFailureEventDate(item) {
    // Preferimos la fecha del evento (cuando se reportó/devolvió) y si no, la de entrega.
    return parseDate(item.fechaDevolucion) || parseDate(item.fechaEntrega) || null;
}

function buildFailureHistory(inventory) {
    const byEquipo = {};
    inventory.forEach(item => {
        const equipo = String(item.equipo || 'Desconocido').trim() || 'Desconocido';
        const date = getFailureEventDate(item);
        if (!date) return;
        if (!byEquipo[equipo]) byEquipo[equipo] = [];
        byEquipo[equipo].push(date);
    });
    Object.keys(byEquipo).forEach(equipo => {
        byEquipo[equipo].sort((a, b) => a - b);
    });
    return byEquipo;
}

function averageIntervalDays(dates) {
    if (!Array.isArray(dates) || dates.length < 2) return null;
    const intervals = [];
    for (let i = 1; i < dates.length; i++) {
        const delta = daysBetween(dates[i - 1], dates[i]);
        if (Number.isFinite(delta) && delta > 0) intervals.push(delta);
    }
    if (!intervals.length) return null;
    const sum = intervals.reduce((a, b) => a + b, 0);
    return sum / intervals.length;
}

function pickMostLikelyEquipo(historyByEquipo) {
    // Heurística: prioriza mayor volumen de eventos y menor intervalo promedio (más frecuente).
    const candidates = Object.keys(historyByEquipo).map(equipo => {
        const dates = historyByEquipo[equipo] || [];
        const avg = averageIntervalDays(dates);
        return {
            equipo,
            count: dates.length,
            avgInterval: avg
        };
    }).filter(c => c.count > 0);

    if (!candidates.length) return null;

    candidates.sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        const aScore = a.avgInterval == null ? Number.POSITIVE_INFINITY : a.avgInterval;
        const bScore = b.avgInterval == null ? Number.POSITIVE_INFINITY : b.avgInterval;
        return aScore - bScore;
    });

    return candidates[0];
}

function pickMostLikelyEmpleadoForEquipo(inventory, equipo) {
    const counts = {};
    const target = String(equipo || '').trim();
    inventory.forEach(item => {
        if (String(item.equipo || '').trim() !== target) return;
        const empleado = String(item.empleado || '').trim();
        if (!empleado) return;
        counts[empleado] = (counts[empleado] || 0) + 1;
    });
    const entries = Object.entries(counts);
    if (!entries.length) return null;
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][0];
}

function predictNextFailureEvent(inventory) {
    const filled = Array.isArray(inventory) ? inventory.filter(isInventoryRowFilled) : [];
    const history = buildFailureHistory(filled);
    const pick = pickMostLikelyEquipo(history);
    if (!pick) {
        const now = new Date();
        const fallback = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return {
            empleado: 'N/A',
            equipo: 'N/A',
            date: fallback,
            confidence: 'Baja',
            reason: 'No hay fechas válidas en el Excel para estimar una próxima falla.'
        };
    }

    const dates = history[pick.equipo] || [];
    const last = dates[dates.length - 1] || null;
    const avgDays = averageIntervalDays(dates);
    const empleadoPick = pickMostLikelyEmpleadoForEquipo(filled, pick.equipo) || 'N/A';

    if (!last || avgDays == null) {
        const now = new Date();
        const fallback = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return {
            empleado: empleadoPick,
            equipo: pick.equipo,
            date: fallback,
            confidence: 'Media',
            reason: 'Hay historial, pero no suficientes intervalos; se aproxima al próximo mes.'
        };
    }

    const now = new Date();
    const roundedAvg = Math.round(avgDays);
    // Guardrails: si el promedio es demasiado grande, suele ser por datos muy separados o fechas mal registradas.
    // En ese caso, preferimos una estimación conservadora (próximo mes) para no mostrar una fecha absurda.
    const MAX_REASONABLE_AVG_DAYS = 180;
    if (!Number.isFinite(roundedAvg) || roundedAvg <= 0 || roundedAvg > MAX_REASONABLE_AVG_DAYS) {
        const fallback = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return {
            empleado: empleadoPick,
            equipo: pick.equipo,
            date: fallback,
            confidence: 'Baja',
            reason: `El intervalo promedio entre fallas (${Math.round(avgDays)} día(s)) es atípico; se estima al próximo mes.`
        };
    }

    const next = new Date(last);
    next.setDate(next.getDate() + Math.max(7, roundedAvg));
    // Evitar fechas en el pasado (p. ej. si el último evento es antiguo y el intervalo ya pasó).
    if (next <= now) {
        const fallback = new Date(now);
        fallback.setDate(fallback.getDate() + Math.max(7, roundedAvg));
        next.setTime(fallback.getTime());
    }
    // Si aun así cae demasiado lejos, hacemos fallback.
    const horizonDays = daysBetween(now, next);
    if (!Number.isFinite(horizonDays) || horizonDays > 365) {
        const fallback = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return {
            empleado: empleadoPick,
            equipo: pick.equipo,
            date: fallback,
            confidence: 'Baja',
            reason: 'La proyección excede el horizonte razonable; se estima al próximo mes.'
        };
    }

    const confidence = dates.length >= 6 ? 'Alta' : dates.length >= 3 ? 'Media' : 'Baja';
    return {
        empleado: empleadoPick,
        equipo: pick.equipo,
        date: next,
        confidence,
        reason: `Promedio de ${roundedAvg} día(s) entre fallas para este equipo según el Excel.`
    };
}

function getAnalysisData() {
    const inventory = window.APP_MODEL && Array.isArray(window.APP_MODEL.inventory) ? window.APP_MODEL.inventory.filter(isInventoryRowFilled) : [];
    const now = new Date();
    const nextFailure = predictNextFailureEvent(inventory);
    const trend = buildTrendData();
    
    // Análisis por tipo de equipo
    const equipoStats = {};
    
    inventory.forEach(item => {
        const equipo = item.equipo || 'Desconocido';
        const descripcion = String(item.descripcion || '').toLowerCase();
        const estadoText = String(item.estado || '').toLowerCase();
        const date = parseDate(item.fechaDevolucion) || parseDate(item.fechaEntrega) || now;
        const ageDays = daysBetween(date, now);
        const isResolved = /resuelto|solucionado|entregado|ok/i.test(estadoText);
        
        if (!equipoStats[equipo]) {
            equipoStats[equipo] = {
                total: 0,
                sin_resolver: 0,
                criticos: 0,
                antiguedad_promedio: 0,
                descripcion_problemas: [],
                fechas: [],
                problemas_recurrentes: {}
            };
        }
        
        equipoStats[equipo].total += 1;
        equipoStats[equipo].descripcion_problemas.push(descripcion);
        equipoStats[equipo].fechas.push(ageDays);
        
        if (!isResolved) {
            equipoStats[equipo].sin_resolver += 1;
        }
        
        // Detectar problemas recurrentes
        const problema_key = descripcion.substring(0, 30);
        equipoStats[equipo].problemas_recurrentes[problema_key] = (equipoStats[equipo].problemas_recurrentes[problema_key] || 0) + 1;
        
        // Detectar crítico
        const isCritical = /critico|urgente|prioritario|fallo grave|error|daño|rotura|no funciona/i.test(descripcion);
        if (isCritical && !isResolved) {
            equipoStats[equipo].criticos += 1;
        }
    });
    
    // Calcular proyecciones inteligentes - TOTALMENTE DINÁMICO
    const riskTable = [];
    
    Object.keys(equipoStats).forEach(equipo => {
        const stats = equipoStats[equipo];
        let projection = 'Baja';
        let fallos = stats.total; // Mostrar total histórico de fallos
        
        // Métrica: porcentaje de sin resolver
        const porcentaje_sin_resolver = stats.total > 0 ? (stats.sin_resolver / stats.total) * 100 : 0;
        
        // Métrica: problemas recurrentes
        const problemas_frecuentes = Object.values(stats.problemas_recurrentes).filter(count => count >= 2).length;
        
        // Métrica: criticalidad
        const porcentaje_criticos = stats.total > 0 ? (stats.criticos / stats.total) * 100 : 0;
        
        // Lógica de predicción mejorada
        if (porcentaje_sin_resolver > 40 || porcentaje_criticos > 30 || problemas_frecuentes >= 2) {
            projection = 'Alta';
        } else if (stats.total >= 2 || problemas_frecuentes >= 1) {
            projection = 'Media';
        } else {
            projection = 'Baja';
        }
        
        // Calcular probabilidad de fallo futuro basada en historial
        let probabilidad = '10%';
        if (stats.total === 0) {
            probabilidad = '0%';
        } else if (projection === 'Alta') {
            probabilidad = Math.min(95, 50 + Math.round(porcentaje_sin_resolver / 2)) + '%';
        } else if (projection === 'Media') {
            probabilidad = Math.min(70, 30 + Math.round(stats.total * 10)) + '%';
        } else {
            probabilidad = Math.min(40, 10 + stats.total * 5) + '%';
        }
        
        riskTable.push({
            equipo: equipo,
            fallos: stats.sin_resolver, // Fallos actuales sin resolver
            historico: stats.total,     // Fallos históricos totales
            projection: projection,
            probabilidad: probabilidad,
            estadoText: stats.sin_resolver > 0 ? `${stats.sin_resolver} sin resolver` : 'Todos resueltos'
        });
    });
    
    // Calcular nivel de riesgo general basado en datos reales
    const totalEquipos = riskTable.length || 1;
    const equiposAltoRiesgo = riskTable.filter(item => item.projection === 'Alta').length;
    const equiposMedioRiesgo = riskTable.filter(item => item.projection === 'Media').length;
    
    const porcentajeAlto = totalEquipos > 0 ? (equiposAltoRiesgo / totalEquipos) * 100 : 0;
    const porcentajeMedio = totalEquipos > 0 ? (equiposMedioRiesgo / totalEquipos) * 100 : 0;
    
    let riskLevel = 'Bajo';
    let riskPercentage = 0;
    let openFailures = 0;
    
    // Calcular fallos sin resolver totales
    riskTable.forEach(item => {
        openFailures += item.fallos;
    });
    
    // Score global (0-100) mezclando proyección + % abiertos por equipo.
    // Esto evita mostrar 100% solo por existir 1 caso abierto.
    const projectionWeight = { Alta: 1, Media: 0.6, Baja: 0.2 };
    let scoreSum = 0;
    riskTable.forEach(row => {
        const proj = projectionWeight[row.projection] ?? 0.2;
        const openRate = row.historico > 0 ? row.fallos / row.historico : 0;
        const rowScore = Math.min(1, proj * 0.7 + openRate * 0.3);
        scoreSum += rowScore;
    });
    const score = riskTable.length ? Math.round((scoreSum / riskTable.length) * 100) : 0;
    riskPercentage = score;
    if (score >= 70) riskLevel = 'Alto';
    else if (score >= 40) riskLevel = 'Medio';
    else if (riskTable.length) riskLevel = 'Bajo';
    else riskLevel = 'Sin datos';
    
    // Si no hay datos en absoluto
    if (totalEquipos === 0 || riskTable.length === 0) {
        riskLevel = 'Sin datos';
        riskPercentage = 0;
        openFailures = 0;
    }

    return {
        riskLevel,
        riskPercentage,
        // "Fallos estimados" = predicción para el próximo mes desde la tendencia.
        estimatedFailures: trend?.predictionCount ?? 0,
        openFailures,
        riskTable: riskTable,
        nextFailure
    };
}


function renderAnalysis() {
    // Asegurar charts disponibles al entrar al panel
    initializeCharts();
    const data = getAnalysisData();
    const riskEl = document.getElementById('analysis-risk');
    const riskPercentageEl = document.getElementById('analysis-risk-percentage');
    const failuresEl = document.getElementById('analysis-failures');
    const tableBody = document.getElementById('analysis-risk-table-body');
    const riskBar = document.getElementById('analysis-risk-bar');
    const riskMeterValueEl = document.getElementById('analysis-risk-meter-value');

    if (riskEl) {
        riskEl.innerText = data.riskLevel;
        riskEl.dataset.risk = data.riskLevel.toLowerCase();
    }
    
    if (riskPercentageEl) {
        riskPercentageEl.innerText = `${data.riskPercentage}%`;
    }
    if (riskBar) {
        riskBar.style.width = `${Math.max(0, Math.min(100, data.riskPercentage))}%`;
    }
    if (riskMeterValueEl) {
        riskMeterValueEl.innerText = `${data.riskPercentage}%`;
    }
    
    if (failuresEl) {
        failuresEl.innerText = data.estimatedFailures ?? 0;
    }
    
    if (tableBody) {
        tableBody.innerHTML = data.riskTable.map(row => `
            <tr class="risk-row risk-${row.projection.toLowerCase()}">
                <td>${row.equipo}</td>
                <td><span class="fallos-badge">${row.fallos}</span></td>
                <td><span class="proyeccion-badge proyeccion-${row.projection.toLowerCase()}">${row.projection}</span></td>
                <td><span class="probabilidad-badge">${row.probabilidad || 'N/A'}</span></td>
            </tr>
        `).join('');
    }
    updateAnalysisCharts(data);

    // Mensaje principal de IA: "cuándo se va a malograr otro"
    const predictionEl = document.getElementById('analysis-prediction');
    if (predictionEl && data.nextFailure) {
        const when = formatDateLongEs(data.nextFailure.date);
        const equipo = data.nextFailure.equipo || 'N/A';
        const empleado = data.nextFailure.empleado || 'N/A';
        const conf = data.nextFailure.confidence || 'Baja';
        const reason = data.nextFailure.reason ? ` ${data.nextFailure.reason}` : '';
        const trendData = buildTrendData();
        const trendText = trendData && trendData.predictionLabel
            ? ` Además, estima ${trendData.predictionCount} fallo(s) en ${trendData.predictionLabel} (${trendData.predictionReason}).`
            : '';
        predictionEl.innerText = `IA predictiva: ${empleado} podría presentar un fallo en ${when} (${equipo}). Confianza: ${conf}.${reason}${trendText}`;
    }
}

function commitActiveEdit() {
    const active = document.activeElement;
    if (active && active.matches && active.matches('td[contenteditable]')) {
        active.blur();
    }
}

function normalizeHeader(value) {
    return value.toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function parseInventoryFromWorkbook(workbook) {
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    const fieldMap = {
        empleado: 'empleado',
        equipo: 'equipo',
        marca: 'marca',
        'fecha de devolucion': 'fechaDevolucion',
        'descripcion del problema': 'descripcion',
        'descripcion': 'descripcion',
        'accion tomada': 'accion',
        'accion': 'accion',
        'fecha que se le entrego uno nuevo': 'fechaEntrega',
        'fecha que se le entregro uno nuevo': 'fechaEntrega',
        'fecha que se le entregó uno nuevo': 'fechaEntrega',
        'estado': 'estado'
    };

    return rows.map(row => {
        const item = {
            empleado: '',
            equipo: '',
            marca: '',
            fechaDevolucion: '',
            descripcion: '',
            accion: '',
            fechaEntrega: '',
            estado: ''
        };

        Object.keys(row).forEach(key => {
            const normalized = normalizeHeader(key);
            const target = fieldMap[normalized];
            if (target) {
                const rawValue = row[key];
                if ((target === 'fechaDevolucion' || target === 'fechaEntrega') && typeof rawValue === 'number' && Number.isFinite(rawValue)) {
                    const excelEpoch = new Date(1899, 11, 30);
                    const dt = new Date(excelEpoch.getTime() + rawValue * 86400000);
                    item[target] = formatDateEs(dt);
                } else {
                    item[target] = rawValue instanceof Date ? formatDateEs(rawValue) : String(rawValue || '').trim();
                }
            }
        });

        return item;
    }).filter(item => Object.values(item).some(value => value !== ''));
}

function loadInventoryFromExcel(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const inventory = parseInventoryFromWorkbook(workbook);
            if (!inventory.length) {
                alert('No se encontraron registros válidos en el Excel.');
                return;
            }
            if (!window.APP_MODEL) {
                window.APP_MODEL = {};
            }
            window.APP_MODEL.inventory = inventory;
            saveInventoryToStorage();
            
            // Actualizar todos los paneles en orden correcto
            renderInventory();
            renderMetrics();
            renderAnalysis();
            renderAlerts();
            renderReportes();
            
            alert('Excel cargado exitosamente. Sistema actualizado.');
        } catch (error) {
            console.error(error);
            alert('Error al cargar el archivo Excel.');
        }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
}

function exportInventoryExcel() {
    commitActiveEdit();
    saveInventoryToStorage();
    const inventory = (window.APP_MODEL.inventory || []).filter(isInventoryRowFilled);
    
    // Crear libro de trabajo con ExcelJS
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Inventario');
    
    // Definir encabezados
    const headers = [
        'Empleado',
        'Equipo',
        'Marca',
        'Fecha de devolución',
        'Descripción del problema',
        'Acción tomada',
        'Fecha que se le entregó uno nuevo',
        'Estado'
    ];
    
    // Agregar encabezados
    const headerRow = worksheet.addRow(headers);
    
    // Estilo para los encabezados
    headerRow.eachCell((cell) => {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' }
        };
        cell.font = {
            bold: true,
            color: { argb: 'FFFFFFFF' }
        };
        cell.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
        };
    });
    
    // Agregar datos
    inventory.forEach(item => {
        const row = worksheet.addRow([
            item.empleado,
            item.equipo,
            item.marca,
            parseDate(item.fechaDevolucion) || '',
            item.descripcion,
            item.accion,
            parseDate(item.fechaEntrega) || '',
            item.estado
        ]);
        
        // Aplicar bordes a todas las celdas de datos
        row.eachCell((cell, colNumber) => {
            cell.border = {
                top: { style: 'thin', color: { argb: 'FF000000' } },
                left: { style: 'thin', color: { argb: 'FF000000' } },
                bottom: { style: 'thin', color: { argb: 'FF000000' } },
                right: { style: 'thin', color: { argb: 'FF000000' } }
            };
            cell.alignment = { horizontal: 'left', vertical: 'center', wrapText: true };
            
            // Formato de fecha para columnas 4 y 7 (índice 3 y 6)
            if ((colNumber === 4 || colNumber === 7) && cell.value) {
                cell.numFmt = 'dd/mm/yyyy';
            }
        });
    });
    
    // Ajustar ancho de columnas
    worksheet.columns = [
        { width: 20 },
        { width: 25 },
        { width: 15 },
        { width: 18 },
        { width: 25 },
        { width: 25 },
        { width: 18 },
        { width: 15 }
    ];
    
    // Guardar archivo
    workbook.xlsx.writeBuffer().then(buffer => {
        saveAs(new Blob([buffer]), 'reporte_cargadores_modificado.xlsx');
    });
}

function scrollInventoryDown() {
    const container = document.querySelector('#inventory-panel .tabla-body');
    if (!container) return;
    container.scrollBy({ top: 300, behavior: 'smooth' });
}

function scrollAnalysisDown() {
    const container = document.querySelector('#analysis-panel .analysis-scroll-container');
    if (!container) return;
    container.scrollBy({ top: 300, behavior: 'smooth' });
}

function scrollAnalysisUp() {
    const container = document.querySelector('#analysis-panel .analysis-scroll-container');
    if (!container) return;
    container.scrollBy({ top: -300, behavior: 'smooth' });
}

function scrollAlertsDown() {
    const container = document.querySelector('#alerts-panel .alerts-scroll-container');
    if (!container) return;
    container.scrollBy({ top: 300, behavior: 'smooth' });
}

function scrollAlertsUp() {
    const container = document.querySelector('#alerts-panel .alerts-scroll-container');
    if (!container) return;
    container.scrollBy({ top: -300, behavior: 'smooth' });
}

function renderInventory() {
    const container = document.querySelector('#inventory-panel .tabla-body');
    if (!container || !window.APP_MODEL) return;

    const inventory = window.APP_MODEL.inventory || [];
    if (inventory.length === 0) {
        container.innerHTML = '<p>No hay datos disponibles.</p>';
        renderMetrics();
        renderAnalysis();
        renderAlerts();
        renderReportes();
        return;
    }

    const headers = [
        'Empleado',
        'Equipo',
        'Marca',
        'Fecha de devolución',
        'Descripción del problema',
        'Acción tomada',
        'Fecha que se le entregó uno nuevo',
        'Estado',
        'Eliminar'
    ];

    const rows = inventory.map((item, index) => `
        <tr>
            <td contenteditable="true" data-index="${index}" data-field="empleado">${item.empleado}</td>
            <td contenteditable="true" data-index="${index}" data-field="equipo">${item.equipo}</td>
            <td contenteditable="true" data-index="${index}" data-field="marca">${item.marca}</td>
            <td>
                <input type="date" data-index="${index}" data-field="fechaDevolucion" value="${formatDateForInput(item.fechaDevolucion)}">
            </td>
            <td contenteditable="true" data-index="${index}" data-field="descripcion">${item.descripcion}</td>
            <td contenteditable="true" data-index="${index}" data-field="accion">${item.accion}</td>
            <td>
                <input type="date" data-index="${index}" data-field="fechaEntrega" value="${formatDateForInput(item.fechaEntrega)}">
            </td>
            <td contenteditable="true" data-index="${index}" data-field="estado">${item.estado}</td>
            <td><button class="delete-row" onclick="deleteInventoryRow(${index})">✕</button></td>
        </tr>
    `).join('');

    container.innerHTML = `
        <table class="inventory-table">
            <thead>
                <tr>${headers.map(header => `<th>${header}</th>`).join('')}</tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;

    const editableCells = container.querySelectorAll('td[contenteditable]');
    editableCells.forEach(cell => {
        const saveCell = () => {
            const index = parseInt(cell.dataset.index, 10);
            const field = cell.dataset.field;
            const value = cell.innerText.trim();
            updateInventoryItem(index, field, value);
        };

        cell.addEventListener('blur', saveCell);
        cell.addEventListener('input', saveCell);
    });

    const dateInputs = container.querySelectorAll('input[type="date"]');
    dateInputs.forEach(input => {
        const saveInput = () => {
            const index = parseInt(input.dataset.index, 10);
            const field = input.dataset.field;
            const value = input.value ? formatDateEs(parseDate(input.value)) : '';
            updateInventoryItem(index, field, value);
        };

        input.addEventListener('change', saveInput);
        input.addEventListener('blur', saveInput);
    });

    renderMetrics();
    renderAnalysis();
    renderAlerts();
    renderReportes();
}

document.addEventListener('DOMContentLoaded', () => {
    loadInventoryFromStorage();
    initializeCharts();
    renderInventory();
    renderMetrics();
    renderAnalysis();
    renderAlerts();
    renderReportes();

    window.addEventListener('beforeunload', () => {
        saveInventoryToStorage();
    });

    // Agregar funcionalidad de Enter en los campos de login
    document.getElementById("usuario").addEventListener("keypress", function(event) {
        if (event.key === "Enter") {
            login();
        }
    });

    document.getElementById("password").addEventListener("keypress", function(event) {
        if (event.key === "Enter") {
            login();
        }
    });

    // Evento para redimensionar gráficos en responsive
    window.addEventListener('resize', () => {
        if (analysisTrendChart) analysisTrendChart.resize();
        if (analysisTypeChart) analysisTypeChart.resize();
        if (reportChart) reportChart.resize();
    });
});
