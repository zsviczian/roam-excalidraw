window.ExcalidrawConfig = {};
ExcalidrawConfig.rootPath = 'https://roam-excalidraw.com/dev/';
ExcalidrawConfig.cljCodeVersion = 'excalidraw.app.alpha.x';
ExcalidrawConfig.DEBUG = true;
ExcalidrawConfig.libs = [
  ExcalidrawConfig.rootPath+'cljs-loader.js',
  ExcalidrawConfig.rootPath+'main.js',
  'https://unpkg.com/@excalidraw/utils@0.1.0-temp/dist/excalidraw-utils.min.js',
  'https://unpkg.com/@excalidraw/excalidraw@0.4.3/dist/excalidraw.min.js',
  'https://unpkg.com/react@17/umd/react.production.min.js',
  'https://unpkg.com/react-dom@17/umd/react-dom.production.min.js',
]; 


ExcalidrawConfig.libs.forEach(function (x) {
	let s = document.createElement('script');
  s.type = "text/javascript";
  s.src =  x;
  s.async = false;
  document.getElementsByTagName('head')[0].appendChild(s);  
});
