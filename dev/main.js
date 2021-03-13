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

const cssCode = `
@font-face {
  font-family: "Virgil";
  src: url("https://excalidraw.com/FG_Virgil.woff2");
}
@font-face {
  font-family: "Cascadia";
  src: url("https://excalidraw.com/Cascadia.woff2");
}

.ex-header-wrapper {
  background: silver; 
  height: 30px;
  display: table;
  width: 100%;
  border-radius: 5px;
}

    .ex-header-buttons-wrapper {
      margin-left: 1px;
      display: table-cell;
      width: 1px;
      white-space: nowrap;
    }

        .ex-header-button {
          height: 30px;
          border-radius: 5px;
          border: 1px;
          box-shadow: inset 0 0 0 1px rgb(16 22 26 / 20%), inset 0 -1px 0 rgb(16 22 26 / 10%);
          margin-right: 3px;
        }

    .ex-header-title-wrapper {
       width: 100%;
       display: table-cell; 
    }

        .ex-header-title {
          background: transparent;
          color: black;
          vertical-align: middle;
          height: 30px;
          border: 0px;
          width: 100%; 
        }


    .ex-header-options-wrapper {
      /*float: right;*/
      display: table-cell;
      min-width: fit-content;
      margin-right: 1px;
      white-space: nowrap;
    }

        .ex-header-options-label {
          margin: 0px 8px 0px 0px;
          vertical-align: middle !important;
          /*position: relative;*/
          display: inline-block;
          white-space: nowrap;
        }

        .ex-header-options-checkbox {
          margin: 0px 3px 0px 0px !important;
          vertical-align: middle !important;
          /*position: relative;*/
        }

.excalidraw-data {
  background: silver;
  border: 1px solid black;
  border-radius: 5px;
  padding: 2px 5px 2px 5px;
}

.excalidraw.excalidraw-modal-container {
  z-index: 1010 !important; 
}

kbd {
  color: black !important;
}

.popover {
  display: block;
  top: auto;
  left: auto;
  z-index: 1010 !important;
}

.excalidraw .App-menu_top .buttonList {
  display: flex;
}

.excalidraw-host {     
 /* resize: vertical;*/
}

.excalidraw-wrapper { 
  height: 100%;
  margin: 0px;
  position: relative;
}

.excalidraw-svg {
  margin: 0px -4px -4px -4px;
}

:root[dir="ltr"]
  .excalidraw
  .layer-ui__wrapper
  .zen-mode-transition.App-menu_bottom--transition-left {
  transform: none;
}
`;

let styleElement = document.createElement('style');
styleElement.type = 'text/css';
if (styleElement.styleSheet) {
  styleElement.styleSheet.cssText = cssCode;
} else {
  styleElement.appendChild(document.createTextNode(cssCode));
}
document.getElementsByTagName("head")[0].appendChild(styleElement);

const excalidrawSplashScreen = {"elements": [
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