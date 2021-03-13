window['ExcalidrawConfig'] = {
  host : 'https://8236d001a819.eu.ngrok.io'
  rootPath: '/roam-excalidraw-plugin/',
  cljCodeVersion: 'excalidraw.app.alpha.x',
  DEBUG: true,
  libs: [
    this.rootPath+'cljs-loader.js',
    this.rootPath+'main.js',
    this.rootPath+'lib/excalidraw-utils.min.js', // https://unpkg.com/@excalidraw/utils@0.1.0-temp/dist
    'https://unpkg.com/react@17/umd/react.production.min.js',
    'https://unpkg.com/react-dom@17/umd/react-dom.production.min.js',
    this.rootPath+'lib/excalidraw.min.js'
  ], // https://unpkg.com/@excalidraw/excalidraw@0.4.3/dist
}


ExcalidrawConfig.libs.forEach(function (x) {
	let s = document.createElement('script');
        s.type = "text/javascript";
        s.src =  x;
        s.async = false;
        document.getElementsByTagName('head')[0].appendChild(s);  
});
