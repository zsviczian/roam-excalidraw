<?php

// Use in the “Post-Receive URLs” section of your GitHub repo.

//if ( $_POST['payload'] ) {
//shell_exec( ‘cd /home/getmnvmr/roam-excalidraw.com/ && git reset –hard HEAD && git pull’ );
//}

$output = shell_exec( 'cd /home/getmnvmr/roam-excalidraw.com/ && git pull' );
echo "<pre>$output</pre>"
?>