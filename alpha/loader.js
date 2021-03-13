window.ExcalidrawConfig = {
  rootPath: 'https://roam-excalidraw.com/',
  channel: 'alpha',
  cljCodeVersion: 'excalidraw.app.alpha.v10',
  DEBUG : false,
  sketchingUID : 'sketching',
  excalDATAUID : 'ExcalDATA',
  libs: [],
}

function getClojureNS(blockUID) {
  q = `[:find ?s . :where [?e :block/uid "${blockUID}"][?e :block/string ?s]]`;
  renderString = window.roamAlphaAPI.q(q);
  if(renderString != null) { 
    ptrn = /\(ns (.*)\s/g;
    res = ptrn.exec(renderString);
    if(res == null) return '';
    return res[1];
  }
  return '';
}

if (getClojureNS(ExcalidrawConfig.sketchingUID) != ExcalidrawConfig.cljCodeVersion) {
  ExcalidrawConfig.libs.push (ExcalidrawConfig.rootPath + 'get.php?c='+ExcalidrawConfig.channel);
  console.log('Excalidraw loader - need to update roam/render components');
}
else {
  delete ExcalidrawConfig.sketchingUID;
  delete ExcalidrawConfig.excalDATAUID;
}

ExcalidrawConfig.libs.push (ExcalidrawConfig.rootPath+ExcalidrawConfig.channel+'/main.js');
ExcalidrawConfig.libs.push ('https://unpkg.com/react@17/umd/react.production.min.js');
ExcalidrawConfig.libs.push ('https://unpkg.com/react-dom@17/umd/react-dom.production.min.js');
ExcalidrawConfig.libs.push ('https://unpkg.com/@excalidraw/excalidraw@0.4.3/dist/excalidraw.min.js');
ExcalidrawConfig.libs.push ('https://unpkg.com/@excalidraw/utils@0.1.0-temp/dist/excalidraw-utils.min.js');
 

ExcalidrawConfig.libs.forEach(function (x) {
	s = document.createElement('script');
  s.type = "text/javascript";
  s.src =  x;
  s.async = false;
  document.getElementsByTagName('head')[0].appendChild(s);  
});

delete ExcalidrawConfig.libs;
delete ExcalidrawConfig.rootPath;
delete ExcalidrawConfig.channel;
getClojureNS = undefined;
delete ExcalidrawConfig.cljCodeVersion;