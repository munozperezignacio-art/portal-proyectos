const fs = require('fs');
const path = require('path');

const mappings = {
    'obras.csv': {
        'Nombre_Obra': 'nombre',
        'Tipo_Proyecto': 'tipo',
        'Link_Drive': 'link',
        'Area': 'area',
        'Admin_Contrato': 'administrador',
        'Oficina Tecnica': 'oficina_tecnica',
        'Prevencionista ': 'prevencionista' // Con espacio al final
    },
    'usuarios.csv': {
        'Usuario': 'usuario',
        'Empresa': 'empresa',
        'Contrasena': 'contrasena',
        'Rol': 'rol',
        'Obras_Permitidas': 'obras',
        'Modulos_Permitidos': 'modulos',
        'Correo': 'correo',
        'TrabajadorRUT': 'trabajador_rut'
    },
    'maestro_personal.csv': {
        'Obra': 'obra_nombre',
        'Trabajador': 'nombre',
        'Rut': 'rut',
        'Cargo': 'cargo',
        'Fecha_Inicio': 'inicio',
        'Fecha_Termino': 'termino'
    },
    'inventario_maquinaria.csv': {
        'Tipo_Maquinaria': 'tipo',
        'Patente_Cod_Interno': 'patente',
        'Marca_Modelo': 'marca',
        'Obra_Asignada': 'obra_nombre'
    },
    'partidas_obra.csv': {
        'Nombre_Obra': 'obra_nombre',
        'Actividad_Partida': 'partida',
        'Unidad_Control': 'unidad',
        'Rendimiento_Meta': 'rendimiento_meta',
        'Cantidad_Presupuestada': 'cantidad_presupuestada',
        'Costo por Día': 'costo_por_dia'
    },
    'config_correos.csv': {
        'Tipo_Reporte': 'tipo',
        'Correos': 'correos'
    }
};

function cleanCSV(filename) {
    const filePath = path.join(__dirname, filename);
    if (!fs.existsSync(filePath)) {
        console.log(`[Advertencia] No se encontró el archivo: ${filename}`);
        return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    // Separar por líneas
    let lines = content.split(/\r?\n/);
    if (lines.length === 0) return;

    // Leer cabeceras
    let headersLine = lines[0];
    // Resolver comillas y separar cabeceras por coma
    // Nota: Un parseador básico de CSV para la primera línea
    let headers = parseHeaders(headersLine);

    console.log(`\nProcesando cabeceras de ${filename}:`);
    console.log(`Originales: ${headers.map(h => `"${h}"`).join(', ')}`);

    const mapping = mappings[filename];
    let newHeaders = headers.map(h => {
        const trimmed = h.trim();
        // Si hay una mapeo exacto (incluyendo espacios extra o comillas)
        if (mapping[trimmed]) return mapping[trimmed];
        if (mapping[h]) return mapping[h];
        // Caso fallback: minúsculas y espacios a guiones bajos
        return trimmed.toLowerCase().replace(/\s+/g, '_');
    });

    // Encontrar columnas válidas (omitir cabeceras vacías)
    const validIndices = [];
    const cleanHeaders = [];
    for (let i = 0; i < newHeaders.length; i++) {
        if (newHeaders[i] && newHeaders[i] !== '') {
            validIndices.push(i);
            cleanHeaders.push(newHeaders[i]);
        }
    }

    console.log(`Nuevas:     ${cleanHeaders.map(h => `"${h}"`).join(', ')}`);

    // Procesar filas de datos
    let newLines = [cleanHeaders.join(',')];
    for (let i = 1; i < lines.length; i++) {
        let line = lines[i].trim();
        if (line === '') continue; // Omitir líneas vacías

        let values = parseLine(line);
        // Filtrar solo los valores con columnas de cabecera válidas
        let validValues = validIndices.map(idx => {
            let val = values[idx] || '';
            // Si el valor contiene comas o comillas, envolver en comillas dobles y escapar
            if (val.includes(',') || val.includes('"') || val.includes('\n')) {
                val = `"${val.replace(/"/g, '""')}"`;
            }
            return val;
        });
        newLines.push(validValues.join(','));
    }

    // Escribir archivo de vuelta (añadiendo el prefijo clean_)
    const outputFilename = 'clean_' + filename;
    fs.writeFileSync(path.join(__dirname, outputFilename), newLines.join('\n'), 'utf8');
    console.log(`¡Archivo guardado con éxito como ${outputFilename}!`);
}

// Parseador simple de cabeceras de CSV que respeta comillas dobles
function parseHeaders(line) {
    let result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        let char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

// Parseador simple de filas de CSV que respeta comillas dobles
function parseLine(line) {
    let result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        let char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
            // Si es doble comilla escapada dentro de comillas
            if (i + 1 < line.length && line[i+1] === '"' && inQuotes) {
                current += '"';
                i++;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

// Ejecutar para todos los archivos configurados
Object.keys(mappings).forEach(cleanCSV);
console.log('\n--- LIMPIEZA COMPLETADA ---');
