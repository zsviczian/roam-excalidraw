(()=>{
  window.ExcalidrawConfig = {
    rootPath: 'https://roam-excalidraw.com/',
    channel: 'alpha',
    cljCodeVersion: 'excalidraw.app.alpha.v13',
    DEBUG : false,
    sketchingUID : 'sketching',
    excalDATAUID : 'ExcalDATA',
    settingsUID  : 'ExcalSET_',
  }

  const addElementToPage = (element, tagId, typeT )=> {
    try { document.getElementById(tagId).remove() } catch(e){};  //Delete any existing reference
    Object.assign(element, { type:typeT, async:false, tagId:tagId } );
    document.getElementsByTagName('head')[0].appendChild(element);
  }

  ExcalidrawConfig.addScriptToPage = (tagId, script)=> {
    addElementToPage(Object.assign(document.createElement('script'),{src:script}) , tagId, 'text/javascript');
  }

  ExcalidrawConfig.addCSSToPage = (tagId, cssToAdd)=> {
    addElementToPage(Object.assign(document.createElement('link'),{href:cssToAdd, rel: 'stylesheet'} ) , tagId, 'text/css');
  }
})();

function getClojureNS(blockUID) {
  q = `[:find ?s . :where [?e :block/uid "${blockUID}"][?e :block/string ?s]]`;
  renderString = window.roamAlphaAPI.q(q);
  if(renderString != null) { 
    ptrn = /\(ns (.*)\s/g;
    let res = ptrn.exec(renderString);
    if (ExcalidrawConfig.DEBUG) console.log('getClojureNS: ', res);
    if(res == null) return '';
    return res[1];
  }
  if (ExcalidrawConfig.DEBUG) console.log('getClojureNS: empty');
  return '';
}

( async ()=>{
    if (getClojureNS(ExcalidrawConfig.sketchingUID) != ExcalidrawConfig.cljCodeVersion) {
      if (ExcalidrawConfig.DEBUG) console.log('starting roam-excalidraw-cljs-loader');
      ExcalidrawConfig.addScriptToPage( 'roam-excalidraw-cljs-loader',  ExcalidrawConfig.rootPath + 'get.php?c='+ExcalidrawConfig.channel);
    }
    else {
      delete ExcalidrawConfig.sketchingUID;
      delete ExcalidrawConfig.excalDATAUID;
    }
    

    ExcalidrawConfig.addScriptToPage ('roam-excalidraw-main',ExcalidrawConfig.rootPath+ExcalidrawConfig.channel+'/main.js');
    ExcalidrawConfig.addScriptToPage ('roam-excalidraw-react','https://unpkg.com/react@17/umd/react.production.min.js');
    ExcalidrawConfig.addScriptToPage ('roam-excalidraw-reactdom','https://unpkg.com/react-dom@17/umd/react-dom.production.min.js');
    ExcalidrawConfig.addScriptToPage ('roam-excalidraw-excalidraw','https://unpkg.com/@excalidraw/excalidraw@0.4.3/dist/excalidraw.min.js');
    ExcalidrawConfig.addScriptToPage ('roam-excalidraw-excalidraw-utils','https://unpkg.com/@excalidraw/utils@0.1.0-temp/dist/excalidraw-utils.min.js');
    ExcalidrawConfig.addCSSToPage ('roam-excalidraw-css',ExcalidrawConfig.rootPath+ExcalidrawConfig.channel+'/style.css');
})();

delete ExcalidrawConfig.rootPath;
delete ExcalidrawConfig.channel;
getClojureNS = undefined;
delete ExcalidrawConfig.cljCodeVersion;
