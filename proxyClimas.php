<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

// Leer los datos del cuerpo del POST
$input = json_decode(file_get_contents('php://input'), true);

// Validar que estén los cuatro campos necesarios
if (
    !$input ||
    !isset($input['fechaDesde']) ||
    !isset($input['fechaHasta']) ||
    !isset($input['estacion']) ||
    !isset($input['codigo'])
) {
    echo json_encode(['error' => 'Datos incompletos']);
    exit;
}

// Armar el cuerpo del POST
$postData = [
    "fechaDesde" => $input['fechaDesde'],
    "fechaHasta" => $input['fechaHasta'],
    "estacion"   => $input['estacion'],
    "codigo"     => intval($input['codigo']) // asegurar que sea número
];

// Enviar al endpoint remoto
$curl = curl_init('https://snih.hidricosargentina.gob.ar/MuestraDatos.aspx/LeerUltimosRegistros');
curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
curl_setopt($curl, CURLOPT_POST, true);
curl_setopt($curl, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($curl, CURLOPT_POSTFIELDS, json_encode($postData));

$response = curl_exec($curl);

if (curl_errno($curl)) {
    echo json_encode(['error' => 'Error al contactar el servidor remoto']);
    curl_close($curl);
    exit;
}

curl_close($curl);

// Devolver el JSON original sin modificar
echo $response;
