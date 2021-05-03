function excalidrawWrapperKeyboardListner(ev) {
  if (ev.ctrlKey && (ev.code=='z' || ev.key=='z') ) {
    ev.preventDefault();
    if (typeof ev.stopPropagation != "undefined") {
      ev.stopPropagation();
    } else {
      ev.cancelBubble = true;
    }
  }
}

window['ExcalidrawWrapper'] = class {
  static notReadyToStart () {
    console.log("notReadyToStart()",(typeof Excalidraw == 'undefined') && (typeof ReactDOM == 'undefined') && (typeof React == 'undefined'));
    return (typeof Excalidraw == 'undefined') && (typeof ReactDOM == 'undefined') && (typeof React == 'undefined');
  }
  constructor (appName,initData,node,onChangeCallback) {   
    this.previousSceneVersion = 0; 
    this.hostDIV = node.querySelector('#'+appName);
    while (this.hostDIV.firstChild) {
      this.hostDIV.removeChild(this.hostDIV.lastChild);
    }
    
    ReactDOM.render(React.createElement(() => {
      const excalidrawRef = React.useRef(null);
      const excalidrawWrapperRef = React.useRef(null);
      const [dimensions, setDimensions] = React.useState({
        width: undefined,
        height: undefined
      });

      this.excalidrawRef = excalidrawRef;
      
      React.useEffect(() => {
        setDimensions({
          width: excalidrawWrapperRef.current.getBoundingClientRect().width,
          height: excalidrawWrapperRef.current.getBoundingClientRect().height
        });
        const onResize = () => {
          try {
            setDimensions({
              width: excalidrawWrapperRef.current.getBoundingClientRect().width,
              height: excalidrawWrapperRef.current.getBoundingClientRect().height
            });
          } catch(err) {console.log ("onResize ",err)}
        };

        window.addEventListener("resize", onResize);
        this.onResize = onResize;

        return () => window.removeEventListener("resize", onResize);
      }, [excalidrawWrapperRef]);

      this.updateScene = (scene) => {
        this.previousSceneVersion = Excalidraw.getSceneVersion(scene.elements);
        excalidrawRef.current.updateScene(scene);
      }
      
      const saveToLocalStorage = (data) => {
        try {
          localStorage.setItem(
            'excalidraw',
            JSON.stringify(data),
          );
        } catch (error) {
          // Unable to access window.localStorage
          console.error(error);
        }
      };

      const importFromLocalStorage = () => {
        let data = null;

        try {
          data = localStorage.getItem("excalidraw");
        } catch (error) {
          // Unable to access localStorage
          console.error(error);
        }
      
        let lib = [];
        if (data) {
          try {
            lib = JSON.parse(data);
          } catch (error) {
            console.error(error);
            // Do nothing because elements array is already empty
          }
        }
        return lib;
      };
      

      return React.createElement(
        React.Fragment,
        null,
        React.createElement(
          "div",
          {
            className: "excalidraw-wrapper",
            ref: excalidrawWrapperRef
          },
          React.createElement(Excalidraw.default, {
            ref: excalidrawRef,
            width: dimensions.width,
            height: dimensions.height,
            initialData: {
              libraryItems: importFromLocalStorage(),
              ... initData},
            onChange: (el, st) => { 
                if (st.editingElement == null && st.resizingElement == null && 
                    st.draggingElement == null && st.editingGroupId == null &&
                    st.editingLinearElement == null ) {
                  const sceneVersion = Excalidraw.getSceneVersion(el);
                  if(sceneVersion != this.previousSceneVersion) {
                    this.previousSceneVersion = sceneVersion;
                    onChangeCallback( {elements: el, //.filter(e => !e.isDeleted),
                                      appState: {theme: st.theme,
                                                  height: st.height,
                                                  name: st.name,
                                                  scrollX: st.scrollX,
                                                  scrollY: st.scrollY,
                                                  viewBackgroundColor: st.viewBackgroundColor,
                                                  width: st.width,
                                                  zoom: st.zoom,
                                                  offsetLeft: st.offsetLeft,
                                                  offsetTop: st.offsetTop}
                                                });                                            
                  }
                }
            }, //console.log("Elements :", elements, "State : ", state),
            onLibraryChange: (items) => {
              saveToLocalStorage(items);
            }
            //onPointerUpdate: (payload) => {},  //console.log(payload),
          })
        )
      );
    }), this.hostDIV);// document.getElementById(appName));
    if (ExcalidrawConfig.DEBUG) console.log("js: ExcalidrawWrapper.constructor() ReactDOM.render() initiated") ;
  }
    
  static getFontFamily(id) {
    switch (id) {
      case 1: return "Virgil, Segoe UI Emoji";
      case 2: return "Helvetica, Segoe UI Emoji";
      case 3: return "Cascadia, Segoe UI Emoji"; 
    }
  }

  static measureText (newText, textElement) {
    const line = document.createElement("div");
    const body = document.body;
    line.style.position = "absolute";
    line.style.whiteSpace = "pre";
    line.style.font = textElement.fontSize.toString()+'px '+this.getFontFamily(textElement.fontFamily);
    body.appendChild(line);
    line.innerText = newText
      .split("\n")
      // replace empty lines with single space because leading/trailing empty
      // lines would be stripped from computation
      .map((x) => x || " ")
      .join("\n");
    const width = line.offsetWidth;
    const height = line.offsetHeight;
    // Now creating 1px sized item that will be aligned to baseline
    // to calculate baseline shift
    const span = document.createElement("span");
    span.style.display = "inline-block";
    span.style.overflow = "hidden";
    span.style.width = "1px";
    span.style.height = "1px";
    line.appendChild(span);
    // Baseline is important for positioning text on canvas
    const baseline = span.offsetTop + span.offsetHeight;
    document.body.removeChild(line);
  
    return {width: width, height: height, baseline: baseline };
  };

  //this is a workaround because Roam catches some of the keys (e.g. CTRL+Z) before 
  //Exalidraw. When the application is in edit mode / full screen, sink all keyboar events and retrigger
  //to Excalidraw main div
  static fullScreenKeyboardEventRedirect(isFullScreen) {
    if (isFullScreen) {
      document.addEventListener('keydown',excalidrawWrapperKeyboardListner);
      if (ExcalidrawConfig.DEBUG) console.log("keyboard listener added");
    }
    else {
      document.removeEventListener('keydown',excalidrawWrapperKeyboardListner);
      if (ExcalidrawConfig.DEBUG) console.log("keyboard listner removed");
    }
  }

  static getDrawing(o) {
    if (ExcalidrawConfig.DEBUG) console.log("js: ExcalidrawWrapper.getDrawing() entering function, object is available: ",(o!=null));
    if(o!=null) {
      let appstate = o.excalidrawRef.current.getAppState();
      delete appstate['collaborators'];
      delete appstate['fileHandle'];
      delete appstate['editingElement'];
      delete appstate['resizingElement'];
      delete appstate['draggingElement'];
      delete appstate['editingGroupId'];
      delete appstate['editingLinearElement'];
      delete appstate['selectedElementIds'];
      return {elements: 
              o.excalidrawRef.current.getSceneElements(),
              appState: appstate};
    }
  }
  
  static getHostDIVWidth(node) {
    let blockNode = node;
    let foundIt = false;    
    while ( (blockNode!=null) && !foundIt ) {
      foundIt = blockNode.id.startsWith('block-input-');
      if (!foundIt)
        blockNode = blockNode.parentElement;
    }
    return blockNode.clientWidth;
  }

  static setImgEventListner(roamRenderNode,imgNode,appName) {
    let blockNode = roamRenderNode;
    let foundIt = false;    
    while ( (blockNode!=null) && !foundIt ) {
      foundIt = blockNode.id.startsWith('block-input-');
      if (!foundIt)
        blockNode = blockNode.parentElement;
    }    
    if(blockNode!=null)
      imgNode.addEventListener('dblclick', function(e) {
        try{
          ['mousedown', 'click', 'mouseup'].forEach(mouseEventType =>
            blockNode.dispatchEvent( new MouseEvent(mouseEventType, { view: window, bubbles: true, cancelable: true, buttons: 1 }) )
            );
          } catch(err) {}
        });
  }

  static getAspectRatio(svg) {
    const w = parseFloat(svg.getAttribute('width'));
    const h = parseFloat(svg.getAttribute('height'));
    return w/h;
  }

  static svgClipboard() {
    setTimeout (
      async function() {
        let clipboardText = await navigator.clipboard.readText();
        if(ExcalidrawConfig.DEBUG) console.log ("setClipbloard", clipboardText);
        if (clipboardText.startsWith('<svg version')) {
          clipboardText = clipboardText.replaceAll('"','\'');
          clipboardText = clipboardText.replace(/(\n\s*)/gs,'');
          clipboardText = clipboardText.replace(/(\r\n|\n|\r)/gm,'');
          if(ExcalidrawConfig.DEBUG) console.log ("setClipbloard", clipboardText);
          await navigator.clipboard.writeText('{{roam/render: ((ExcalSVG_)) "' + clipboardText +'"}}');
        }
      }, 1000);
  }

  static setSVG(node,svgString,appName) {
    const hostDIV = node.querySelector('#'+appName);
    hostDIV.innerHTML = svgString;
    const svg = hostDIV.firstChild;
    const aspectRatio = ExcalidrawWrapper.getAspectRatio(svg);
    ExcalidrawWrapper.setImgEventListner(node, svg, appName);
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.classList.add('excalidraw-svg');
    return aspectRatio; //aspect ration
  }

  static cleanupDOMTree (hostDIV) {
    ReactDOM.unmountComponentAtNode(hostDIV);
    while (hostDIV.firstChild) {
      hostDIV.removeChild(hostDIV.lastChild);
    }
  }

  static getSVG(diagram,node,appName) {
    const hostDIV = node.querySelector('#'+appName);
    //ReactDOM.unmountComponentAtNode(hostDIV);
    this.cleanupDOMTree(hostDIV);
    let mode = 'light';
    if (diagram != null) 
      if(diagram.appState != null)
        mode = (diagram.appState.theme == 'dark') ? "dark" : "light";    
    if (diagram==null) 
      diagram = excalidrawSplashScreen;
    else 
      if (diagram['elements'] == undefined) 
        diagram = excalidrawSplashScreen;   
    
    if(mode == 'dark')
      diagram.appState.exportWithDarkMode = true;
    else
      diagram.appState.exportWithDarkMode = false;
    diagram.appState.exportBackground = true;
    
    hostDIV.appendChild(Excalidraw.exportToSvg(diagram));
    const svg = hostDIV.querySelector('svg');
    const aspectRatio = ExcalidrawWrapper.getAspectRatio(svg);
    //this is a hack. Sometimes the side of images are cut off
    //like Bezier curves, sometimes text as well
    if(svg.viewBox?.baseVal != null) { 
      svg.viewBox.baseVal.x -= 20;
      svg.viewBox.baseVal.y -= 20;
      svg.viewBox.baseVal.width += 40;
      svg.viewBox.baseVal.height += 40;
    }
    ExcalidrawWrapper.setImgEventListner(node, svg, appName);
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.classList.add('excalidraw-svg');
    return aspectRatio; //aspect ration
  }
  
  static getPNG(diagram,node,appName) {
    const hostDIV = node.querySelector('#'+appName);
    //ReactDOM.unmountComponentAtNode(hostDIV);
    this.cleanupDOMTree(hostDIV);
    let mode = 'light';
    if (diagram != null) 
      if(diagram.appState != null)
        mode = (diagram.appState.theme == 'dark') ? "dark" : "light";
    if (diagram==null) 
      diagram = excalidrawSplashScreen;
    else 
      if (diagram['elements'] == undefined) 
        diagram = excalidrawSplashScreen;    
    
    if(mode == 'dark')
      diagram.appState.exportWithDarkMode = true;
    else
      diagram.appState.exportWithDarkMode = false;
    diagram.appState.exportBackground = true;
      
    (async () => {
      const blob = await Excalidraw.exportToBlob({
        ...diagram,
        mimeType: "image/png",
        exportWithDarkMode: "true",
    });
      const urlCreator = window.URL || window.webkitURL;
      let img = document.createElement('img');
      img.src = urlCreator.createObjectURL(blob);
      img.style.width = '100%';
      hostDIV.appendChild(img);
      ExcalidrawWrapper.setImgEventListner(node, img, appName);
    })();
    let svg = Excalidraw.exportToSvg(diagram);
    const aspectRatio = ExcalidrawWrapper.getAspectRatio(svg);
    return aspectRatio; //aspect ration
  }
  
  static updateBlock(data) {
     window.roamAlphaAPI.updateBlock(data);
  }

  static createBlock(parentUID, order, blockString) {
    const uid = window.roamAlphaAPI.util.generateUID();
     window.roamAlphaAPI.createBlock ({location: {"parent-uid": parentUID,
                                                "order": order},
                                      block: {"string": blockString,
                                              "uid": uid}});
    return uid;
  }

  static addPullWatch(blockUID, callback) {
    if(ExcalidrawConfig.DEBUG) console.log('ExcalidrawWrapper','addPullWatch','roamAlphaAPI: ',typeof window.roamAlphaAPI, blockUID, callback);
    window
      .roamAlphaAPI
      .data
      .addPullWatch(
        `[:block/children :block/string :block/order {:block/children ...}]`,
        `[:block/uid "${blockUID}"]`,
        callback); 
  }
  
  static removePullWatch(blockUID, callback) {
    if(ExcalidrawConfig.DEBUG) console.log('ExcalidrawWrapper','removePullWatch','roamAlphaAPI: ',typeof window.roamAlphaAPI, blockUID, callback);
    window
      .roamAlphaAPI
      .data
      .removePullWatch(
        `[:block/children :block/string :block/order {:block/children ...}]`,
        `[:block/uid "${blockUID}"]`,
        callback);     
  }

}



excalidrawSplashScreen = {"elements":[{"type":"rectangle","version":356,"versionNonce":1176258328,"isDeleted":false,"id":"UQttW70qznY66iLcj5l-o","fillStyle":"hachure","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":50,"angle":0,"x":602.5,"y":386.8889181349012,"strokeColor":"#000000","backgroundColor":"#228be6","width":729.2776963975693,"height":175.33331298828125,"seed":1652020530,"groupIds":[],"strokeSharpness":"sharp","boundElementIds":[]},{"type":"rectangle","version":994,"versionNonce":362271080,"isDeleted":false,"id":"1nOG08NvMG6GT7ObXhGgy","fillStyle":"cross-hatch","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":0,"x":40.07699089376365,"y":6.223376120541673,"strokeColor":"#000000","backgroundColor":"transparent","width":168.66655815972217,"height":159.8603064113602,"seed":2015740133,"groupIds":["sa7CSY40OgIvVGPFCddIg"],"strokeSharpness":"sharp","boundElementIds":[]},{"type":"line","version":630,"versionNonce":227957016,"isDeleted":false,"id":"aXtt5hW2KJkwVImFqsReG","fillStyle":"cross-hatch","strokeWidth":4,"strokeStyle":"solid","roughness":0,"opacity":100,"angle":0,"x":58.19747972141795,"y":235.4393505164689,"strokeColor":"#000000","backgroundColor":"transparent","width":42.942712660297374,"height":74.50301955521472,"seed":1455352811,"groupIds":["sa7CSY40OgIvVGPFCddIg"],"strokeSharpness":"round","boundElementIds":[],"startBinding":null,"endBinding":null,"points":[[0,-69.49698044478527],[2.5869104012227333,-94.84870237676802],[16.556226567825483,-121.23518846923992],[42.942712660297374,-144]],"lastCommittedPoint":null,"startArrowhead":null,"endArrowhead":null},{"type":"line","version":460,"versionNonce":6906984,"isDeleted":false,"id":"x2gHTSBkun4AnNw-DmgUN","fillStyle":"cross-hatch","strokeWidth":4,"strokeStyle":"solid","roughness":0,"opacity":100,"angle":0,"x":211.95200905424008,"y":235.4045863559798,"strokeColor":"#000000","backgroundColor":"transparent","width":22.76481153076005,"height":75.02040163545924,"seed":702962757,"groupIds":["sa7CSY40OgIvVGPFCddIg"],"strokeSharpness":"round","boundElementIds":[],"startBinding":null,"endBinding":null,"points":[[-20.26995262972905,-69.97959836454075],[-19.23518846923995,-95.84870237676805],[-25.96115551241906,-123.26995262972902],[-42,-145]],"lastCommittedPoint":null,"startArrowhead":null,"endArrowhead":null},{"type":"ellipse","version":510,"versionNonce":547059224,"isDeleted":false,"id":"0rqKzXZHNp4qu9vhUzflg","fillStyle":"cross-hatch","strokeWidth":4,"strokeStyle":"solid","roughness":0,"opacity":100,"angle":0,"x":92.34469701755688,"y":20.558005522965743,"strokeColor":"#000000","backgroundColor":"transparent","width":85.88542532059475,"height":85.88542532059475,"seed":326121099,"groupIds":["sa7CSY40OgIvVGPFCddIg"],"strokeSharpness":"sharp","boundElementIds":[]},{"type":"ellipse","version":394,"versionNonce":1636865896,"isDeleted":false,"id":"6Cda9BWrnjhZVoIBEFIRy","fillStyle":"cross-hatch","strokeWidth":4,"strokeStyle":"solid","roughness":0,"opacity":100,"angle":0,"x":121.83547559149747,"y":45.39234537470401,"strokeColor":"#000000","backgroundColor":"transparent","width":4.65643872220092,"height":4.65643872220092,"seed":1136429989,"groupIds":["sa7CSY40OgIvVGPFCddIg"],"strokeSharpness":"sharp","boundElementIds":[]},{"type":"ellipse","version":418,"versionNonce":787804952,"isDeleted":false,"id":"MbiPk2jvtJy-_s9FMM6VG","fillStyle":"cross-hatch","strokeWidth":4,"strokeStyle":"solid","roughness":0,"opacity":100,"angle":0,"x":151.3262541654367,"y":43.84019913397043,"strokeColor":"#000000","backgroundColor":"transparent","width":4.65643872220092,"height":4.65643872220092,"seed":1289694507,"groupIds":["sa7CSY40OgIvVGPFCddIg"],"strokeSharpness":"sharp","boundElementIds":[]},{"type":"line","version":481,"versionNonce":492399208,"isDeleted":false,"id":"D0pqBdZziQ2c3tYNjGlm1","fillStyle":"cross-hatch","strokeWidth":4,"strokeStyle":"solid","roughness":0,"opacity":100,"angle":0,"x":114.59212646807146,"y":77.81359562766505,"strokeColor":"#000000","backgroundColor":"transparent","width":50.703443863965546,"height":19.143136969048218,"seed":1440075525,"groupIds":["sa7CSY40OgIvVGPFCddIg"],"strokeSharpness":"round","boundElementIds":[],"startBinding":null,"endBinding":null,"points":[[0,-2.413089598777267],[9.830259524646378,10.521462407336394],[28.456014413450045,14.143136969048218],[43.46009474054191,4.830259524646382],[50.703443863965546,-5]],"lastCommittedPoint":null,"startArrowhead":null,"endArrowhead":null},{"type":"line","version":1178,"versionNonce":253153304,"isDeleted":false,"id":"SPU8xO49YNGcd9yu9oTAS","fillStyle":"solid","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":0,"x":641.0178615735234,"y":423.537040063497,"strokeColor":"#000000","backgroundColor":"#ffffff","width":122.13897373159827,"height":92.97456545650843,"seed":1166623609,"groupIds":["xU94V0951OlSywcsHiICg"],"strokeSharpness":"round","boundElementIds":[],"startBinding":null,"endBinding":null,"points":[[0,0],[0,75.5227780929037],[15.006352547317888,92.97456545650843],[76.82530687585603,92.40976859881864],[91.92986249443676,62.20065736165713],[122.13897373159827,47.096101743076396],[122.13897373159827,16.88699050591489],[91.92986249443676,1.7824348873341374],[0,0]],"lastCommittedPoint":null,"startArrowhead":null,"endArrowhead":null},{"type":"line","version":356,"versionNonce":1129731432,"isDeleted":false,"id":"CxfN5IPIP-dAl1Y2RzDco","fillStyle":"hachure","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":60,"angle":0,"x":731.776055819664,"y":438.42472523362557,"strokeColor":"#000000","backgroundColor":"#228be6","width":14.72694172811622,"height":27.752996971135108,"seed":891719001,"groupIds":["xU94V0951OlSywcsHiICg"],"strokeSharpness":"round","boundElementIds":[],"startBinding":null,"endBinding":null,"points":[[-0.20921034478266018,0],[-0.854714418068852,27.752996971135108],[13.872227310047368,16.802194147664064],[-0.20921034478266018,0]],"lastCommittedPoint":null,"startArrowhead":null,"endArrowhead":null},{"type":"line","version":2184,"versionNonce":687148312,"isDeleted":false,"id":"s7SEF1pIIVZ2BsCITqwo6","fillStyle":"solid","strokeWidth":2,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":0,"x":781.0036521239635,"y":469.2218952028878,"strokeColor":"#a61e4d","backgroundColor":"#cf0221","width":42.627947986824026,"height":41.78718728826649,"seed":161598905,"groupIds":["SizNmjB9nZHXnyCekbpBO","xU94V0951OlSywcsHiICg"],"strokeSharpness":"round","boundElementIds":[],"startBinding":null,"endBinding":null,"points":[[-92.88550267169887,-17.35223676284489],[-86.26217327442323,-21.32623440121027],[-78.31417799769251,-20.603689376052934],[-72.54265178627115,-15.177976194994809],[-72.17475378131435,-4.475684470709573],[-77.4712088016756,6.491749067347542],[-91.31998845052462,20.22010454533709],[-96.49822779748561,20.340528716196648],[-110.1061591046156,6.491749067347542],[-114.80270176813836,-6.39363721462515],[-113.82826591396511,-15.543665702492177],[-107.32536068754904,-21.21464422018809],[-98.90671121467672,-21.446658572069847],[-92.88550267169887,-17.35223676284489]],"lastCommittedPoint":null,"startArrowhead":null,"endArrowhead":null},{"type":"line","version":1010,"versionNonce":1451225192,"isDeleted":false,"id":"m45fMiYOE7V4XbCOEQfOf","fillStyle":"solid","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":0,"x":704.1413405393436,"y":462.7662692881877,"strokeColor":"transparent","backgroundColor":"#e78190","width":7.794728150182189,"height":13.399925921099811,"seed":880133719,"groupIds":["SizNmjB9nZHXnyCekbpBO","xU94V0951OlSywcsHiICg"],"strokeSharpness":"round","boundElementIds":[],"startBinding":null,"endBinding":null,"points":[[-2.691540996128444,-5.818197065642369],[0.6693881360427353,2.7540477497195033],[2.8698661672037225,-2.6103016794789524],[2.43196009135095,-6.5624040140516655],[-0.27210992704097836,-10.503558696728136],[-4.924861982978467,-10.645878171380307],[-2.691540996128444,-5.818197065642369]],"lastCommittedPoint":null,"startArrowhead":null,"endArrowhead":null},{"type":"line","version":805,"versionNonce":1174645272,"isDeleted":false,"id":"sGHzWgl0FX5-zk9laUYjS","fillStyle":"solid","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":0,"x":713.6373862292928,"y":494.40170549958503,"strokeColor":"transparent","backgroundColor":"#d41c38","width":8.469833350455511,"height":12.283265427674849,"seed":1265741465,"groupIds":["SizNmjB9nZHXnyCekbpBO","xU94V0951OlSywcsHiICg"],"strokeSharpness":"round","boundElementIds":[],"startBinding":null,"endBinding":null,"points":[[-35.89531330353186,-36.29225989614604],[-41.836239065936674,-32.572491062928634],[-44.365146653987374,-35.70351950527709],[-40.02987650304333,-44.3740598071652],[-36.176303035537444,-44.85575649060348],[-35.89531330353186,-36.29225989614604]],"lastCommittedPoint":null,"startArrowhead":null,"endArrowhead":null},{"type":"line","version":1201,"versionNonce":1291166568,"isDeleted":false,"id":"qjG6kcOASOYx1tPLMeBbz","fillStyle":"solid","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":10,"angle":0,"x":688.0123161175236,"y":456.38717660924425,"strokeColor":"transparent","backgroundColor":"#000","width":4.945591951832508,"height":13.22135581315709,"seed":548987767,"groupIds":["SizNmjB9nZHXnyCekbpBO","xU94V0951OlSywcsHiICg"],"strokeSharpness":"round","boundElementIds":[],"startBinding":null,"endBinding":null,"points":[[-0.014958119232607701,-3.454753224291571],[4.918222250664481,-6.321353766990505],[3.7887095271063536,-2.381902923114908],[1.9031870197319973,0.3480592385367141],[-0.02736970116802695,6.900002046166584],[-0.014958119232607701,-3.454753224291571]],"lastCommittedPoint":null,"startArrowhead":null,"endArrowhead":null},{"type":"line","version":936,"versionNonce":1630971672,"isDeleted":false,"id":"9caxFCw-ATIsnHd7iluDm","fillStyle":"solid","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":0,"x":671.8941804157837,"y":465.0151691188772,"strokeColor":"transparent","backgroundColor":"#d9354d","width":13.303094364612631,"height":23.783773744762588,"seed":240284537,"groupIds":["SizNmjB9nZHXnyCekbpBO","xU94V0951OlSywcsHiICg"],"strokeSharpness":"round","boundElementIds":[],"startBinding":null,"endBinding":null,"points":[[-1.0839394848597903,0],[3.010482324365161,10.476902864781492],[10.717629259376857,19.267867337529182],[11.319750113674642,23.783773744762588],[-1.9833442509379893,7.203788328321434],[-1.0839394848597903,0]],"lastCommittedPoint":null,"startArrowhead":null,"endArrowhead":null},{"type":"rectangle","version":77,"versionNonce":36712808,"isDeleted":false,"id":"guTrLl_2zU39MQ1RJZuMD","fillStyle":"hachure","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":0,"x":260,"y":211.5,"strokeColor":"#000000","backgroundColor":"#fd7e14","width":840,"height":120,"seed":1739301209,"groupIds":[],"strokeSharpness":"sharp","boundElementIds":[]},{"type":"line","version":296,"versionNonce":2062926952,"isDeleted":false,"id":"Bw9ysWM05HgTNy6_w773c","fillStyle":"cross-hatch","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":0,"x":260,"y":231.5,"strokeColor":"#000000","backgroundColor":"#fd7e14","width":40.85471441806885,"height":118.50000000000003,"seed":1652137047,"groupIds":[],"strokeSharpness":"sharp","boundElementIds":[],"startBinding":null,"endBinding":null,"points":[[0,0],[-39.85471441806885,-18.75215031550482],[-40.85471441806885,99.74784968449521],[0,80],[0,0]],"lastCommittedPoint":null,"startArrowhead":null,"endArrowhead":null},{"type":"line","version":417,"versionNonce":194049896,"isDeleted":false,"id":"E9zptSZGg9HQA1cb3na7f","fillStyle":"cross-hatch","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":3.1470053556653,"x":1141.9903756095844,"y":231.87240542012745,"strokeColor":"#000000","backgroundColor":"#fd7e14","width":40.85471441806885,"height":118.50000000000003,"seed":1769444855,"groupIds":[],"strokeSharpness":"sharp","boundElementIds":[],"startBinding":null,"endBinding":null,"points":[[0,0],[-39.85471441806885,-18.75215031550482],[-40.85471441806885,99.74784968449521],[0,80],[0,0]],"lastCommittedPoint":null,"startArrowhead":null,"endArrowhead":null},{"type":"rectangle","version":215,"versionNonce":1431945496,"isDeleted":false,"id":"UhEBOxhTemX9yrUlNel3u","fillStyle":"cross-hatch","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":0,"x":14.902815794333492,"y":-19.418808716994135,"strokeColor":"#000000","backgroundColor":"transparent","width":1328.6666641235352,"height":636.6666564941406,"seed":895644776,"groupIds":[],"strokeSharpness":"sharp","boundElementIds":[]},{"type":"arrow","version":786,"versionNonce":384859240,"isDeleted":false,"id":"0lRGDe2fDCfjAx5XZUjKH","fillStyle":"hachure","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":0,"x":1250.0441404411822,"y":53.81121586754937,"strokeColor":"#000000","backgroundColor":"transparent","width":46.06986920354416,"height":30.55963753556229,"seed":573923250,"groupIds":["Zfq6fUuwwJP2-ACariar8"],"strokeSharpness":"round","boundElementIds":[],"startBinding":{"elementId":"ROAM_ooGUvxKhb_ROAM","focus":0.6602823436832181,"gap":4.821887701381968},"endBinding":null,"points":[[0,0],[46.06986920354416,-30.55963753556229]],"lastCommittedPoint":null,"startArrowhead":null,"endArrowhead":"arrow"},{"type":"line","version":219,"versionNonce":1806818840,"isDeleted":false,"id":"0HrXJ2JRF9YzxpnTzJK2M","fillStyle":"cross-hatch","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":0,"x":46.90276238857177,"y":466.58122180058405,"strokeColor":"#000000","backgroundColor":"transparent","width":17.33331298828125,"height":29.3333740234375,"seed":1771136792,"groupIds":["48Udjk5c59RFw6j_ugbSf"],"strokeSharpness":"sharp","boundElementIds":[],"startBinding":null,"endBinding":null,"points":[[0,0],[-0.666656494140625,28.66668701171875],[16.666656494140625,29.3333740234375]],"lastCommittedPoint":null,"startArrowhead":null,"endArrowhead":null},{"type":"line","version":254,"versionNonce":1198829416,"isDeleted":false,"id":"Ke4fHXsKOVCunFlDyWFKa","fillStyle":"cross-hatch","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":0,"x":45.5694188827124,"y":497.2479088123028,"strokeColor":"#000000","backgroundColor":"transparent","width":17.33331298828125,"height":29.3333740234375,"seed":544021784,"groupIds":["48Udjk5c59RFw6j_ugbSf"],"strokeSharpness":"sharp","boundElementIds":[],"startBinding":null,"endBinding":null,"points":[[0,0],[-0.666656494140625,28.66668701171875],[16.666656494140625,29.3333740234375]],"lastCommittedPoint":null,"startArrowhead":null,"endArrowhead":null},{"type":"text","version":73,"versionNonce":184690024,"isDeleted":false,"id":"ROAM_07HlagvUD_ROAM","fillStyle":"cross-hatch","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":0,"x":624.5694188827124,"y":309.58122180058405,"strokeColor":"#000000","backgroundColor":"transparent","width":94,"height":25,"seed":784336744,"groupIds":[],"strokeSharpness":"sharp","boundElementIds":[],"fontSize":20,"fontFamily":1,"text":"mvp.v06","baseline":18,"textAlign":"left","verticalAlign":"top"},{"type":"text","version":329,"versionNonce":747769448,"isDeleted":false,"id":"ROAM_vaL6EcViy_ROAM","fillStyle":"cross-hatch","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":0,"x":72.2360448592749,"y":511.91453478886535,"strokeColor":"#000000","backgroundColor":"transparent","width":375,"height":59,"seed":379718680,"groupIds":["48Udjk5c59RFw6j_ugbSf"],"strokeSharpness":"sharp","boundElementIds":[],"fontSize":22.982450786389776,"fontFamily":1,"text":"The nested text is synchronized\nboth ways.","baseline":50,"textAlign":"left","verticalAlign":"top"},{"type":"text","version":184,"versionNonce":1766592280,"isDeleted":false,"id":"ROAM_GAR9X5_Ku_ROAM","fillStyle":"cross-hatch","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":0,"x":71.56947991786865,"y":479.9145347888653,"strokeColor":"#000000","backgroundColor":"transparent","width":367,"height":29,"seed":94103912,"groupIds":["48Udjk5c59RFw6j_ugbSf"],"strokeSharpness":"sharp","boundElementIds":[],"fontSize":22.982450786389776,"fontFamily":1,"text":"will be nested under the drawing.","baseline":21,"textAlign":"left","verticalAlign":"top"},{"type":"text","version":446,"versionNonce":1947057000,"isDeleted":false,"id":"ROAM_e9ZYUo-NB_ROAM","fillStyle":"cross-hatch","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":0,"x":39.23610589443115,"y":436.2479088123028,"strokeColor":"#000000","backgroundColor":"transparent","width":285,"height":29,"seed":1606669336,"groupIds":["48Udjk5c59RFw6j_ugbSf"],"strokeSharpness":"sharp","boundElementIds":[],"fontSize":22.904294457766063,"fontFamily":1,"text":"Text from your drawing...","baseline":20,"textAlign":"left","verticalAlign":"top"},{"type":"text","version":102,"versionNonce":1051071000,"isDeleted":false,"id":"ROAM_001WGFGb-_ROAM","fillStyle":"cross-hatch","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":0,"x":872.9026708358374,"y":119.63692655318835,"strokeColor":"#ff0000","backgroundColor":"transparent","width":19.333251953124932,"height":40.277608235676944,"seed":1756760680,"groupIds":["Zfq6fUuwwJP2-ACariar8"],"strokeSharpness":"sharp","boundElementIds":[],"fontSize":32.22208658854155,"fontFamily":1,"text":"X","baseline":28.277608235676944,"textAlign":"right","verticalAlign":"top"},{"type":"text","version":721,"versionNonce":1153108072,"isDeleted":false,"id":"ROAM_ooGUvxKhb_ROAM","fillStyle":"hachure","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":0,"x":543.2222527398004,"y":48.11111831665038,"strokeColor":"#000000","backgroundColor":"transparent","width":702,"height":106,"seed":498722286,"groupIds":["Zfq6fUuwwJP2-ACariar8"],"strokeSharpness":"sharp","boundElementIds":["0lRGDe2fDCfjAx5XZUjKH"],"fontSize":28,"fontFamily":1,"text":"Start editing by clicking the pen.\nWhile editing your drawing will autosave.\nFinish editing by clicking   to close fullscreen mode.","baseline":96,"textAlign":"right","verticalAlign":"top"},{"type":"text","version":433,"versionNonce":1941888792,"isDeleted":false,"id":"ROAM_6jyySqmni_ROAM","fillStyle":"hachure","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":0,"x":298.3556170993387,"y":229.72222095065638,"strokeColor":"#000000","backgroundColor":"transparent","width":752,"height":93,"seed":865780782,"groupIds":[],"strokeSharpness":"sharp","boundElementIds":[],"fontSize":73.38537670435296,"fontFamily":1,"text":"Excalidraw for Roam","baseline":66,"textAlign":"left","verticalAlign":"top"},{"type":"text","version":584,"versionNonce":1280177512,"isDeleted":false,"id":"ROAM_sIxgBeFD5_ROAM","fillStyle":"cross-hatch","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":0,"x":821.5213403946318,"y":565.6496263161685,"strokeColor":"#000000","backgroundColor":"transparent","width":508,"height":36,"seed":1471228619,"groupIds":[],"strokeSharpness":"sharp","boundElementIds":[],"fontSize":28,"fontFamily":1,"text":"http://roam-excalidraw.com/changelog","baseline":25,"textAlign":"left","verticalAlign":"top"},{"type":"text","version":416,"versionNonce":95631384,"isDeleted":false,"id":"ROAM_qRoy78tWl_ROAM","fillStyle":"hachure","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":0,"x":1106.9126931811136,"y":523.6666145324709,"strokeColor":"#000000","backgroundColor":"#fa5252","width":220.14274030412957,"height":38.33331298828128,"seed":710246002,"groupIds":[],"strokeSharpness":"sharp","boundElementIds":[],"fontSize":30.66665039062502,"fontFamily":1,"text":"ko-fi.com/zsolt","baseline":27.33331298828128,"textAlign":"left","verticalAlign":"top"},{"type":"text","version":911,"versionNonce":1346966120,"isDeleted":false,"id":"ROAM_Hp7Cwuok8_ROAM","fillStyle":"hachure","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":0,"x":790.8332383897566,"y":404.166716257731,"strokeColor":"#000000","backgroundColor":"#fa5252","width":508,"height":107,"seed":142571566,"groupIds":[],"strokeSharpness":"sharp","boundElementIds":[],"fontSize":28,"fontFamily":1,"text":"Are you enjoying Excalidraw in Roam?\nBuy me a coffee, so I can \nstay awake and work on updates.","baseline":96,"textAlign":"left","verticalAlign":"top"}],"appState":{"currentItemBackgroundColor":"transparent","exportBackground":true,"exportEmbedScene":false,"exportWithDarkMode":false,"height":750,"name":"Excalidraw Splash-screen","scrollX":358.85471441806885,"scrollY":294.7521503155048,"viewBackgroundColor":"#ffffff","width":1490,"offsetLeft":23,"offsetTop":43.20000076293945}};
