<?php
 // Allow from any origin
 if (isset($_SERVER['HTTP_ORIGIN'])) {
    // should do a check here to match $_SERVER['HTTP_ORIGIN'] to a
    // whitelist of safe domains
    header("Access-Control-Allow-Origin: {$_SERVER['HTTP_ORIGIN']}");
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Max-Age: 86400');    // cache for 1 day
}
// Access-Control headers are received during OPTIONS requests
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {

    if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_METHOD']))
        header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");         

    if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']))
        header("Access-Control-Allow-Headers: {$_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']}");

}
$filename = basename($_GET['f']);
$channel = ($_GET['c']);

// Specify file path.
$path = '/home/getmnvmr/roam-excalidraw.com/';
$download_file =  $path.$channel.'/'.$filename;

$jsobject = '';
if($filename == 'main-component.cljs') {
  $jsobject = 'ExcalidrawConfig.mainComponent = `';
} 
else if ($filename == 'data-component.cljs') {
  $jsobject = 'ExcalidrawConfig.dataComponent = `';
}

if(!empty($jsobject)){
    // Check file is exists on given path.
    if(file_exists($download_file))
    {
    //  header('Content-Disposition: attachment; filename=' . $filename);  
    //  readfile($download_file); 
    //  exit;
      header('content-type: application/javascript');
      $code = file_get_contents($download_file);
      echo $jsobject.$code.'`;';
    }
    else
    {
      echo 'File does not exists on given path :' . $channel ;
    }
 }
 ?>
