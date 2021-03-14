function myKeyboardListner(ev) {
  console.log(ev);
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
      
      const [zenModeEnabled, setZenModeEnabled] = React.useState(false);
      const [gridModeEnabled, setGridModeEnabled] = React.useState(false);

      this.setZenModeEnabled = setZenModeEnabled;
      this.setGridModeEnabled = setGridModeEnabled;

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
        excalidrawRef.current.resetScene();
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
            onChange: (elements, state) => {}, //console.log("Elements :", elements, "State : ", state),
            onPointerUpdate: (payload) => {},  //console.log(payload),
            //onCollabButtonClick: () => {},     //window.alert("You clicked on collab button"),
            viewModeEnabled: false,
            zenModeEnabled: zenModeEnabled,
            gridModeEnabled: gridModeEnabled
          })
        )
      );
    }), this.hostDIV);// document.getElementById(appName));
    if (ExcalidrawConfig.DEBUG) console.log("js: ExcalidrawWrapper.constructor() ReactDOM.render() initiated") ;
  }
    
  //this is a workaround because Roam catches some of the keys (e.g. CTRL+Z) before 
  //Exalidraw. When the application is in edit mode / full screen, sink all keyboar events and retrigger
  //to Excalidraw main div
  static fullScreenKeyboardEventRedirect(isFullScreen) {
    if (isFullScreen) {
      document.addEventListener('keydown',myKeyboardListner);
      console.log("keyboard listener added");
    }
    else {
      document.removeEventListener('keydown',myKeyboardListner);
      console.log("keyboard listner removed");
    }
  }
 
  static getDrawing(o) {
    if (ExcalidrawConfig.DEBUG) console.log("js: ExcalidrawWrapper.getDrawing() entering function, object is available: ",(o!=null));
    if(o!=null) {
      let appstate = o.excalidrawRef.current.getAppState();
      delete appstate['collaborators'];
     // delete appstate['fileHandle'];
      return {elements: 
              o.excalidrawRef.current.getSceneElements(),
              appState: appstate};
    }
  }
  
  static getSVG(diagram,node,appName) {
    const hostDIV = node.querySelector('#'+appName);
    ReactDOM.unmountComponentAtNode(hostDIV);
    if (diagram==null) 
      diagram = excalidrawSplashScreen;
    else 
      if (diagram['elements'] == undefined) 
        diagram = excalidrawSplashScreen;   
    
    if(diagram.appState.appearance == 'dark')
      diagram.appState.exportWithDarkMode = true;
    diagram.appState.exportBackground = true;
    
    hostDIV.appendChild(ExcalidrawUtils.exportToSvg(diagram));
    const svg = hostDIV.querySelector('svg');

    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.classList.add('excalidraw-svg');
  }
  
  static getPNG(diagram,node,appName) {
    const hostDIV = node.querySelector('#'+appName);
    ReactDOM.unmountComponentAtNode(hostDIV);
    if (diagram==null) 
      diagram = excalidrawSplashScreen;
    else 
      if (diagram['elements'] == undefined) 
        diagram = excalidrawSplashScreen;    
    
    if(diagram.appState.appearance == 'dark')
      diagram.appState.exportWithDarkMode = true;
    diagram.appState.exportBackground = true;
      
    (async () => {
      const blob = await ExcalidrawUtils.exportToBlob({
        ...diagram,
        mimeType: "image/png",
        exportWithDarkMode: "true",
    });
      const urlCreator = window.URL || window.webkitURL;
      let img = document.createElement('img');
      img.src = urlCreator.createObjectURL(blob);
      img.style.width = '100%';
      hostDIV.appendChild(img);
    })();
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
    window
      .roamAlphaAPI
      .data
      .addPullWatch(
        `[:block/children :block/string :block/order {:block/children ...}]`,
        `[:block/uid "${blockUID}"]`,
         callback); 
  }
  
  static removePullWatch(blockUID, callback) {
    window
      .roamAlphaAPI
      .data
      .removePullWatch(
        `[:block/children :block/string :block/order {:block/children ...}]`,
        `[:block/uid "${blockUID}"]`,
         callback);     
  }

}

excalidrawSplashScreen = {"elements": [
    {
        "type": "rectangle",
        "version": 498,
        "versionNonce": 146214621,
        "isDeleted": false,
        "id": "GhzQ7-0tFYhPZfysK2ZUq",
        "fillStyle": "hachure",
        "strokeWidth": 1,
        "strokeStyle": "solid",
        "roughness": 2,
        "opacity": 100,
        "angle": 0,
        "x": -328.3333740234375,
        "y": -392.00001525878906,
        "strokeColor": "#000000",
        "backgroundColor": "#ced4da",
        "width": 605.3333740234375,
        "height": 254.00003051757812,
        "seed": 1436533245,
        "groupIds": [],
        "strokeSharpness": "sharp",
        "boundElementIds": []
    },
    {
        "type": "text",
        "version": 111,
        "versionNonce": 1339209235,
        "isDeleted": false,
        "id": "tv_H-D7etEju8dyiHcLo3",
        "fillStyle": "hachure",
        "strokeWidth": 1,
        "strokeStyle": "solid",
        "roughness": 1,
        "opacity": 100,
        "angle": 0,
        "x": -218.99993896484375,
        "y": -320.1666717529297,
        "strokeColor": "#364fc7",
        "backgroundColor": "transparent",
        "width": 397,
        "height": 57,
        "seed": 934574461,
        "groupIds": [],
        "strokeSharpness": "sharp",
        "boundElementIds": [],
        "fontSize": 36,
        "fontFamily": 1,
        "text": "EXCALIDRAW - ROAM",
        "baseline": 42,
        "textAlign": "left",
        "verticalAlign": "top"
    },
    {
        "type": "line",
        "version": 639,
        "versionNonce": 1416210589,
        "isDeleted": false,
        "id": "UPDwyRQX5jlwhHVq_0fwq",
        "fillStyle": "hachure",
        "strokeWidth": 1,
        "strokeStyle": "solid",
        "roughness": 2,
        "opacity": 100,
        "angle": 0,
        "x": -217,
        "y": -255.33335876464844,
        "strokeColor": "#364fc7",
        "backgroundColor": "#ced4da",
        "width": 400,
        "height": 56.66668701171875,
        "seed": 908665021,
        "groupIds": [],
        "strokeSharpness": "round",
        "boundElementIds": [],
        "startBinding": null,
        "endBinding": null,
        "points": [
            [0, 0],
            [400, -8],
            [42, 16.66668701171875],
            [290.6666259765625, 21.3333740234375],
            [155.3333740234375, 40.66668701171875],
            [220, 48.66668701171875]
        ],
        "lastCommittedPoint": null,
        "startArrowhead": null,
        "endArrowhead": null
    }
], "appState": {"appearance": "light",
    "currentItemBackgroundColor": "transparent",
    "viewBackgroundColor": "#ffffff"}};