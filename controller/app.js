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
// Variable global para el filtro de empleado en reporte
let selectedReportEmployee = '';
// Variable global para el filtro de producto/equipo en reporte
let selectedReportProduct = '';
// Variable global para el filtro de hoja de análisis
let selectedAnalysisSheet = 'all';

function filterReportesByMonth(month) {
    selectedMonth = month;
    renderReportes();
}

function filterReportesByEmployee(employee) {
    selectedReportEmployee = employee || '';
    renderReportes();
}

function filterReportesByProduct(product) {
    selectedReportProduct = product || '';
    renderReportes();
}

function setAnalysisSheetFilter(sheetKey) {
    selectedAnalysisSheet = sheetKey || 'all';
    saveInventoryToStorage();
    renderAnalysis();
}

function getFilteredAnalysisInventory() {
    ensureInventoryBySheetModel();
    const sheetKey = selectedAnalysisSheet && selectedAnalysisSheet !== 'all' ? selectedAnalysisSheet : null;
    if (sheetKey && window.APP_MODEL.inventoryBySheet && window.APP_MODEL.inventoryBySheet[sheetKey]) {
        const bundle = getSheetBundle(sheetKey);
        return (bundle.rows || []).map(row => rowToCanonical(row, bundle.fieldMap)).filter(isInventoryRowFilled);
    }
    return getAllInventoryFlat();
}

function renderAnalysisSheetFilterOptions() {
    ensureInventoryBySheetModel();
    const select = document.getElementById('analysis-sheet-filter');
    if (!select || !window.APP_MODEL) return;

    const keys = Object.keys(window.APP_MODEL.inventoryBySheet || {});
    const current = selectedAnalysisSheet || 'all';
    const options = ['<option value="all">Todas las hojas</option>'];
    keys.forEach(name => {
        const safeValue = String(name).replace(/"/g, '&quot;');
        options.push(`<option value="${safeValue}">${escapeHtml(name)}</option>`);
    });
    select.innerHTML = options.join('');
    if (current !== 'all' && !keys.includes(current)) {
        selectedAnalysisSheet = 'all';
    }
    select.value = selectedAnalysisSheet;
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
    ensureInventoryBySheetModel();
    const inventory = getAllInventoryFlat();
    const alerts = [];

    if (!inventory.length) {
        alerts.push('No hay registros en el inventario');
        return alerts;
    }

    // Detectar casos sin resolver
    const unresolved = inventory.filter(item => {
        const estado = String(item.estado || '').toLowerCase();
        return !/resuelto|solucionado|entregado|ok|activo/i.test(estado);
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
        const isResolved = /resuelto|solucionado|entregado|ok|activo/i.test(estado);
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

function getDefaultExcelFieldLabels() {
    return {
        empleado: 'Empleado',
        equipo: 'Equipo',
        descripcion: 'Descripción del problema',
        fechaDevolucion: 'Fecha de devolución'
    };
}

function getReportTableLabels() {
    const d = getDefaultExcelFieldLabels();
    const f = (window.APP_MODEL && window.APP_MODEL.excelFieldLabels) || {};
    return {
        empleado: (f.empleado && String(f.empleado).trim()) || d.empleado,
        equipo: (f.equipo && String(f.equipo).trim()) || d.equipo,
        descripcion: (f.descripcion && String(f.descripcion).trim()) || d.descripcion,
        fecha: (f.fechaDevolucion && String(f.fechaDevolucion).trim()) || d.fechaDevolucion
    };
}

function applyReportTableHeaderRow() {
    const theadRow = document.querySelector('#reportes-panel .report-table thead tr');
    if (!theadRow) return;
    const L = getReportTableLabels();
    theadRow.innerHTML = '';
    ['empleado', 'equipo', 'descripcion'].forEach(key => {
        const th = document.createElement('th');
        th.textContent = L[key];
        theadRow.appendChild(th);
    });
}

function updateReportesSubtitle() {
    const el = document.getElementById('reportes-subtitle');
    if (!el) return;
    const L = getReportTableLabels();
    el.textContent = 'Encabezados alineados con el Excel: ' + L.empleado + ', ' + L.equipo + ', ' + L.descripcion + '.';
}

function pickReporteProblemaText(row, canon) {
    if (canon.descripcion && String(canon.descripcion).trim()) {
        return String(canon.descripcion).trim();
    }
    const directKeys = ['Síntomas', 'Sintomas', 'Causa', 'Asunto', 'Problema', 'Detalle', 'Observaciones'];
    for (let i = 0; i < directKeys.length; i++) {
        const k = directKeys[i];
        if (row[k] != null && String(row[k]).trim()) {
            return String(row[k]).trim();
        }
    }
    const keys = Object.keys(row);
    for (let i = 0; i < keys.length; i++) {
        const col = keys[i];
        const n = normalizeHeader(col);
        if (/sintoma|causa|asunto|falla|error|diagnost|incidencia|detalle|motivo|descripcion|problema/.test(n)) {
            const v = row[col];
            if (v != null && String(v).trim()) {
                return String(v).trim();
            }
        }
    }
    return '';
}

function pickReporteProductoText(row, canon) {
    if (canon.equipo && String(canon.equipo).trim()) {
        return String(canon.equipo).trim();
    }
    const directKeys = ['Máquina', 'Maquina', 'Equipo', 'Producto', 'Modelo', 'Activo', 'Serial'];
    for (let i = 0; i < directKeys.length; i++) {
        const k = directKeys[i];
        if (row[k] != null && String(row[k]).trim()) {
            return String(row[k]).trim();
        }
    }
    const keys = Object.keys(row);
    for (let i = 0; i < keys.length; i++) {
        const col = keys[i];
        const n = normalizeHeader(col);
        if (/maquina|equipo|modelo|dispositivo|hardware|activo|serial/.test(n)) {
            const v = row[col];
            if (v != null && String(v).trim()) {
                return String(v).trim();
            }
        }
    }
    return 'Desconocido';
}

function pickReporteEmpleadoText(row, canon) {
    if (canon.empleado && String(canon.empleado).trim()) {
        return String(canon.empleado).trim();
    }
    const directKeys = ['Empleado', 'Técnico', 'Tecnico', 'Contacto', 'Cliente', 'Solicitante', 'Responsable'];
    for (let i = 0; i < directKeys.length; i++) {
        const k = directKeys[i];
        if (row[k] != null && String(row[k]).trim()) {
            return String(row[k]).trim();
        }
    }
    const keys = Object.keys(row);
    for (let i = 0; i < keys.length; i++) {
        const col = keys[i];
        const n = normalizeHeader(col);
        if (/empleado|trabajador|usuario|contacto|tecnico|solicitante|nombre/.test(n)) {
            const v = row[col];
            if (v != null && String(v).trim()) {
                return String(v).trim();
            }
        }
    }
    return 'N/A';
}

function generateReportesFromInventory() {
    ensureInventoryBySheetModel();
    const m = window.APP_MODEL && window.APP_MODEL.inventoryBySheet;
    const reportes = [];
    if (!m || typeof m !== 'object') {
        if (!window.APP_MODEL) {
            window.APP_MODEL = {};
        }
        window.APP_MODEL.reportes = [];
        return;
    }

    Object.keys(m).forEach(sheetKey => {
        const b = getSheetBundle(sheetKey);
        (b.rows || []).forEach(row => {
            const canon = rowToCanonical(row, b.fieldMap);
            const problema = pickReporteProblemaText(row, canon);
            if (!problema) {
                return;
            }
            const date = parseDate(canon.fechaDevolucion) || parseDate(canon.fechaEntrega) || new Date();
            reportes.push({
                empleado: pickReporteEmpleadoText(row, canon),
                producto: pickReporteProductoText(row, canon),
                problema,
                mes: date.getMonth() + 1,
                año: date.getFullYear(),
                fecha: date
            });
        });
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
        filtered = filtered.filter(item => item.mes === monthNum);
    }
    if (selectedReportEmployee) {
        filtered = filtered.filter(item => String(item.empleado || '').trim() === String(selectedReportEmployee).trim());
    }
    if (selectedReportProduct) {
        filtered = filtered.filter(item => String(item.producto || '').trim() === String(selectedReportProduct).trim());
    }
    
    filtered.sort((a, b) => {
        const empleadoA = String(a.empleado || '').localeCompare(String(b.empleado || ''), 'es', { sensitivity: 'base' });
        if (empleadoA !== 0) return empleadoA;
        return String(a.producto || '').localeCompare(String(b.producto || ''), 'es', { sensitivity: 'base' });
    });
    return filtered;
}

function getFilteredReportesForFilter(excludeField) {
    generateReportesFromInventory();
    return (window.APP_MODEL.reportes || []).filter(item => {
        if (excludeField !== 'mes' && selectedMonth) {
            const monthNum = parseInt(selectedMonth, 10);
            if (item.mes !== monthNum) return false;
        }
        if (excludeField !== 'empleado' && selectedReportEmployee) {
            if (String(item.empleado || '').trim() !== String(selectedReportEmployee).trim()) return false;
        }
        if (excludeField !== 'producto' && selectedReportProduct) {
            if (String(item.producto || '').trim() !== String(selectedReportProduct).trim()) return false;
        }
        return true;
    });
}

function renderReportes() {
    generateReportesFromInventory();
    applyReportTableHeaderRow();
    updateReportesSubtitle();
    renderReportEmployeeFilterOptions();
    renderReportProductFilterOptions();
    const tbody = document.querySelector('#reportes-panel .report-table tbody');
    if (!tbody || !window.APP_MODEL) return;

    const reportes = getFilteredReportes();
    if (!reportes.length) {
        tbody.innerHTML = '<tr><td colspan="3" class="report-empty-row">No hay incidencias con texto en columnas de problema, síntomas, causa o asunto. Revisa el mapeo del Excel o el filtro de mes.</td></tr>';
        renderReportChart();
        return;
    }
    tbody.innerHTML = reportes.map(item => `
        <tr>
            <td>${escapeHtml(item.empleado || 'N/A')}</td>
            <td>${escapeHtml(String(item.producto || ''))}</td>
            <td>${escapeHtml(String(item.problema || ''))}</td>
        </tr>
    `).join('');
    renderReportChart();
}

function loadInventoryFromStorage() {
    const stored = localStorage.getItem('inventoryData');
    if (!stored) {
        ensureInventoryBySheetModel();
        return;
    }

    try {
        const parsed = JSON.parse(stored);
        if (!window.APP_MODEL) {
            window.APP_MODEL = {};
        }
        if (Array.isArray(parsed)) {
            window.APP_MODEL.inventoryBySheet = { Principal: parsed };
            window.APP_MODEL.activeInventorySheet = 'Principal';
            window.APP_MODEL.excelFieldLabels = getDefaultExcelFieldLabels();
            delete window.APP_MODEL.inventory;
        } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.inventory) && !parsed.inventoryBySheet) {
            window.APP_MODEL.inventoryBySheet = { Principal: parsed.inventory };
            window.APP_MODEL.activeInventorySheet = 'Principal';
            window.APP_MODEL.excelFieldLabels = getDefaultExcelFieldLabels();
            delete window.APP_MODEL.inventory;
        } else if (parsed && typeof parsed === 'object' && parsed.inventoryBySheet && typeof parsed.inventoryBySheet === 'object') {
            window.APP_MODEL.inventoryBySheet = parsed.inventoryBySheet;
            const keys = Object.keys(window.APP_MODEL.inventoryBySheet);
            window.APP_MODEL.activeInventorySheet = (parsed.activeInventorySheet && window.APP_MODEL.inventoryBySheet[parsed.activeInventorySheet])
                ? parsed.activeInventorySheet
                : (keys[0] || 'Principal');
            selectedAnalysisSheet = parsed.analysisSheetFilter || 'all';
            window.APP_MODEL.excelFieldLabels = (parsed.excelFieldLabels && typeof parsed.excelFieldLabels === 'object')
                ? Object.assign({}, getDefaultExcelFieldLabels(), parsed.excelFieldLabels)
                : getDefaultExcelFieldLabels();
            delete window.APP_MODEL.inventory;
        } else {
            ensureInventoryBySheetModel();
        }
    } catch (error) {
        console.warn('Error leyendo inventoryData desde localStorage', error);
        if (!window.APP_MODEL) {
            window.APP_MODEL = {};
        }
        window.APP_MODEL.inventoryBySheet = { Principal: blankSheetBundle() };
        window.APP_MODEL.activeInventorySheet = 'Principal';
        window.APP_MODEL.excelFieldLabels = getDefaultExcelFieldLabels();
        delete window.APP_MODEL.inventory;
    }
}

function saveInventoryToStorage() {
    if (!window.APP_MODEL) return;
    ensureInventoryBySheetModel();
    try {
        localStorage.setItem('inventoryData', JSON.stringify({
            inventoryBySheet: window.APP_MODEL.inventoryBySheet,
            activeInventorySheet: window.APP_MODEL.activeInventorySheet,
            excelFieldLabels: window.APP_MODEL.excelFieldLabels || getDefaultExcelFieldLabels(),
            analysisSheetFilter: selectedAnalysisSheet || 'all'
        }));
    } catch (error) {
        console.warn('Error guardando inventoryData en localStorage', error);
    }
}

function updateInventoryItem(index, colIndex, value) {
    ensureInventoryBySheetModel();
    const bundle = getActiveSheetBundle();
    const rows = bundle.rows;
    const row = rows[index];
    if (!row || colIndex < 0 || colIndex >= bundle.columns.length) return;
    const colKey = bundle.columns[colIndex];
    row[colKey] = value;
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
const analysisTypeColors = ['#e17055', '#6c5ce7', '#74b9ff', '#00b894', '#00d2d3', '#fdcb6e', '#e84393', '#00cec9'];
const analysisTypeColorMap = {};

function getAnalysisTypeColor(label) {
    if (!label) {
        return '#cccccc';
    }
    if (analysisTypeColorMap[label]) {
        return analysisTypeColorMap[label];
    }
    const existingColors = Object.values(analysisTypeColorMap);
    const nextColor = analysisTypeColors[existingColors.length % analysisTypeColors.length];
    analysisTypeColorMap[label] = nextColor;
    return nextColor;
}

function getAnalysisTypeColors(labels) {
    return labels.map(label => getAnalysisTypeColor(label));
}

function formatMonthShortEs(date) {
    // Ej: "ene", "feb" → "Ene", "Feb"; también elimina el punto si el navegador lo añade.
    const raw = date.toLocaleString('es-ES', { month: 'short' }).replace('.', '').trim();
    if (!raw) return '';
    return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function wrapChartLabel(label, maxLength) {
    if (!label || typeof label !== 'string') return label;
    const words = label.split(/\s+/);
    const lines = [];
    let current = '';
    words.forEach(word => {
        if (!current) {
            current = word;
            return;
        }
        if ((current + ' ' + word).length <= maxLength) {
            current += ' ' + word;
        } else {
            lines.push(current);
            current = word;
        }
    });
    if (current) lines.push(current);
    return lines.length > 1 ? lines : lines[0];
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

function getFailureDatesFromInventory(inventory) {
    const dates = [];
    inventory.forEach(item => {
        const date = parseDate(item.fechaDevolucion) || parseDate(item.fechaEntrega);
        if (date) dates.push(date);
    });
    return dates.sort((a, b) => a - b);
}

function buildTrendData() {
    ensureInventoryBySheetModel();
    const inventory = getFilteredAnalysisInventory();
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

    const prediction = predictNextFailureCount(counts, inventory);
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

function predictNextFailureCount(counts, inventory) {
    const values = counts.slice();
    const n = values.length;
    if (n === 0) {
        return { count: 0, reason: 'No hay datos históricos suficientes.' };
    }
    const total = values.reduce((a, b) => a + b, 0);
    if (total === 0) {
        const dates = getFailureDatesFromInventory(inventory || []);
        if (dates.length) {
            const firstDate = dates[0];
            const lastDate = dates[dates.length - 1];
            const monthSpan = Math.max(1, Math.ceil(((lastDate - firstDate) / 86400000) / 30));
            const avgPerMonth = Math.max(1, Math.round(dates.length / monthSpan));
            return {
                count: avgPerMonth,
                reason: 'No hay fallos en los últimos 6 meses, se estima según el historial completo del Excel.'
            };
        }
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

function buildTypeDistribution() {
    ensureInventoryBySheetModel();
    const inventory = getFilteredAnalysisInventory();

    const counts = {};
    inventory.forEach(item => {
        const type = String(item.equipo || '').trim();
        if (!type) return;
        counts[type] = (counts[type] || 0) + 1;
    });

    const sortedEntries = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    if (!sortedEntries.length) {
        return { labels: ['Sin datos'], data: [1] };
    }

    const labels = sortedEntries.map(([label]) => label);
    return {
        labels,
        data: sortedEntries.map(([, value]) => value),
        colors: getAnalysisTypeColors(labels)
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

function renderReportEmployeeFilterOptions() {
    if (!window.APP_MODEL) return;
    const select = document.getElementById('employee-filter');
    if (!select) return;

    const reports = getFilteredReportesForFilter('empleado');
    const employees = Array.from(new Set(reports.map(item => String(item.empleado || '').trim()).filter(Boolean)));
    if (selectedReportEmployee && selectedReportEmployee.trim() && !employees.includes(selectedReportEmployee.trim())) {
        employees.unshift(selectedReportEmployee.trim());
    }
    employees.sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

    const options = ['<option value="">Todos los empleados</option>'];
    employees.forEach(name => {
        const safe = String(name).replace(/"/g, '&quot;');
        options.push(`<option value="${safe}">${escapeHtml(name)}</option>`);
    });

    select.innerHTML = options.join('');
    select.value = selectedReportEmployee || '';
}

function renderReportProductFilterOptions() {
    if (!window.APP_MODEL) return;
    const select = document.getElementById('product-filter');
    if (!select) return;

    const reports = getFilteredReportesForFilter('producto');
    const products = Array.from(new Set(reports.map(item => String(item.producto || '').trim()).filter(Boolean)));
    if (selectedReportProduct && selectedReportProduct.trim() && !products.includes(selectedReportProduct.trim())) {
        products.unshift(selectedReportProduct.trim());
    }
    products.sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

    const options = ['<option value="">Todos los equipos</option>'];
    products.forEach(product => {
        const safe = String(product).replace(/"/g, '&quot;');
        options.push(`<option value="${safe}">${escapeHtml(product)}</option>`);
    });

    select.innerHTML = options.join('');
    select.value = selectedReportProduct || '';
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
                    backgroundColor: [],
                    borderColor: [],
                    borderWidth: 2,
                    hoverOffset: 8
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
                    x: {
                        ticks: {
                            maxRotation: 0,
                            minRotation: 0,
                            callback: function(value, index) {
                                const label = this.chart && this.chart.data && this.chart.data.labels
                                    ? this.chart.data.labels[index] || value
                                    : value;
                                return wrapChartLabel(label, 22);
                            }
                        }
                    },
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
        analysisTypeChart.data.datasets[0].backgroundColor = typeData.colors;
        analysisTypeChart.data.datasets[0].borderColor = typeData.colors.map(color => color || '#fff');
        analysisTypeChart.update();
        renderTypeLegend(typeData.labels, typeData.colors);
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
    ensureInventoryBySheetModel();
    const key = getActiveInventorySheetKey();
    const bundle = getSheetBundle(key);
    const empty = {};
    bundle.columns.forEach(col => {
        empty[col] = '';
    });
    bundle.rows.push(empty);

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
    ensureInventoryBySheetModel();
    const rows = getActiveInventoryRows();
    if (!rows || index < 0 || index >= rows.length) return;
    rows.splice(index, 1);
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

function defaultInventoryFieldMap() {
    return {
        empleado: 'Empleado',
        equipo: 'Equipo',
        marca: 'Marca',
        fechaDevolucion: 'Fecha de devolución',
        descripcion: 'Descripción del problema',
        accion: 'Acción tomada',
        fechaEntrega: 'Fecha que se le entregó uno nuevo',
        estado: 'Estado'
    };
}

function getDefaultInventoryColumns() {
    return [
        'Empleado',
        'Equipo',
        'Marca',
        'Fecha de devolución',
        'Descripción del problema',
        'Acción tomada',
        'Fecha que se le entregó uno nuevo',
        'Estado'
    ];
}

function blankSheetBundle() {
    return {
        columns: getDefaultInventoryColumns().slice(),
        rows: [],
        fieldMap: defaultInventoryFieldMap()
    };
}

function legacyRowToDynamic(row) {
    const fm = defaultInventoryFieldMap();
    const o = {};
    Object.keys(fm).forEach(internal => {
        const col = fm[internal];
        o[col] = row && row[internal] != null ? String(row[internal]) : '';
    });
    return o;
}

function legacyArrayToBundle(arr) {
    return {
        columns: getDefaultInventoryColumns().slice(),
        rows: (arr || []).map(legacyRowToDynamic),
        fieldMap: defaultInventoryFieldMap()
    };
}

function getSheetBundle(sheetKey) {
    ensureInventoryBySheetModel();
    const m = window.APP_MODEL.inventoryBySheet;
    const raw = m[sheetKey];
    if (!raw) {
        return blankSheetBundle();
    }
    if (Array.isArray(raw)) {
        const b = legacyArrayToBundle(raw);
        m[sheetKey] = b;
        return b;
    }
    const defCols = getDefaultInventoryColumns();
    const columns = Array.isArray(raw.columns) && raw.columns.length ? raw.columns.slice() : defCols.slice();
    const fieldMap = (raw.fieldMap && typeof raw.fieldMap === 'object')
        ? Object.assign(defaultInventoryFieldMap(), raw.fieldMap)
        : defaultInventoryFieldMap();
    const rows = Array.isArray(raw.rows) ? raw.rows : [];
    return { columns, rows, fieldMap };
}

function getActiveSheetBundle() {
    return getSheetBundle(getActiveInventorySheetKey());
}

function rowToCanonical(row, fieldMap) {
    const fm = fieldMap || defaultInventoryFieldMap();
    const out = emptyInventoryRow();
    Object.keys(out).forEach(internal => {
        const colKey = fm[internal];
        if (!colKey || !row) return;
        const rawVal = row[colKey];
        if (internal === 'fechaDevolucion' || internal === 'fechaEntrega') {
            const dt = parseDate(String(rawVal || ''));
            out[internal] = dt ? formatDateEs(dt) : String(rawVal || '').trim();
        } else {
            out[internal] = String(rawVal == null ? '' : rawVal).trim();
        }
    });
    return out;
}

function isDynamicRowFilled(row) {
    if (!row || typeof row !== 'object') return false;
    return Object.keys(row).some(k => String(row[k] || '').trim() !== '');
}

function getAllInventoryFlat() {
    const m = window.APP_MODEL && window.APP_MODEL.inventoryBySheet;
    if (!m || typeof m !== 'object') {
        return [];
    }
    return Object.keys(m).flatMap(k => {
        const b = getSheetBundle(k);
        return (b.rows || []).map(row => rowToCanonical(row, b.fieldMap)).filter(isInventoryRowFilled);
    });
}

function ensureInventoryBySheetModel() {
    if (!window.APP_MODEL) {
        window.APP_MODEL = {};
    }
    if (window.APP_MODEL.inventoryBySheet && typeof window.APP_MODEL.inventoryBySheet === 'object') {
        const keys = Object.keys(window.APP_MODEL.inventoryBySheet);
        if (!keys.length) {
            window.APP_MODEL.inventoryBySheet = { Principal: blankSheetBundle() };
        }
        keys.forEach(k => {
            if (Array.isArray(window.APP_MODEL.inventoryBySheet[k])) {
                window.APP_MODEL.inventoryBySheet[k] = legacyArrayToBundle(window.APP_MODEL.inventoryBySheet[k]);
            }
        });
        const cur = window.APP_MODEL.activeInventorySheet;
        if (!cur || !window.APP_MODEL.inventoryBySheet[cur]) {
            window.APP_MODEL.activeInventorySheet = Object.keys(window.APP_MODEL.inventoryBySheet)[0];
        }
        if (!window.APP_MODEL.excelFieldLabels || typeof window.APP_MODEL.excelFieldLabels !== 'object') {
            window.APP_MODEL.excelFieldLabels = getDefaultExcelFieldLabels();
        }
        return;
    }
    const fromFlat = Array.isArray(window.APP_MODEL.inventory) ? window.APP_MODEL.inventory : [];
    window.APP_MODEL.inventoryBySheet = {
        Principal: fromFlat.length ? legacyArrayToBundle(fromFlat) : blankSheetBundle()
    };
    window.APP_MODEL.activeInventorySheet = 'Principal';
    delete window.APP_MODEL.inventory;
    if (!window.APP_MODEL.excelFieldLabels || typeof window.APP_MODEL.excelFieldLabels !== 'object') {
        window.APP_MODEL.excelFieldLabels = getDefaultExcelFieldLabels();
    }
}

function getActiveInventorySheetKey() {
    ensureInventoryBySheetModel();
    const m = window.APP_MODEL.inventoryBySheet;
    const keys = Object.keys(m);
    const cur = window.APP_MODEL.activeInventorySheet;
    if (cur && m[cur]) {
        return cur;
    }
    window.APP_MODEL.activeInventorySheet = keys[0] || 'Principal';
    return window.APP_MODEL.activeInventorySheet;
}

function getActiveInventoryRows() {
    return getActiveSheetBundle().rows;
}

function setActiveInventorySheet(sheetKey) {
    commitActiveEdit();
    ensureInventoryBySheetModel();
    if (!sheetKey || !window.APP_MODEL.inventoryBySheet[sheetKey]) {
        return;
    }
    window.APP_MODEL.activeInventorySheet = sheetKey;
    saveInventoryToStorage();
    renderInventory();
}

function addInventorySheetTab() {
    commitActiveEdit();
    ensureInventoryBySheetModel();
    const suggested = 'Nueva hoja';
    const input = prompt('Nombre de la nueva hoja (como una pestaña de Excel):', suggested);
    if (input === null) {
        return;
    }
    let name = String(input).trim() || suggested;
    const m = window.APP_MODEL.inventoryBySheet;
    const original = name;
    let n = 2;
    while (m[name]) {
        name = `${original} (${n})`;
        n += 1;
    }
    m[name] = blankSheetBundle();
    window.APP_MODEL.activeInventorySheet = name;
    saveInventoryToStorage();
    setTimeout(() => {
        renderInventory();
        renderMetrics();
        renderAnalysis();
        renderAlerts();
        renderReportes();
    }, 50);
}

function getInventoryMetrics() {
    ensureInventoryBySheetModel();
    const filledInventory = getAllInventoryFlat();
    const total = filledInventory.length;
    const resolvedCount = filledInventory.filter(item => item.estado && /resuelto|solucionado|entregado|ok|activo/i.test(item.estado)).length;
    const alertsCount = filledInventory.filter(item => {
        const estado = item.estado || '';
        const isResolved = /resuelto|solucionado|entregado|ok|activo/i.test(estado);
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
    ensureInventoryBySheetModel();
    const inventory = getFilteredAnalysisInventory();
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
        const isResolved = /resuelto|solucionado|entregado|ok|activo/i.test(estadoText);
        
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
    renderAnalysisSheetFilterOptions();
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

function emptyInventoryRow() {
    return {
        empleado: '',
        equipo: '',
        marca: '',
        fechaDevolucion: '',
        descripcion: '',
        accion: '',
        fechaEntrega: '',
        estado: ''
    };
}

function coerceInventoryImportValue(rawValue, field) {
    if (rawValue === null || rawValue === undefined || rawValue === '') {
        return '';
    }
    if ((field === 'fechaDevolucion' || field === 'fechaEntrega') && typeof rawValue === 'number' && Number.isFinite(rawValue)) {
        const serial = Math.floor(rawValue);
        if (serial > 200 && serial < 1000000) {
            const excelEpoch = new Date(1899, 11, 30);
            const dt = new Date(excelEpoch.getTime() + serial * 86400000);
            if (!isNaN(dt)) {
                return formatDateEs(dt);
            }
        }
    }
    if ((field === 'fechaDevolucion' || field === 'fechaEntrega') && rawValue instanceof Date && !isNaN(rawValue)) {
        return formatDateEs(rawValue);
    }
    if (field === 'fechaDevolucion' || field === 'fechaEntrega') {
        const dt = parseDate(String(rawValue).trim());
        if (dt) {
            return formatDateEs(dt);
        }
    }
    return String(rawValue).trim();
}

function isDateLikeColumnKey(colKey) {
    const h = normalizeHeader(String(colKey || ''));
    if (!h) {
        return false;
    }
    if (/cont\.?\s*ini|ini\s*\/\s*fin|conteo|folio\s*ini|nro\.?\s*contrato\s*$/.test(h)) {
        return false;
    }
    if (/datetime|timestamp|vencimiento|caducidad|fecha\s*y\s*hora/.test(h)) {
        return true;
    }
    if (/\bfecha\b|^fecha|fecha$|fecha\s*:|fecha\s+de|fecha\s+del|fecha\s+hasta|fecha\s+desde|\/fecha/.test(h)) {
        return true;
    }
    if (/\bdate\b|^date|_date$|-date$/.test(h)) {
        return true;
    }
    return false;
}

function coerceExcelDateValue(raw) {
    if (raw === null || raw === undefined || raw === '') {
        return '';
    }
    if (raw instanceof Date && !isNaN(raw)) {
        return formatDateEs(raw);
    }
    if (typeof raw === 'number' && Number.isFinite(raw)) {
        const serial = Math.floor(raw);
        if (serial > 200 && serial < 1000000) {
            const excelEpoch = new Date(1899, 11, 30);
            const dt = new Date(excelEpoch.getTime() + serial * 86400000);
            if (!isNaN(dt)) {
                return formatDateEs(dt);
            }
        }
    }
    const s = String(raw).trim();
    const dt = parseDate(s);
    return dt ? formatDateEs(dt) : s;
}

function internalFieldForColumnKey(colKey, fieldMap) {
    const fm = fieldMap || {};
    let found = null;
    Object.keys(fm).forEach(internal => {
        if (fm[internal] === colKey) {
            found = internal;
        }
    });
    return found;
}

function stringifyImportedCell(raw, colKey, fieldMap) {
    const internal = internalFieldForColumnKey(colKey, fieldMap);
    if (internal === 'fechaDevolucion' || internal === 'fechaEntrega') {
        return coerceInventoryImportValue(raw, internal);
    }
    if (isDateLikeColumnKey(colKey)) {
        return coerceExcelDateValue(raw);
    }
    if (raw instanceof Date && !isNaN(raw)) {
        return formatDateEs(raw);
    }
    return raw == null ? '' : String(raw).trim();
}

function makeUniqueColumnKeys(displayHeaders) {
    const used = new Set();
    const columns = [];
    displayHeaders.forEach((base, idx) => {
        let key = String(base == null ? '' : base).trim() || `Columna ${idx + 1}`;
        let candidate = key;
        let n = 2;
        while (used.has(candidate)) {
            candidate = `${key} (${n})`;
            n += 1;
        }
        used.add(candidate);
        columns.push(candidate);
    });
    return columns;
}

function resolveInventoryFieldFromHeader(rawHeader) {
    const h = normalizeHeader(rawHeader);
    if (!h || /^unnamed/.test(h)) {
        return null;
    }

    const exact = {
        empleado: 'empleado',
        equipo: 'equipo',
        marca: 'marca',
        'fecha de devolucion': 'fechaDevolucion',
        'descripcion del problema': 'descripcion',
        descripcion: 'descripcion',
        'accion tomada': 'accion',
        accion: 'accion',
        'fecha que se le entrego uno nuevo': 'fechaEntrega',
        'fecha que se le entregro uno nuevo': 'fechaEntrega',
        estado: 'estado'
    };
    if (exact[h]) {
        return exact[h];
    }

    if (['employee', 'staff', 'worker', 'assignee', 'owner'].includes(h)) return 'empleado';
    if (['device', 'hardware', 'asset', 'equipment'].includes(h)) return 'equipo';
    if (['description', 'issue', 'details', 'notes'].includes(h)) return 'descripcion';
    if (['brand', 'vendor', 'manufacturer'].includes(h)) return 'marca';
    if (['action', 'solution', 'fix'].includes(h)) return 'accion';
    if (['status', 'state'].includes(h)) return 'estado';

    if (/fecha/.test(h) && /(devol|devolucion|return|fallo|incidencia|reporte|recepcion|reclamacion|failure)/.test(h)) {
        return 'fechaDevolucion';
    }
    if (/fecha/.test(h) && /(entreg|nuevo|reemplazo|reposicion|replacement|delivery)/.test(h)) {
        return 'fechaEntrega';
    }
    if (/\bfecha\b/.test(h) && !/(entreg|nuevo|reemplazo|reposicion|replacement|delivery)/.test(h)) {
        return 'fechaDevolucion';
    }

    if (/^(estado|status|situacion)$/.test(h) || h.startsWith('estado ')) return 'estado';
    if (/^(marca|fabricante|vendor)$/.test(h) || /^marca\s/.test(h)) return 'marca';
    if ((/accion|solucion|medida|correctivo|tratamiento|remedy|workaround/.test(h)) && !/descripcion/.test(h)) {
        return 'accion';
    }
    if (/descripcion|problema|incidencia|detalle|motivo|comentario|observacio|falla|diagnostico|denuncia|tipo\s+de\s+fal|symptom|sintoma|causa|asunto/.test(h)) {
        return 'descripcion';
    }

    if (h.includes('maquina') || h.includes('máquina')) {
        return 'equipo';
    }

    if (h.includes('equipo') || ['dispositivo', 'hardware', 'activo', 'producto', 'modelo', 'tipo', 'activo fijo'].includes(h)) {
        if (/problema|descripcion|incidencia|falla|detalle/.test(h)) return null;
        return 'equipo';
    }

    if (/empleado|trabajador|colaborador|responsable|^usuario$|^nombre$|^nombre\s+completo$|persona|assigned|asignad|propietario|titular|solicitante|contacto/.test(h)) {
        return 'empleado';
    }

    return null;
}

function parseMatrixToFullSheetData(aoa, headerIdx) {
    if (!aoa || headerIdx >= aoa.length) {
        return null;
    }
    const rawHeaders = (aoa[headerIdx] || []).map(c => String(c == null ? '' : c).trim());
    let width = Math.max(rawHeaders.length, 1);
    for (let rr = headerIdx + 1; rr < aoa.length; rr++) {
        width = Math.max(width, (aoa[rr] || []).length);
    }
    const padded = [];
    for (let i = 0; i < width; i++) {
        padded.push(rawHeaders[i] != null && rawHeaders[i] !== '' ? rawHeaders[i] : '');
    }
    const displayHeaders = padded.map((h, i) => h || `Columna ${i + 1}`);
    const columns = makeUniqueColumnKeys(displayHeaders);

    const fieldMap = {};
    padded.forEach((raw, i) => {
        const internal = resolveInventoryFieldFromHeader(raw || `Columna ${i + 1}`);
        if (internal && fieldMap[internal] == null) {
            fieldMap[internal] = columns[i];
        }
    });

    const rows = [];
    for (let ri = headerIdx + 1; ri < aoa.length; ri++) {
        const line = aoa[ri] || [];
        const obj = {};
        let any = false;
        columns.forEach((colKey, i) => {
            const raw = line[i];
            const val = stringifyImportedCell(raw, colKey, fieldMap);
            obj[colKey] = val;
            if (val !== '') any = true;
        });
        if (any && isDynamicRowFilled(obj)) {
            rows.push(obj);
        }
    }

    if (!rows.length) {
        return null;
    }

    const headerLabels = {};
    padded.forEach((raw, i) => {
        const internal = resolveInventoryFieldFromHeader(raw || `Columna ${i + 1}`);
        if (internal && raw && headerLabels[internal] == null) {
            headerLabels[internal] = raw;
        }
    });

    const fieldCount = columns.length;
    return { rows, fieldCount, headerLabels, columns, fieldMap };
}

function tryParseInventoryFromSheet(sheet) {
    const emptySd = blankSheetBundle();
    if (!sheet || !sheet['!ref']) {
        return { sheetData: emptySd, headerLabels: {} };
    }
    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
    if (!aoa || !aoa.length) {
        return { sheetData: emptySd, headerLabels: {} };
    }

    let best = null;
    let bestLabels = {};
    let bestKey = -1;
    const maxProbe = Math.min(25, aoa.length);
    for (let hi = 0; hi < maxProbe; hi++) {
        const parsed = parseMatrixToFullSheetData(aoa, hi);
        if (!parsed || !parsed.rows.length) continue;
        const key = parsed.fieldCount * 100000 + parsed.rows.length;
        if (key > bestKey) {
            bestKey = key;
            best = {
                columns: parsed.columns,
                rows: parsed.rows,
                fieldMap: Object.assign(defaultInventoryFieldMap(), parsed.fieldMap)
            };
            bestLabels = parsed.headerLabels || {};
        }
    }
    if (!best) {
        return { sheetData: emptySd, headerLabels: {} };
    }
    return { sheetData: best, headerLabels: bestLabels };
}

function parseInventoryFromWorkbook(workbook) {
    const inventoryBySheet = {};
    const sheetsUsed = [];
    const mergedFieldLabels = {};

    (workbook.SheetNames || []).forEach(name => {
        const sheet = workbook.Sheets[name];
        const { sheetData, headerLabels } = tryParseInventoryFromSheet(sheet);
        const filled = (sheetData.rows || []).filter(isDynamicRowFilled);
        if (filled.length) {
            inventoryBySheet[name] = {
                columns: sheetData.columns,
                rows: filled,
                fieldMap: sheetData.fieldMap || defaultInventoryFieldMap()
            };
            sheetsUsed.push({ name, rows: filled.length });
            Object.keys(headerLabels || {}).forEach(field => {
                if (mergedFieldLabels[field] == null && headerLabels[field]) {
                    mergedFieldLabels[field] = headerLabels[field];
                }
            });
        }
    });

    const totalRows = Object.values(inventoryBySheet).reduce((acc, bundle) => acc + (bundle.rows || []).length, 0);
    return {
        inventoryBySheet,
        importMeta: { sheets: sheetsUsed, totalRows },
        fieldLabels: mergedFieldLabels
    };
}

function loadInventoryFromExcel(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
            const { inventoryBySheet, importMeta, fieldLabels } = parseInventoryFromWorkbook(workbook);
            if (!importMeta.totalRows) {
                alert('No se reconocieron datos de inventario. Incluye al menos dos columnas con encabezados claros (por ejemplo Empleado, Equipo o Descripción / Problema) en alguna fila de la primera zona de la hoja.');
                return;
            }
            if (!window.APP_MODEL) {
                window.APP_MODEL = {};
            }
            window.APP_MODEL.inventoryBySheet = inventoryBySheet;
            const sheetKeys = Object.keys(inventoryBySheet);
            window.APP_MODEL.activeInventorySheet = sheetKeys[0] || 'Principal';
            selectedAnalysisSheet = sheetKeys.length === 1 ? sheetKeys[0] : 'all';
            delete window.APP_MODEL.inventory;
            window.APP_MODEL.excelFieldLabels = Object.assign({}, getDefaultExcelFieldLabels(), fieldLabels || {});
            saveInventoryToStorage();

            renderInventory();
            renderMetrics();
            renderAnalysis();
            renderAlerts();
            renderReportes();

            const sheetSummary = importMeta.sheets.map(s => `${s.name}: ${s.rows}`).join(' · ');
            alert(`Archivo integrado: ${importMeta.totalRows} fila(s) en ${importMeta.sheets.length} hoja(s). Se guardaron todas las columnas tal como vienen en el Excel.\n${sheetSummary}`);
        } catch (error) {
            console.error(error);
            alert('Error al cargar el archivo. Comprueba que sea un Excel o CSV válido.');
        }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
}

function applyExcelHeaderStyle(headerRow) {
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
}

function sanitizeExcelWorksheetName(name) {
    const s = String(name || 'Hoja').replace(/[:\\/?*[\]]/g, '_').trim().substring(0, 31);
    return s || 'Hoja';
}

function uniqueExcelWorksheetName(base, usedSet) {
    let n = sanitizeExcelWorksheetName(base);
    let nTry = n;
    let i = 2;
    while (usedSet.has(nTry)) {
        const suffix = `(${i})`;
        const maxBase = Math.max(1, 31 - suffix.length);
        nTry = (n.substring(0, maxBase) + suffix).substring(0, 31);
        i += 1;
    }
    usedSet.add(nTry);
    return nTry;
}

function exportInventoryExcel() {
    commitActiveEdit();
    saveInventoryToStorage();
    ensureInventoryBySheetModel();
    const bySheet = window.APP_MODEL.inventoryBySheet || {};

    const workbook = new ExcelJS.Workbook();
    const usedNames = new Set();

    Object.keys(bySheet).forEach(sheetKey => {
        const bundle = getSheetBundle(sheetKey);
        const wsName = uniqueExcelWorksheetName(sheetKey, usedNames);
        const worksheet = workbook.addWorksheet(wsName);

        const headerRow = worksheet.addRow(bundle.columns);
        applyExcelHeaderStyle(headerRow);

        (bundle.rows || []).filter(isDynamicRowFilled).forEach(item => {
            const values = bundle.columns.map(colKey => {
                const int = internalFieldForColumnKey(colKey, bundle.fieldMap);
                const raw = item[colKey] != null ? item[colKey] : '';
                if (int === 'fechaDevolucion' || int === 'fechaEntrega' || isDateLikeColumnKey(colKey)) {
                    const d = parseDate(String(raw));
                    return d || '';
                }
                return raw;
            });
            const row = worksheet.addRow(values);

            row.eachCell((cell, colNumber) => {
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FF000000' } },
                    left: { style: 'thin', color: { argb: 'FF000000' } },
                    bottom: { style: 'thin', color: { argb: 'FF000000' } },
                    right: { style: 'thin', color: { argb: 'FF000000' } }
                };
                cell.alignment = { horizontal: 'left', vertical: 'center', wrapText: true };

                const ck = bundle.columns[colNumber - 1];
                const int = internalFieldForColumnKey(ck, bundle.fieldMap);
                if ((int === 'fechaDevolucion' || int === 'fechaEntrega' || isDateLikeColumnKey(ck)) && cell.value) {
                    cell.numFmt = 'dd/mm/yyyy';
                }
            });
        });

        worksheet.columns = bundle.columns.map(() => ({ width: 20 }));
    });

    generateReportesFromInventory();
    const reportes = (window.APP_MODEL && window.APP_MODEL.reportes) ? window.APP_MODEL.reportes : [];
    const reportesWsName = uniqueExcelWorksheetName('Reportes', usedNames);
    const wsReportes = workbook.addWorksheet(reportesWsName);
    const Lrep = getReportTableLabels();
    const reportesHeaders = [Lrep.empleado, Lrep.equipo, Lrep.descripcion, Lrep.fecha];
    const reportesHeaderRow = wsReportes.addRow(reportesHeaders);
    applyExcelHeaderStyle(reportesHeaderRow);

    reportes.forEach(item => {
        const fechaVal = item.fecha instanceof Date ? item.fecha : null;
        const row = wsReportes.addRow([
            item.empleado,
            item.producto,
            item.problema,
            fechaVal
        ]);
        row.eachCell((cell, colNumber) => {
            cell.border = {
                top: { style: 'thin', color: { argb: 'FF000000' } },
                left: { style: 'thin', color: { argb: 'FF000000' } },
                bottom: { style: 'thin', color: { argb: 'FF000000' } },
                right: { style: 'thin', color: { argb: 'FF000000' } }
            };
            cell.alignment = { horizontal: 'left', vertical: 'center', wrapText: true };
            if (colNumber === 4 && cell.value instanceof Date) {
                cell.numFmt = 'dd/mm/yyyy';
            }
        });
    });

    wsReportes.columns = [
        { width: 22 },
        { width: 28 },
        { width: 45 },
        { width: 14 }
    ];
    
    // Guardar archivo
    workbook.xlsx.writeBuffer().then(buffer => {
        saveAs(new Blob([buffer]), 'reportes.xlsx');
    });
}

function renameActiveInventorySheet() {
    commitActiveEdit();
    ensureInventoryBySheetModel();
    const currentKey = getActiveInventorySheetKey();
    if (!currentKey) return;

    const newName = prompt('Nuevo nombre de la hoja:', currentKey);
    if (newName === null) return;

    const sanitized = sanitizeExcelWorksheetName(String(newName).trim());
    if (!sanitized) {
        alert('El nombre de hoja no puede estar vacío ni contener caracteres inválidos.');
        return;
    }

    if (sanitized === currentKey) return;
    const sheets = window.APP_MODEL.inventoryBySheet || {};
    if (sheets[sanitized]) {
        alert('Ya existe una hoja con ese nombre. Usa otro nombre.');
        return;
    }

    sheets[sanitized] = sheets[currentKey];
    delete sheets[currentKey];
    window.APP_MODEL.activeInventorySheet = sanitized;
    if (selectedAnalysisSheet === currentKey) {
        selectedAnalysisSheet = sanitized;
    }

    saveInventoryToStorage();
    renderInventory();
    renderAnalysis();
    renderAlerts();
    renderReportes();
}

function deleteActiveInventorySheet() {
    commitActiveEdit();
    ensureInventoryBySheetModel();
    const currentKey = getActiveInventorySheetKey();
    const sheets = window.APP_MODEL.inventoryBySheet || {};
    if (!currentKey || !sheets[currentKey]) return;

    if (Object.keys(sheets).length <= 1) {
        if (!confirm('Sólo queda una hoja. ¿Deseas vaciar su contenido en lugar de eliminarla?')) {
            return;
        }
        sheets[currentKey] = blankSheetBundle();
        saveInventoryToStorage();
        renderInventory();
        renderAnalysis();
        renderAlerts();
        renderReportes();
        return;
    }

    if (!confirm(`Eliminar la hoja «${currentKey}» y todo su contenido?`)) {
        return;
    }

    delete sheets[currentKey];
    const remainingKeys = Object.keys(sheets);
    window.APP_MODEL.activeInventorySheet = remainingKeys[0] || null;
    if (selectedAnalysisSheet === currentKey) {
        selectedAnalysisSheet = 'all';
    }

    saveInventoryToStorage();
    renderInventory();
    renderAnalysis();
    renderAlerts();
    renderReportes();
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

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function columnUsesDateInput(colKey, fieldMap) {
    const int = internalFieldForColumnKey(colKey, fieldMap);
    if (int === 'fechaDevolucion' || int === 'fechaEntrega') {
        return true;
    }
    return isDateLikeColumnKey(colKey);
}

function renderInventory() {
    const container = document.querySelector('#inventory-panel .tabla-body');
    const tabsEl = document.getElementById('inventory-sheet-tabs');
    if (!container || !window.APP_MODEL) return;

    ensureInventoryBySheetModel();
    const bySheet = window.APP_MODEL.inventoryBySheet;
    const active = getActiveInventorySheetKey();
    const bundle = getActiveSheetBundle();
    const columns = bundle.columns;
    const fieldMap = bundle.fieldMap;
    const inventory = bundle.rows;

    if (tabsEl) {
        tabsEl.innerHTML = '';
        const keys = Object.keys(bySheet);
        keys.forEach(name => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'sheet-tab' + (name === active ? ' active' : '');
            btn.textContent = name;
            btn.title = 'Ver datos de la hoja «' + name + '»';
            btn.addEventListener('click', () => setActiveInventorySheet(name));
            tabsEl.appendChild(btn);
        });
        tabsEl.style.display = keys.length ? 'flex' : 'none';
    }

    if (inventory.length === 0) {
        const safeSheet = String(active).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        container.innerHTML = '<p class="inventory-empty-msg">No hay filas en la hoja «' + safeSheet + '». Cambia de pestaña, pulsa «+ Nueva hoja» o «Añadir registro».</p>';
        renderMetrics();
        renderAnalysis();
        renderAlerts();
        renderReportes();
        return;
    }

    const headerCells = columns.map(h => `<th>${escapeHtml(h)}</th>`).join('') + '<th>Eliminar</th>';

    const rows = inventory.map((item, index) => {
        const cells = columns.map((colKey, ci) => {
            const val = item[colKey] != null ? String(item[colKey]) : '';
            if (columnUsesDateInput(colKey, fieldMap)) {
                return `<td><input type="date" data-index="${index}" data-col-i="${ci}" value="${formatDateForInput(val)}"></td>`;
            }
            return `<td contenteditable="true" data-index="${index}" data-col-i="${ci}">${escapeHtml(val)}</td>`;
        }).join('');
        return `<tr>${cells}<td><button class="delete-row" onclick="deleteInventoryRow(${index})">✕</button></td></tr>`;
    }).join('');

    container.innerHTML = `
        <table class="inventory-table">
            <thead>
                <tr>${headerCells}</tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;

    const editableCells = container.querySelectorAll('td[contenteditable]');
    editableCells.forEach(cell => {
        const saveCell = () => {
            const index = parseInt(cell.dataset.index, 10);
            const colI = parseInt(cell.dataset.colI, 10);
            const value = cell.innerText.trim();
            updateInventoryItem(index, colI, value);
        };

        cell.addEventListener('blur', saveCell);
        cell.addEventListener('input', saveCell);
    });

    const dateInputs = container.querySelectorAll('input[type="date"]');
    dateInputs.forEach(input => {
        const saveInput = () => {
            const index = parseInt(input.dataset.index, 10);
            const colI = parseInt(input.dataset.colI, 10);
            const value = input.value ? formatDateEs(parseDate(input.value)) : '';
            updateInventoryItem(index, colI, value);
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
