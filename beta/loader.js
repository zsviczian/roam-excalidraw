if (typeof window.ExcalidrawWrapper === 'undefined') {
  window.ExcalidrawConfig = {
    rootPath: 'https://roam-excalidraw.com/',
    channel: 'beta',
    cljCodeVersion: 'excalidraw.app.beta.v10',
    DEBUG : false,
    sketchingUID : 'sketching',
    excalDATAUID : 'ExcalDATA',
    excalSVGUID  : 'ExcalSVG_',
    settingsUID  : 'ExcalSET_',
    log (...args) {console.log("<<< Roam-Excalidraw loader >>> ",...args)},
  }

  const addElementToPage = (element, tagId, typeT )=> {
    try { document.getElementById(tagId).remove() } catch(e){};  //Delete any existing reference
    Object.assign(element, { type:typeT, async:false, id:tagId } );
    document.getElementsByTagName('head')[0].appendChild(element);
  }

  ExcalidrawConfig.addScriptToPage = (tagId, script)=> {
    addElementToPage(Object.assign(document.createElement('script'),{src:script}) , tagId, 'text/javascript');
  }

  ExcalidrawConfig.addCSSToPage = (tagId, cssToAdd)=> {
    addElementToPage(Object.assign(document.createElement('link'),{href:cssToAdd, rel: 'stylesheet'} ) , tagId, 'text/css');
  }

  function getClojureNS(blockUID) {
    q = `[:find ?s . :where [?e :block/uid "${blockUID}"][?e :block/string ?s]]`;
    renderString = window.roamAlphaAPI.q(q);
    if(renderString != null) { 
      ptrn = /\(ns (.*)\s/g;
      let res = ptrn.exec(renderString);
      ExcalidrawConfig.log('loader.js','getClojureNS NS:',res);
      if(res == null) return '';
      return res[1];
    }
    ExcalidrawConfig.log('loader.js','getClojureNS NS is EMPTY');
    return '';
  } 

  ( async ()=>{
    ExcalidrawConfig.log('loader.js','rootPath:',ExcalidrawConfig.rootPath,'channel:',ExcalidrawConfig.channel,'debug?',ExcalidrawConfig.DEBUG);
      if (getClojureNS(ExcalidrawConfig.sketchingUID) != ExcalidrawConfig.cljCodeVersion) {
        ExcalidrawConfig.log('loader.js','Need to update CLJS script. Starting roam-excalidraw-cljs-loader');
        ExcalidrawConfig.addScriptToPage( 'roam-excalidraw-cljs-loader',  ExcalidrawConfig.rootPath + 'get_dev.php?c='+ExcalidrawConfig.channel);
      }
      else {
        ExcalidrawConfig.log('loader.js','cljs NS is up to date');
        delete ExcalidrawConfig.sketchingUID;
        delete ExcalidrawConfig.excalDATAUID;
      }
      
      ExcalidrawConfig.addScriptToPage ('roam-excalidraw-main',ExcalidrawConfig.rootPath+ExcalidrawConfig.channel+'/main.js?v='+ExcalidrawConfig.cljCodeVersion);
      ExcalidrawConfig.addScriptToPage ('roam-excalidraw-react','https://unpkg.com/react@17/umd/react.production.min.js');
      ExcalidrawConfig.addScriptToPage ('roam-excalidraw-reactdom','https://unpkg.com/react-dom@17/umd/react-dom.production.min.js');
      ExcalidrawConfig.addScriptToPage ('roam-excalidraw-excalidraw','https://unpkg.com/@excalidraw/excalidraw@0.7.0/dist/excalidraw.production.min.js');
      ExcalidrawConfig.addCSSToPage ('roam-excalidraw-css',ExcalidrawConfig.rootPath+ExcalidrawConfig.channel+'/style.css?v='+ExcalidrawConfig.cljCodeVersion);
  })();
  
  ExcalidrawConfig.log('loader.js','Terminating temporary objects variables, rootPath, channel, getClojureNS, cljCodeVersion');

  delete ExcalidrawConfig.rootPath;
  delete ExcalidrawConfig.channel;
  getClojureNS = undefined;
  delete ExcalidrawConfig.cljCodeVersion;
};
