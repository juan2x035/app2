<?php
/**
 * =====================================================================
 * COTIZADOR 3D PRO - BACKEND PHP PARA GUARDAR INFORMACIÓN
 * Archivo: guardar.php
 * 
 * Permite guardar y recuperar de manera persistente:
 * - Usuarios y autenticación
 * - Perfiles de clientes y vendedores
 * - Catálogo de vendedores, materiales y tarifas de taller
 * - Reseñas y calificaciones de 1 a 5 estrellas
 * - Historial completo de cotizaciones realizadas
 * - Mensajes de chat y contacto
 * =====================================================================
 */

// Encabezados para API REST y soporte CORS
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

// Responder a solicitudes OPTIONS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Ruta del archivo de base de datos JSON persistente
$archivoBD = __DIR__ . '/datos_guardados.json';

/**
 * Datos semilla iniciales si la base de datos no existe aún
 */
function obtenerDatosIniciales() {
    return [
        'usuarios' => [],
        'perfiles' => [],
        'vendedores' => [
            'pedro' => [
                'id' => 'pedro',
                'nombre' => 'Pedro Impresiones',
                'nota' => 'Especialista en piezas técnicas y prototipado rápido en Bogotá',
                'hora' => 2500,
                'margen' => 15,
                'tel' => '573001234567',
                'ciudad' => 'Bogotá',
                'insignia' => 'Taller Verificado',
                'mat' => [
                    'PLA' => 65000,
                    'PETG' => 78000,
                    'ABS' => 82000,
                    'TPU' => 115000,
                    'Resina' => 130000
                ]
            ],
            'enrique' => [
                'id' => 'enrique',
                'nombre' => 'Enrique 3D Studio',
                'nota' => 'El mejor precio en materiales estándar y figuras decorativas',
                'hora' => 3800,
                'margen' => 20,
                'tel' => '573109876543',
                'ciudad' => 'Medellín',
                'insignia' => 'Top Ventas',
                'mat' => [
                    'PLA' => 55000,
                    'PETG' => 65000,
                    'ABS' => 70000,
                    'TPU' => 95000,
                    'Nylon' => 140000
                ]
            ],
            'laura' => [
                'id' => 'laura',
                'nombre' => 'Laura Print Lab',
                'nota' => 'Acabados finos de alta precisión y resina de ingeniería',
                'hora' => 3200,
                'margen' => 18,
                'tel' => '573155554433',
                'ciudad' => 'Cali',
                'insignia' => 'Precisión Alta',
                'mat' => [
                    'PLA' => 60000,
                    'PETG' => 72000,
                    'Resina' => 120000,
                    'TPU' => 105000
                ]
            ]
        ],
        'resenas' => [
            'pedro' => [
                'votos' => ['u_demo1' => 5, 'u_demo2' => 4],
                'comentarios' => [
                    ['autor' => 'Carlos M.', 'estrellas' => 5, 'texto' => 'Excelente acabado y entrega puntual.', 'fecha' => '2026-10-15']
                ]
            ],
            'enrique' => [
                'votos' => ['u_demo1' => 5, 'u_demo3' => 5],
                'comentarios' => [
                    ['autor' => 'Valeria S.', 'estrellas' => 5, 'texto' => 'Precios inmejorables en PETG.', 'fecha' => '2026-10-18']
                ]
            ],
            'laura' => [
                'votos' => ['u_demo2' => 5],
                'comentarios' => [
                    ['autor' => 'David R.', 'estrellas' => 5, 'texto' => 'Gran detalle en impresiones de resina.', 'fecha' => '2026-10-20']
                ]
            ]
        ],
        'cotizaciones' => [],
        'mensajes' => []
    ];
}

/**
 * Lee la base de datos de disco de manera segura
 */
function cargarBD($archivo) {
    if (!file_exists($archivo)) {
        $inicial = obtenerDatosIniciales();
        file_put_contents($archivo, json_encode($inicial, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
        return $inicial;
    }
    $contenido = file_get_contents($archivo);
    $datos = json_decode($contenido, true);
    if (!is_array($datos)) {
        return obtenerDatosIniciales();
    }
    // Asegurar estructura
    $claves = ['usuarios', 'perfiles', 'vendedores', 'resenas', 'cotizaciones', 'mensajes'];
    foreach ($claves as $c) {
        if (!isset($datos[$c])) {
            $datos[$c] = ($c === 'cotizaciones' || $c === 'mensajes') ? [] : [];
        }
    }
    return $datos;
}

/**
 * Guarda los datos en el archivo con bloqueo exclusivo atómico
 */
function salvarBD($archivo, $datos) {
    $json = json_encode($datos, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    return file_put_contents($archivo, $json, LOCK_EX) !== false;
}

// Obtener payload (JSON del cuerpo o parámetros POST/GET)
$entradaCruda = file_get_contents('php://input');
$solicitud = [];
if (!empty($entradaCruda)) {
    $solicitud = json_decode($entradaCruda, true) ?: [];
}
if (empty($solicitud)) {
    $solicitud = $_POST ?: $_GET ?: [];
}

$accion = isset($solicitud['accion']) ? trim($solicitud['accion']) : (isset($_GET['accion']) ? trim($_GET['accion']) : 'obtener_todo');

$bd = cargarBD($archivoBD);

// Procesar según la acción solicitada
try {
    switch ($accion) {

        // ==========================================
        // 1. OBTENER TODO EL ESTADO O REFRESCAR
        // ==========================================
        case 'obtener_todo':
        case 'leer':
            echo json_encode([
                'ok' => true,
                'mensaje' => 'Datos cargados exitosamente',
                'datos' => [
                    'vendedores' => $bd['vendedores'],
                    'resenas' => $bd['resenas'],
                    'cotizaciones' => $bd['cotizaciones'],
                    'perfiles' => $bd['perfiles']
                ]
            ], JSON_UNESCAPED_UNICODE);
            exit;

        // ==========================================
        // 2. REGISTRAR O ACTUALIZAR USUARIO
        // ==========================================
        case 'guardar_usuario':
            $correo = strtolower(trim($solicitud['correo'] ?? ''));
            $clave = trim($solicitud['clave'] ?? '');
            $esNuevo = !empty($solicitud['es_nuevo']);

            if (empty($correo) || strlen($clave) < 6) {
                http_response_code(400);
                echo json_encode(['ok' => false, 'error' => 'Correo inválido o contraseña menor a 6 caracteres.']);
                exit;
            }

            // Buscar si ya existe el correo
            $usuarioIdExistente = null;
            foreach ($bd['usuarios'] as $uid => $u) {
                if ($u['correo'] === $correo) {
                    $usuarioIdExistente = $uid;
                    break;
                }
            }

            if ($esNuevo) {
                if ($usuarioIdExistente !== null) {
                    http_response_code(400);
                    echo json_encode(['ok' => false, 'error' => 'Este correo ya se encuentra registrado.']);
                    exit;
                }
                $nuevoId = 'u_' . uniqid() . '_' . substr(md5(mt_rand()), 0, 4);
                $hash = hash('sha256', $clave);
                $bd['usuarios'][$nuevoId] = [
                    'id' => $nuevoId,
                    'correo' => $correo,
                    'clave' => $hash,
                    'creado_en' => date('Y-m-d H:i:s')
                ];
                salvarBD($archivoBD, $bd);

                echo json_encode([
                    'ok' => true,
                    'mensaje' => 'Cuenta creada con éxito',
                    'usuario' => ['id' => $nuevoId, 'correo' => $correo]
                ], JSON_UNESCAPED_UNICODE);
                exit;
            } else {
                // Iniciar sesión
                if ($usuarioIdExistente === null) {
                    http_response_code(401);
                    echo json_encode(['ok' => false, 'error' => 'Usuario no encontrado o correo incorrecto.']);
                    exit;
                }
                $u = $bd['usuarios'][$usuarioIdExistente];
                $hash = hash('sha256', $clave);
                if ($u['clave'] !== $hash && $u['clave'] !== $clave) {
                    http_response_code(401);
                    echo json_encode(['ok' => false, 'error' => 'Contraseña incorrecta.']);
                    exit;
                }

                $perfil = $bd['perfiles'][$usuarioIdExistente] ?? null;
                $vendedor = $bd['vendedores'][$usuarioIdExistente] ?? null;

                echo json_encode([
                    'ok' => true,
                    'mensaje' => 'Sesión iniciada correctamente',
                    'usuario' => ['id' => $usuarioIdExistente, 'correo' => $correo],
                    'perfil' => $perfil,
                    'vendedor' => $vendedor
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }

        // ==========================================
        // 3. GUARDAR O EDITAR PERFIL Y TALLER
        // ==========================================
        case 'guardar_perfil':
            $userId = trim($solicitud['id'] ?? '');
            $nombre = trim($solicitud['nombre'] ?? '');
            $tel = preg_replace('/\D/', '', $solicitud['tel'] ?? '');
            $rol = trim($solicitud['rol'] ?? 'cliente');

            if (empty($userId) || empty($nombre)) {
                http_response_code(400);
                echo json_encode(['ok' => false, 'error' => 'Faltan campos obligatorios (ID o Nombre).']);
                exit;
            }

            $bd['perfiles'][$userId] = [
                'id' => $userId,
                'nombre' => htmlspecialchars($nombre, ENT_QUOTES, 'UTF-8'),
                'tel' => $tel,
                'rol' => $rol,
                'actualizado_en' => date('Y-m-d H:i:s')
            ];

            if ($rol === 'vendedor') {
                $nota = trim($solicitud['nota'] ?? 'Taller de impresión 3D');
                $hora = max(500, floatval($solicitud['hora'] ?? 3000));
                $margen = max(0, min(200, floatval($solicitud['margen'] ?? 20)));
                $ciudad = trim($solicitud['ciudad'] ?? 'Colombia');
                $materiales = is_array($solicitud['mat'] ?? null) ? $solicitud['mat'] : [
                    'PLA' => 65000,
                    'PETG' => 75000,
                    'ABS' => 80000,
                    'TPU' => 110000
                ];

                // Limpiar valores numéricos de materiales
                $matLimpios = [];
                foreach ($materiales as $mNombre => $mPrecio) {
                    $mNombreLimpio = htmlspecialchars(trim($mNombre), ENT_QUOTES, 'UTF-8');
                    $matLimpios[$mNombreLimpio] = max(1000, floatval($mPrecio));
                }

                $bd['vendedores'][$userId] = [
                    'id' => $userId,
                    'nombre' => htmlspecialchars($nombre, ENT_QUOTES, 'UTF-8'),
                    'nota' => htmlspecialchars($nota, ENT_QUOTES, 'UTF-8'),
                    'tel' => $tel,
                    'ciudad' => htmlspecialchars($ciudad, ENT_QUOTES, 'UTF-8'),
                    'hora' => $hora,
                    'margen' => $margen,
                    'insignia' => 'Taller Activo',
                    'mat' => $matLimpios,
                    'actualizado_en' => date('Y-m-d H:i:s')
                ];
            } else {
                // Si cambió a cliente, retirar del listado público de vendedores si existía
                unset($bd['vendedores'][$userId]);
            }

            salvarBD($archivoBD, $bd);
            echo json_encode([
                'ok' => true,
                'mensaje' => 'Perfil guardado exitosamente en el servidor PHP',
                'perfil' => $bd['perfiles'][$userId],
                'vendedor' => $bd['vendedores'][$userId] ?? null
            ], JSON_UNESCAPED_UNICODE);
            exit;

        // ==========================================
        // 4. GUARDAR TALLER (TARIFAS Y MATERIALES)
        // ==========================================
        case 'guardar_taller':
            $userId = trim($solicitud['id'] ?? '');
            if (empty($userId) || !isset($bd['vendedores'][$userId])) {
                http_response_code(400);
                echo json_encode(['ok' => false, 'error' => 'Vendedor no encontrado.']);
                exit;
            }

            $hora = max(100, floatval($solicitud['hora'] ?? 2500));
            $margen = max(0, min(300, floatval($solicitud['margen'] ?? 20)));
            $mats = is_array($solicitud['mat'] ?? null) ? $solicitud['mat'] : [];

            $bd['vendedores'][$userId]['hora'] = $hora;
            $bd['vendedores'][$userId]['margen'] = $margen;
            if (!empty($mats)) {
                $bd['vendedores'][$userId]['mat'] = $mats;
            }
            if (!empty($solicitud['nota'])) {
                $bd['vendedores'][$userId]['nota'] = htmlspecialchars(trim($solicitud['nota']), ENT_QUOTES, 'UTF-8');
            }
            $bd['vendedores'][$userId]['actualizado_en'] = date('Y-m-d H:i:s');

            salvarBD($archivoBD, $bd);
            echo json_encode([
                'ok' => true,
                'mensaje' => 'Configuración del taller guardada en el servidor',
                'vendedor' => $bd['vendedores'][$userId]
            ], JSON_UNESCAPED_UNICODE);
            exit;

        // ==========================================
        // 5. GUARDAR UNA NUEVA COTIZACIÓN
        // ==========================================
        case 'guardar_cotizacion':
            $cotizacion = $solicitud['cotizacion'] ?? null;
            if (!is_array($cotizacion)) {
                http_response_code(400);
                echo json_encode(['ok' => false, 'error' => 'Datos de cotización inválidos.']);
                exit;
            }

            $idCot = 'COT-' . strtoupper(substr(uniqid(), -6)) . '-' . rand(100, 999);
            $nuevaCotizacion = [
                'id' => $idCot,
                'fecha' => date('Y-m-d H:i:s'),
                'cliente_id' => $cotizacion['cliente_id'] ?? 'invitado',
                'cliente_nombre' => htmlspecialchars($cotizacion['cliente_nombre'] ?? 'Cliente', ENT_QUOTES, 'UTF-8'),
                'cliente_tel' => preg_replace('/\D/', '', $cotizacion['cliente_tel'] ?? ''),
                'vendedor_id' => $cotizacion['vendedor_id'] ?? '',
                'vendedor_nombre' => htmlspecialchars($cotizacion['vendedor_nombre'] ?? '', ENT_QUOTES, 'UTF-8'),
                'pieza_nombre' => htmlspecialchars($cotizacion['pieza_nombre'] ?? 'Pieza 3D', ENT_QUOTES, 'UTF-8'),
                'material' => htmlspecialchars($cotizacion['material'] ?? 'PLA', ENT_QUOTES, 'UTF-8'),
                'horas' => floatval($cotizacion['horas'] ?? 0),
                'minutos' => floatval($cotizacion['minutos'] ?? 0),
                'gramos' => floatval($cotizacion['gramos'] ?? 0),
                'cantidad' => max(1, intval($cotizacion['cantidad'] ?? 1)),
                'costo_tiempo' => floatval($cotizacion['costo_tiempo'] ?? 0),
                'costo_material' => floatval($cotizacion['costo_material'] ?? 0),
                'costo_margen' => floatval($cotizacion['costo_margen'] ?? 0),
                'total' => floatval($cotizacion['total'] ?? 0),
                'estado' => 'guardada', // guardada | contactado | aceptada | terminada
                'notas' => htmlspecialchars($cotizacion['notas'] ?? '', ENT_QUOTES, 'UTF-8')
            ];

            // Guardar al inicio del arreglo de cotizaciones
            array_unshift($bd['cotizaciones'], $nuevaCotizacion);

            // Mantener máximo 500 cotizaciones históricas
            if (count($bd['cotizaciones']) > 500) {
                $bd['cotizaciones'] = array_slice($bd['cotizaciones'], 0, 500);
            }

            salvarBD($archivoBD, $bd);
            echo json_encode([
                'ok' => true,
                'mensaje' => 'Cotización ' . $idCot . ' guardada con éxito',
                'cotizacion' => $nuevaCotizacion
            ], JSON_UNESCAPED_UNICODE);
            exit;

        // ==========================================
        // 6. GUARDAR CALIFICACIÓN O RESEÑA
        // ==========================================
        case 'guardar_resena':
            $vendedorId = trim($solicitud['vendedor_id'] ?? '');
            $usuarioId = trim($solicitud['usuario_id'] ?? '');
            $estrellas = max(1, min(5, intval($solicitud['estrellas'] ?? 5)));
            $comentario = trim($solicitud['comentario'] ?? '');
            $autor = trim($solicitud['autor'] ?? 'Cliente');

            if (empty($vendedorId)) {
                http_response_code(400);
                echo json_encode(['ok' => false, 'error' => 'Falta el ID del vendedor.']);
                exit;
            }

            if (!isset($bd['resenas'][$vendedorId])) {
                $bd['resenas'][$vendedorId] = ['votos' => [], 'comentarios' => []];
            }

            // Registrar voto de este usuario
            $bd['resenas'][$vendedorId]['votos'][$usuarioId] = $estrellas;

            // Si hay comentario, agregarlo
            if (!empty($comentario)) {
                $bd['resenas'][$vendedorId]['comentarios'][] = [
                    'autor' => htmlspecialchars($autor, ENT_QUOTES, 'UTF-8'),
                    'estrellas' => $estrellas,
                    'texto' => htmlspecialchars($comentario, ENT_QUOTES, 'UTF-8'),
                    'fecha' => date('Y-m-d')
                ];
            }

            salvarBD($archivoBD, $bd);
            echo json_encode([
                'ok' => true,
                'mensaje' => 'Calificación de ' . $estrellas . ' estrellas registrada.',
                'resena' => $bd['resenas'][$vendedorId]
            ], JSON_UNESCAPED_UNICODE);
            exit;

        // ==========================================
        // 7. GUARDAR MENSAJE DE CHAT
        // ==========================================
        case 'guardar_mensaje':
            $de = trim($solicitud['de'] ?? 'cliente');
            $vendedorId = trim($solicitud['vendedor_id'] ?? '');
            $texto = trim($solicitud['texto'] ?? '');

            if (empty($vendedorId) || empty($texto)) {
                http_response_code(400);
                echo json_encode(['ok' => false, 'error' => 'Mensaje o destinatario vacío.']);
                exit;
            }

            if (!isset($bd['mensajes'][$vendedorId])) {
                $bd['mensajes'][$vendedorId] = [];
            }

            $nuevoMsj = [
                'de' => htmlspecialchars($de, ENT_QUOTES, 'UTF-8'),
                'texto' => htmlspecialchars($texto, ENT_QUOTES, 'UTF-8'),
                'fecha' => date('H:i')
            ];

            $bd['mensajes'][$vendedorId][] = $nuevoMsj;
            salvarBD($archivoBD, $bd);

            echo json_encode([
                'ok' => true,
                'mensaje' => 'Mensaje registrado',
                'item' => $nuevoMsj
            ], JSON_UNESCAPED_UNICODE);
            exit;

        // ==========================================
        // 8. BORRAR CUENTA
        // ==========================================
        case 'borrar_cuenta':
            $userId = trim($solicitud['id'] ?? '');
            if (empty($userId)) {
                http_response_code(400);
                echo json_encode(['ok' => false, 'error' => 'ID no especificado.']);
                exit;
            }

            unset($bd['usuarios'][$userId]);
            unset($bd['perfiles'][$userId]);
            unset($bd['vendedores'][$userId]);

            salvarBD($archivoBD, $bd);
            echo json_encode(['ok' => true, 'mensaje' => 'Cuenta eliminada del servidor']);
            exit;

        // Acción no reconocida
        default:
            http_response_code(400);
            echo json_encode([
                'ok' => false,
                'error' => 'Acción no reconocida: ' . htmlspecialchars($accion, ENT_QUOTES, 'UTF-8')
            ]);
            exit;
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => 'Error interno en el servidor PHP: ' . $e->getMessage()
    ]);
    exit;
}
