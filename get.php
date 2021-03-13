<?php
  $channel = ($_GET['c']);
  $path = '/home/getmnvmr/roam-excalidraw.com/'.$channel.'/';

  header('content-type: application/javascript');
  $response = 'ExcalidrawConfig.mainComponent = `';
  $code = file_get_contents($path.'main-component.cljs');
  $response = $response.$code.'`; ';

  $response = $response.'ExcalidrawConfig.dataComponent = `';
  $code = file_get_contents($path.'data-component.cljs');
  $response = $response.$code.'`; ';
  $code = file_get_contents($path.'cljs-loader.js');

  echo $response.$code;
?>
