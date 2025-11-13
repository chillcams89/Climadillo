<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$data = ['estacion' => '284094'];
$options = [
  'http' => [
    'method'  => 'POST',
    'header'  => "Content-Type: application/json",
    'content' => json_encode($data)
  ]
];

$context = stream_context_create($options);
$response = file_get_contents("https://snih.hidricosargentina.gob.ar/MuestraDatos.aspx/LeerDatosActuales", false, $context);
echo $response;
?>