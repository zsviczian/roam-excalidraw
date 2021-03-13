window.ExcalidrawConfig = {};
ExcalidrawConfig.rootPath = 'http://localhost:8080/roam-excalidraw-plugin/';
ExcalidrawConfig.cljCodeVersion = 'excalidraw.app.alpha.x';
ExcalidrawConfig.DEBUG = true;
ExcalidrawConfig.libs = [
  ExcalidrawConfig.rootPath+'cljs-loader.js',
  ExcalidrawConfig.rootPath+'main.js',
  ExcalidrawConfig.rootPath+'lib/excalidraw-utils.min.js', // https://unpkg.com/@excalidraw/utils@0.1.0-temp/dist
  ExcalidrawConfig.rootPath+'lib/excalidraw.min.js', // https://unpkg.com/@excalidraw/excalidraw@0.4.3/dist
  'https://unpkg.com/react@17/umd/react.production.min.js',
  'https://unpkg.com/react-dom@17/umd/react-dom.production.min.js',
]; 


window.ExcalidrawConfig.libs.forEach(function (x) {
	let s = document.createElement('script');
  s.type = "text/javascript";
  s.src =  x;
  s.async = false;
  document.getElementsByTagName('head')[0].appendChild(s);  
});
