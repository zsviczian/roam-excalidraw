function myKeyboardListner(ev) {
  if (ev.ctrlKey && (ev.code=='z' || ev.key=='z') ) 
    ev.preventDefault();
}

window['ExcalidrawWrapper'] = class {
  static notReadyToStart () {
    console.log("notReadyToStart()",(typeof Excalidraw == 'undefined') && (typeof ReactDOM == 'undefined') && (typeof React == 'undefined'));
    return (typeof Excalidraw == 'undefined') && (typeof ReactDOM == 'undefined') && (typeof React == 'undefined');
  }
  constructor (appName,initData,node) {    
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
          setDimensions({
            width: excalidrawWrapperRef.current.getBoundingClientRect().width,
            height: excalidrawWrapperRef.current.getBoundingClientRect().height
          });
        };

        window.addEventListener("resize", onResize);
        this.onResize = onResize;

        return () => window.removeEventListener("resize", onResize);
      }, [excalidrawWrapperRef]);

      this.updateScene = (scene) => {
        excalidrawRef.current.updateScene(scene);
      }
      
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
            initialData: initData,
//            onChange: (elements, state) => {}, //console.log("Elements :", elements, "State : ", state),
//            onPointerUpdate: (payload) => {},  //console.log(payload),
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
      document.addEventListener('keydown',myKeyboardListner);
      if (ExcalidrawConfig.DEBUG) console.log("keyboard listener added");
    }
    else {
      document.removeEventListener('keydown',myKeyboardListner);
      if (ExcalidrawConfig.DEBUG) console.log("keyboard listner removed");
    }
  }
 
  static getDrawing(o) {
    if (ExcalidrawConfig.DEBUG) console.log("js: ExcalidrawWrapper.getDrawing() entering function, object is available: ",(o!=null));
    if(o!=null) {
      let appstate = o.excalidrawRef.current.getAppState();
      delete appstate['collaborators'];
      delete appstate['fileHandle'];
      return {elements: 
              o.excalidrawRef.current.getSceneElements(),
              appState: appstate};
    }
  }
  
  static setImgEventListner(roamRenderNode,imgNode,appName) {
    let blockNode = roamRenderNode;
    const blockUID = appName.slice(-9);
    //this is workaround wizardy. Somehow when the node is distroyed the render component re-initiates and
    //creates a ghost, which does not have a parent element...
    let uidIndex =-1;
    while ( (blockNode!=null) && (uidIndex ==-1) ) {
      uidIndex = blockNode.id.indexOf(blockUID);
      if (uidIndex == -1)
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



excalidrawSplashScreen = {"elements":[{"type":"arrow","version":178,"versionNonce":1201892921,"isDeleted":false,"id":"0lRGDe2fDCfjAx5XZUjKH","fillStyle":"hachure","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":0,"x":104.88890923394104,"y":138.0677624801521,"strokeColor":"#000000","backgroundColor":"transparent","width":70.28814932772889,"height":145.10865523961428,"seed":573923250,"groupIds":[],"strokeSharpness":"round","boundElementIds":[],"startBinding":{"elementId":"CWdlf_0p6sHvdJNUaHFkv","focus":-0.9725530716501508,"gap":5.333343505859375},"endBinding":null,"points":[[0,0],[-70.28814932772889,-145.10865523961428]],"lastCommittedPoint":null,"startArrowhead":null,"endArrowhead":"arrow"},{"type":"text","version":114,"versionNonce":154955223,"isDeleted":false,"id":"CWdlf_0p6sHvdJNUaHFkv","fillStyle":"hachure","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":0,"x":110.22225273980041,"y":131.44446182250977,"strokeColor":"#000000","backgroundColor":"transparent","width":596,"height":35,"seed":498722286,"groupIds":[],"strokeSharpness":"sharp","boundElementIds":["0lRGDe2fDCfjAx5XZUjKH"],"fontSize":28,"fontFamily":1,"text":"Start editing by clicking the pen in the top.","baseline":25,"textAlign":"left","verticalAlign":"top"},{"type":"arrow","version":185,"versionNonce":158023449,"isDeleted":false,"id":"PWvx-BEpJw71udpZl1Rdq","fillStyle":"hachure","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":0,"x":167.68650791595368,"y":53.559946283792634,"strokeColor":"#000000","backgroundColor":"transparent","width":64.59583199036507,"height":60.91380022665013,"seed":1893892594,"groupIds":[],"strokeSharpness":"round","boundElementIds":[],"startBinding":{"elementId":"ZoRMhBOE1gFBV8G8AJUFx","focus":-0.8843139108350371,"gap":10.091242735087917},"endBinding":null,"points":[[0,0],[-64.59583199036507,-60.91380022665013]],"lastCommittedPoint":null,"startArrowhead":null,"endArrowhead":"arrow"},{"type":"text","version":216,"versionNonce":87988983,"isDeleted":false,"id":"ZoRMhBOE1gFBV8G8AJUFx","fillStyle":"hachure","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":0,"x":177.77775065104163,"y":27.8888943990072,"strokeColor":"#000000","backgroundColor":"transparent","width":564,"height":71,"seed":308272686,"groupIds":[],"strokeSharpness":"sharp","boundElementIds":["PWvx-BEpJw71udpZl1Rdq"],"fontSize":28,"fontFamily":1,"text":"Give a title to your drawing, you'll also \nfind the title nested under the drawing.","baseline":61,"textAlign":"left","verticalAlign":"top"},{"type":"rectangle","version":346,"versionNonce":498043191,"isDeleted":false,"id":"UQttW70qznY66iLcj5l-o","fillStyle":"hachure","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":0,"x":602.5,"y":386.8889181349012,"strokeColor":"#000000","backgroundColor":"#fab005","width":729.2776963975693,"height":175.33331298828125,"seed":1652020530,"groupIds":[],"strokeSharpness":"sharp","boundElementIds":[]},{"type":"text","version":863,"versionNonce":437491929,"isDeleted":false,"id":"c3ia_Z5LtmkcispqjQV0e","fillStyle":"hachure","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":0,"x":798.1666124131941,"y":418.8334032694498,"strokeColor":"#000000","backgroundColor":"#fa5252","width":508,"height":107,"seed":142571566,"groupIds":[],"strokeSharpness":"sharp","boundElementIds":[],"fontSize":28,"fontFamily":1,"text":"Are you enjoying Excalidraw in Roam?\nBuy me a coffee, so I can \nstay awake and work on updates.","baseline":96,"textAlign":"left","verticalAlign":"top"},{"type":"text","version":408,"versionNonce":2142711993,"isDeleted":false,"id":"WIhfNCnhl-AX4kqdRutGH","fillStyle":"hachure","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":0,"x":1126.0554334852432,"y":526.9999275207522,"strokeColor":"#000000","backgroundColor":"#fa5252","width":201,"height":35,"seed":710246002,"groupIds":[],"strokeSharpness":"sharp","boundElementIds":[],"fontSize":28,"fontFamily":1,"text":"ko-fi.com/zsolt","baseline":25,"textAlign":"left","verticalAlign":"top"},{"type":"rectangle","version":848,"versionNonce":89539415,"isDeleted":false,"id":"1nOG08NvMG6GT7ObXhGgy","fillStyle":"cross-hatch","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":0,"x":1158.7436168703262,"y":-2.443371926333299,"strokeColor":"#000000","backgroundColor":"transparent","width":168.66655815972217,"height":159.8603064113602,"seed":2015740133,"groupIds":["sa7CSY40OgIvVGPFCddIg"],"strokeSharpness":"sharp","boundElementIds":[]},{"type":"line","version":484,"versionNonce":1420001689,"isDeleted":false,"id":"aXtt5hW2KJkwVImFqsReG","fillStyle":"cross-hatch","strokeWidth":4,"strokeStyle":"solid","roughness":0,"opacity":100,"angle":0,"x":1176.8641056979804,"y":226.7726024695939,"strokeColor":"#000000","backgroundColor":"transparent","width":42.942712660297374,"height":74.50301955521472,"seed":1455352811,"groupIds":["sa7CSY40OgIvVGPFCddIg"],"strokeSharpness":"round","boundElementIds":[],"startBinding":null,"endBinding":null,"points":[[0,-69.49698044478527],[2.5869104012227333,-94.84870237676802],[16.556226567825483,-121.23518846923992],[42.942712660297374,-144]],"lastCommittedPoint":null,"startArrowhead":null,"endArrowhead":null},{"type":"line","version":314,"versionNonce":1518452855,"isDeleted":false,"id":"x2gHTSBkun4AnNw-DmgUN","fillStyle":"cross-hatch","strokeWidth":4,"strokeStyle":"solid","roughness":0,"opacity":100,"angle":0,"x":1330.6186350308026,"y":226.7378383091048,"strokeColor":"#000000","backgroundColor":"transparent","width":22.76481153076005,"height":75.02040163545924,"seed":702962757,"groupIds":["sa7CSY40OgIvVGPFCddIg"],"strokeSharpness":"round","boundElementIds":[],"startBinding":null,"endBinding":null,"points":[[-20.26995262972905,-69.97959836454075],[-19.23518846923995,-95.84870237676805],[-25.96115551241906,-123.26995262972902],[-42,-145]],"lastCommittedPoint":null,"startArrowhead":null,"endArrowhead":null},{"type":"ellipse","version":364,"versionNonce":1473373817,"isDeleted":false,"id":"0rqKzXZHNp4qu9vhUzflg","fillStyle":"cross-hatch","strokeWidth":4,"strokeStyle":"solid","roughness":0,"opacity":100,"angle":0,"x":1211.0113229941194,"y":11.891257476090829,"strokeColor":"#000000","backgroundColor":"transparent","width":85.88542532059475,"height":85.88542532059475,"seed":326121099,"groupIds":["sa7CSY40OgIvVGPFCddIg"],"strokeSharpness":"sharp","boundElementIds":[]},{"type":"ellipse","version":248,"versionNonce":864065943,"isDeleted":false,"id":"6Cda9BWrnjhZVoIBEFIRy","fillStyle":"cross-hatch","strokeWidth":4,"strokeStyle":"solid","roughness":0,"opacity":100,"angle":0,"x":1240.50210156806,"y":36.72559732782907,"strokeColor":"#000000","backgroundColor":"transparent","width":4.65643872220092,"height":4.65643872220092,"seed":1136429989,"groupIds":["sa7CSY40OgIvVGPFCddIg"],"strokeSharpness":"sharp","boundElementIds":[]},{"type":"ellipse","version":272,"versionNonce":899723097,"isDeleted":false,"id":"MbiPk2jvtJy-_s9FMM6VG","fillStyle":"cross-hatch","strokeWidth":4,"strokeStyle":"solid","roughness":0,"opacity":100,"angle":0,"x":1269.9928801419992,"y":35.17345108709548,"strokeColor":"#000000","backgroundColor":"transparent","width":4.65643872220092,"height":4.65643872220092,"seed":1289694507,"groupIds":["sa7CSY40OgIvVGPFCddIg"],"strokeSharpness":"sharp","boundElementIds":[]},{"type":"line","version":335,"versionNonce":1971801783,"isDeleted":false,"id":"D0pqBdZziQ2c3tYNjGlm1","fillStyle":"cross-hatch","strokeWidth":4,"strokeStyle":"solid","roughness":0,"opacity":100,"angle":0,"x":1233.258752444634,"y":69.14684758079005,"strokeColor":"#000000","backgroundColor":"transparent","width":50.703443863965546,"height":19.143136969048218,"seed":1440075525,"groupIds":["sa7CSY40OgIvVGPFCddIg"],"strokeSharpness":"round","boundElementIds":[],"startBinding":null,"endBinding":null,"points":[[0,-2.413089598777267],[9.830259524646378,10.521462407336394],[28.456014413450045,14.143136969048218],[43.46009474054191,4.830259524646382],[50.703443863965546,-5]],"lastCommittedPoint":null,"startArrowhead":null,"endArrowhead":null},{"type":"line","version":153,"versionNonce":73620537,"isDeleted":false,"id":"M1ef4IyC9_RF4c_1ki-Ow","fillStyle":"solid","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":0,"x":84.09778984680666,"y":483.663356333844,"strokeColor":"#000000","backgroundColor":"#fab005","width":138.5641,"height":160,"seed":944794821,"groupIds":[],"strokeSharpness":"sharp","boundElementIds":[],"startBinding":null,"endBinding":null,"points":[[30,0],[69.282,40],[15,25.9808],[0,80],[-15,25.9808],[-69.282,40],[-30,0],[-69.282,-40],[-15,-25.9808],[0,-80],[15,-25.9808],[69.282,-40],[30,0]],"lastCommittedPoint":null,"startArrowhead":null,"endArrowhead":null},{"type":"text","version":582,"versionNonce":1926311191,"isDeleted":false,"id":"iipgzYlkb_F2NS6ZMy3ze","fillStyle":"cross-hatch","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":0,"x":821.5213403946318,"y":565.6496263161685,"strokeColor":"#000000","backgroundColor":"transparent","width":508,"height":36,"seed":1471228619,"groupIds":[],"strokeSharpness":"sharp","boundElementIds":[],"fontSize":28,"fontFamily":1,"text":"http://roam-excalidraw.com/changelog","baseline":25,"textAlign":"left","verticalAlign":"top"},{"type":"line","version":1176,"versionNonce":1652120345,"isDeleted":false,"id":"SPU8xO49YNGcd9yu9oTAS","fillStyle":"solid","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":0,"x":641.0178615735234,"y":423.537040063497,"strokeColor":"#000000","backgroundColor":"#ffffff","width":122.13897373159827,"height":92.97456545650843,"seed":1166623609,"groupIds":["xU94V0951OlSywcsHiICg"],"strokeSharpness":"round","boundElementIds":[],"startBinding":null,"endBinding":null,"points":[[0,0],[0,75.5227780929037],[15.006352547317888,92.97456545650843],[76.82530687585603,92.40976859881864],[91.92986249443676,62.20065736165713],[122.13897373159827,47.096101743076396],[122.13897373159827,16.88699050591489],[91.92986249443676,1.7824348873341374],[0,0]],"lastCommittedPoint":null,"startArrowhead":null,"endArrowhead":null},{"type":"line","version":349,"versionNonce":548421367,"isDeleted":false,"id":"CxfN5IPIP-dAl1Y2RzDco","fillStyle":"hachure","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":0,"x":731.776055819664,"y":438.42472523362557,"strokeColor":"#000000","backgroundColor":"#fab005","width":14.72694172811622,"height":27.752996971135108,"seed":891719001,"groupIds":["xU94V0951OlSywcsHiICg"],"strokeSharpness":"round","boundElementIds":[],"startBinding":null,"endBinding":null,"points":[[-0.20921034478266018,0],[-0.854714418068852,27.752996971135108],[13.872227310047368,16.802194147664064],[-0.20921034478266018,0]],"lastCommittedPoint":null,"startArrowhead":null,"endArrowhead":null},{"type":"line","version":2182,"versionNonce":816877561,"isDeleted":false,"id":"s7SEF1pIIVZ2BsCITqwo6","fillStyle":"solid","strokeWidth":2,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":0,"x":781.0036521239635,"y":469.2218952028878,"strokeColor":"#a61e4d","backgroundColor":"#cf0221","width":42.627947986824026,"height":41.78718728826649,"seed":161598905,"groupIds":["SizNmjB9nZHXnyCekbpBO","xU94V0951OlSywcsHiICg"],"strokeSharpness":"round","boundElementIds":[],"startBinding":null,"endBinding":null,"points":[[-92.88550267169887,-17.35223676284489],[-86.26217327442323,-21.32623440121027],[-78.31417799769251,-20.603689376052934],[-72.54265178627115,-15.177976194994809],[-72.17475378131435,-4.475684470709573],[-77.4712088016756,6.491749067347542],[-91.31998845052462,20.22010454533709],[-96.49822779748561,20.340528716196648],[-110.1061591046156,6.491749067347542],[-114.80270176813836,-6.39363721462515],[-113.82826591396511,-15.543665702492177],[-107.32536068754904,-21.21464422018809],[-98.90671121467672,-21.446658572069847],[-92.88550267169887,-17.35223676284489]],"lastCommittedPoint":null,"startArrowhead":null,"endArrowhead":null},{"type":"line","version":1008,"versionNonce":1549486103,"isDeleted":false,"id":"m45fMiYOE7V4XbCOEQfOf","fillStyle":"solid","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":0,"x":704.1413405393436,"y":462.7662692881877,"strokeColor":"transparent","backgroundColor":"#e78190","width":7.794728150182189,"height":13.399925921099811,"seed":880133719,"groupIds":["SizNmjB9nZHXnyCekbpBO","xU94V0951OlSywcsHiICg"],"strokeSharpness":"round","boundElementIds":[],"startBinding":null,"endBinding":null,"points":[[-2.691540996128444,-5.818197065642369],[0.6693881360427353,2.7540477497195033],[2.8698661672037225,-2.6103016794789524],[2.43196009135095,-6.5624040140516655],[-0.27210992704097836,-10.503558696728136],[-4.924861982978467,-10.645878171380307],[-2.691540996128444,-5.818197065642369]],"lastCommittedPoint":null,"startArrowhead":null,"endArrowhead":null},{"type":"line","version":803,"versionNonce":535701721,"isDeleted":false,"id":"sGHzWgl0FX5-zk9laUYjS","fillStyle":"solid","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":0,"x":713.6373862292928,"y":494.40170549958503,"strokeColor":"transparent","backgroundColor":"#d41c38","width":8.469833350455511,"height":12.283265427674849,"seed":1265741465,"groupIds":["SizNmjB9nZHXnyCekbpBO","xU94V0951OlSywcsHiICg"],"strokeSharpness":"round","boundElementIds":[],"startBinding":null,"endBinding":null,"points":[[-35.89531330353186,-36.29225989614604],[-41.836239065936674,-32.572491062928634],[-44.365146653987374,-35.70351950527709],[-40.02987650304333,-44.3740598071652],[-36.176303035537444,-44.85575649060348],[-35.89531330353186,-36.29225989614604]],"lastCommittedPoint":null,"startArrowhead":null,"endArrowhead":null},{"type":"line","version":1199,"versionNonce":1007168823,"isDeleted":false,"id":"qjG6kcOASOYx1tPLMeBbz","fillStyle":"solid","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":10,"angle":0,"x":688.0123161175236,"y":456.38717660924425,"strokeColor":"transparent","backgroundColor":"#000","width":4.945591951832508,"height":13.22135581315709,"seed":548987767,"groupIds":["SizNmjB9nZHXnyCekbpBO","xU94V0951OlSywcsHiICg"],"strokeSharpness":"round","boundElementIds":[],"startBinding":null,"endBinding":null,"points":[[-0.014958119232607701,-3.454753224291571],[4.918222250664481,-6.321353766990505],[3.7887095271063536,-2.381902923114908],[1.9031870197319973,0.3480592385367141],[-0.02736970116802695,6.900002046166584],[-0.014958119232607701,-3.454753224291571]],"lastCommittedPoint":null,"startArrowhead":null,"endArrowhead":null},{"type":"line","version":934,"versionNonce":163947961,"isDeleted":false,"id":"9caxFCw-ATIsnHd7iluDm","fillStyle":"solid","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":0,"x":671.8941804157837,"y":465.0151691188772,"strokeColor":"transparent","backgroundColor":"#d9354d","width":13.303094364612631,"height":23.783773744762588,"seed":240284537,"groupIds":["SizNmjB9nZHXnyCekbpBO","xU94V0951OlSywcsHiICg"],"strokeSharpness":"round","boundElementIds":[],"startBinding":null,"endBinding":null,"points":[[-1.0839394848597903,0],[3.010482324365161,10.476902864781492],[10.717629259376857,19.267867337529182],[11.319750113674642,23.783773744762588],[-1.9833442509379893,7.203788328321434],[-1.0839394848597903,0]],"lastCommittedPoint":null,"startArrowhead":null,"endArrowhead":null},{"type":"rectangle","version":65,"versionNonce":723306679,"isDeleted":false,"id":"guTrLl_2zU39MQ1RJZuMD","fillStyle":"hachure","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":0,"x":260,"y":211.5,"strokeColor":"#000000","backgroundColor":"#228be6","width":840,"height":120,"seed":1739301209,"groupIds":["Ny4FCfAmAzvcxz1XMiIpx"],"strokeSharpness":"sharp","boundElementIds":[]},{"type":"text","version":421,"versionNonce":947552825,"isDeleted":false,"id":"FH2XSm_Z2oTXP4Gj-UTtO","fillStyle":"hachure","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":0,"x":298.3556170993387,"y":229.72222095065638,"strokeColor":"#000000","backgroundColor":"transparent","width":752.2001112196176,"height":91.73172088044123,"seed":865780782,"groupIds":["Ny4FCfAmAzvcxz1XMiIpx"],"strokeSharpness":"sharp","boundElementIds":[],"fontSize":73.38537670435296,"fontFamily":1,"text":"Excalidraw for Roam","baseline":63.73172088044123,"textAlign":"left","verticalAlign":"top"},{"type":"line","version":284,"versionNonce":68196823,"isDeleted":false,"id":"Bw9ysWM05HgTNy6_w773c","fillStyle":"cross-hatch","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":0,"x":260,"y":231.5,"strokeColor":"#000000","backgroundColor":"#228be6","width":40.85471441806885,"height":118.50000000000003,"seed":1652137047,"groupIds":["Ny4FCfAmAzvcxz1XMiIpx"],"strokeSharpness":"sharp","boundElementIds":[],"startBinding":null,"endBinding":null,"points":[[0,0],[-39.85471441806885,-18.75215031550482],[-40.85471441806885,99.74784968449521],[0,80],[0,0]],"lastCommittedPoint":null,"startArrowhead":null,"endArrowhead":null},{"type":"line","version":405,"versionNonce":1983894297,"isDeleted":false,"id":"E9zptSZGg9HQA1cb3na7f","fillStyle":"cross-hatch","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":3.1470053556653,"x":1141.9903756095844,"y":231.87240542012745,"strokeColor":"#000000","backgroundColor":"#228be6","width":40.85471441806885,"height":118.50000000000003,"seed":1769444855,"groupIds":["Ny4FCfAmAzvcxz1XMiIpx"],"strokeSharpness":"sharp","boundElementIds":[],"startBinding":null,"endBinding":null,"points":[[0,0],[-39.85471441806885,-18.75215031550482],[-40.85471441806885,99.74784968449521],[0,80],[0,0]],"lastCommittedPoint":null,"startArrowhead":null,"endArrowhead":null}],"appState":{"currentItemBackgroundColor":"transparent","exportBackground":true,"exportEmbedScene":false,"exportWithDarkMode":false,"height":750,"name":"Excalidraw Splash-screen","scrollX":358.85471441806885,"scrollY":294.7521503155048,"viewBackgroundColor":"#ffffff","width":1490,"offsetLeft":23,"offsetTop":43.20000076293945}};