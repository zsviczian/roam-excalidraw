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
      delete appstate['fileHandle'];
      return {elements: 
              o.excalidrawRef.current.getSceneElements(),
              appState: appstate};
    }
  }
  
  static setImgEventListner(roamRenderNode,imgNode,appName) {
    let blockNode = roamRenderNode;
    const blockUID = appName.slice(-9);
    while (blockNode.id.indexOf(blockUID)==-1)
      blockNode = blockNode.parentElement;
    imgNode.addEventListener('dblclick',ExcalidrawWrapper.simulateMouseClick(blockNode));
  }

  static getSVG(diagram,node,appName) {
    const hostDIV = node.querySelector('#'+appName);
    ReactDOM.unmountComponentAtNode(hostDIV);
    let mode = 'light';
    if (diagram != null) 
      if(diagram.appState != null)
        mode = (diagram.appState.appearance == 'dark') ? "dark" : "light";    
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
    
    hostDIV.appendChild(ExcalidrawUtils.exportToSvg(diagram));
    const svg = hostDIV.querySelector('svg');
    
    ExcalidrawWrapper.setImgEventListner(node, svg, appName);
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.classList.add('excalidraw-svg');
  }
  
  static getPNG(diagram,node,appName) {
    const hostDIV = node.querySelector('#'+appName);
    ReactDOM.unmountComponentAtNode(hostDIV);
    let mode = 'light';
    if (diagram != null) 
      if(diagram.appState != null)
        mode = (diagram.appState.appearance == 'dark') ? "dark" : "light";
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
      const blob = await ExcalidrawUtils.exportToBlob({
        ...diagram,
        mimeType: "image/png",
        exportWithDarkMode: "true",
    });
      const urlCreator = window.URL || window.webkitURL;
      let img = document.createElement('img');
      img.src = urlCreator.createObjectURL(blob);
      img.style.width = '100%';
      ExcalidrawWrapper.setImgEventListner(node, img, appName);
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

  static simulateMouseClick (element) {
		try{
			['mousedown', 'click', 'mouseup'].forEach(mouseEventType =>
				element.dispatchEvent( new MouseEvent(mouseEventType, { view: window, bubbles: true, cancelable: true, buttons: 1 }) )
			);
		} catch(e) {}
  }

}



excalidrawSplashScreen = {
      "elements": [
          {
              "type": "arrow",
              "version": 174,
              "versionNonce": 1090952709,
              "isDeleted": false,
              "id": "0lRGDe2fDCfjAx5XZUjKH",
              "fillStyle": "hachure",
              "strokeWidth": 1,
              "strokeStyle": "solid",
              "roughness": 1,
              "opacity": 100,
              "angle": 0,
              "x": 104.88890923394104,
              "y": 138.0677624801521,
              "strokeColor": "#000000",
              "backgroundColor": "transparent",
              "width": 70.28814932772889,
              "height": 145.10865523961428,
              "seed": 573923250,
              "groupIds": [],
              "strokeSharpness": "round",
              "boundElementIds": [],
              "startBinding": {
                  "elementId": "CWdlf_0p6sHvdJNUaHFkv",
                  "focus": -0.9725530716501508,
                  "gap": 5.333343505859375
              },
              "endBinding": null,
              "points": [
                  [
                      0,
                      0
                  ],
                  [
                      -70.28814932772889,
                      -145.10865523961428
                  ]
              ],
              "lastCommittedPoint": null,
              "startArrowhead": null,
              "endArrowhead": "arrow"
          },
          {
              "type": "text",
              "version": 110,
              "versionNonce": 784199883,
              "isDeleted": false,
              "id": "CWdlf_0p6sHvdJNUaHFkv",
              "fillStyle": "hachure",
              "strokeWidth": 1,
              "strokeStyle": "solid",
              "roughness": 1,
              "opacity": 100,
              "angle": 0,
              "x": 110.22225273980041,
              "y": 131.44446182250977,
              "strokeColor": "#000000",
              "backgroundColor": "transparent",
              "width": 596,
              "height": 35,
              "seed": 498722286,
              "groupIds": [],
              "strokeSharpness": "sharp",
              "boundElementIds": [
                  "0lRGDe2fDCfjAx5XZUjKH"
              ],
              "fontSize": 28,
              "fontFamily": 1,
              "text": "Start editing by clicking the pen in the top.",
              "baseline": 25,
              "textAlign": "left",
              "verticalAlign": "top"
          },
          {
              "type": "arrow",
              "version": 181,
              "versionNonce": 1677313803,
              "isDeleted": false,
              "id": "PWvx-BEpJw71udpZl1Rdq",
              "fillStyle": "hachure",
              "strokeWidth": 1,
              "strokeStyle": "solid",
              "roughness": 1,
              "opacity": 100,
              "angle": 0,
              "x": 167.68650791595368,
              "y": 53.559946283792634,
              "strokeColor": "#000000",
              "backgroundColor": "transparent",
              "width": 64.59583199036507,
              "height": 60.91380022665013,
              "seed": 1893892594,
              "groupIds": [],
              "strokeSharpness": "round",
              "boundElementIds": [],
              "startBinding": {
                  "elementId": "ZoRMhBOE1gFBV8G8AJUFx",
                  "focus": -0.8843139108350371,
                  "gap": 10.091242735087917
              },
              "endBinding": null,
              "points": [
                  [
                      0,
                      0
                  ],
                  [
                      -64.59583199036507,
                      -60.91380022665013
                  ]
              ],
              "lastCommittedPoint": null,
              "startArrowhead": null,
              "endArrowhead": "arrow"
          },
          {
              "type": "text",
              "version": 210,
              "versionNonce": 1186087717,
              "isDeleted": false,
              "id": "ZoRMhBOE1gFBV8G8AJUFx",
              "fillStyle": "hachure",
              "strokeWidth": 1,
              "strokeStyle": "solid",
              "roughness": 1,
              "opacity": 100,
              "angle": 0,
              "x": 177.77775065104163,
              "y": 27.8888943990072,
              "strokeColor": "#000000",
              "backgroundColor": "transparent",
              "width": 564,
              "height": 70,
              "seed": 308272686,
              "groupIds": [],
              "strokeSharpness": "sharp",
              "boundElementIds": [
                  "PWvx-BEpJw71udpZl1Rdq"
              ],
              "fontSize": 28,
              "fontFamily": 1,
              "text": "Give a title to your drawing, you'll also \nfind the title nested under the drawing.",
              "baseline": 60,
              "textAlign": "left",
              "verticalAlign": "top"
          },
          {
              "type": "ellipse",
              "version": 285,
              "versionNonce": 1500557125,
              "isDeleted": false,
              "id": "sepJD8zD7P6JJ75ev0zzs",
              "fillStyle": "hachure",
              "strokeWidth": 1,
              "strokeStyle": "solid",
              "roughness": 1,
              "opacity": 100,
              "angle": 0,
              "x": 215.55557590060766,
              "y": 188.9999885559082,
              "strokeColor": "#000000",
              "backgroundColor": "#228be6",
              "width": 904.7777981228298,
              "height": 141.55558607313378,
              "seed": 1996486642,
              "groupIds": [],
              "strokeSharpness": "sharp",
              "boundElementIds": []
          },
          {
              "type": "text",
              "version": 383,
              "versionNonce": 966930283,
              "isDeleted": false,
              "id": "FH2XSm_Z2oTXP4Gj-UTtO",
              "fillStyle": "hachure",
              "strokeWidth": 1,
              "strokeStyle": "solid",
              "roughness": 1,
              "opacity": 100,
              "angle": 0,
              "x": 298.3556170993387,
              "y": 214.22222095065638,
              "strokeColor": "#000000",
              "backgroundColor": "transparent",
              "width": 752.2001112196176,
              "height": 91.73172088044123,
              "seed": 865780782,
              "groupIds": [],
              "strokeSharpness": "sharp",
              "boundElementIds": [],
              "fontSize": 73.38537670435296,
              "fontFamily": 1,
              "text": "Excalidraw for Roam",
              "baseline": 63.73172088044123,
              "textAlign": "left",
              "verticalAlign": "top"
          },
          {
              "type": "text",
              "version": 254,
              "versionNonce": 861625003,
              "isDeleted": false,
              "id": "XKWoeVR0OKoccUi069ZcH",
              "fillStyle": "hachure",
              "strokeWidth": 1,
              "strokeStyle": "solid",
              "roughness": 1,
              "opacity": 100,
              "angle": 0,
              "x": 593.5910095736513,
              "y": 297.91452186128026,
              "strokeColor": "#000000",
              "backgroundColor": "#228be6",
              "width": 144.97312011718748,
              "height": 27.666625976562493,
              "seed": 1876513518,
              "groupIds": [],
              "strokeSharpness": "sharp",
              "boundElementIds": [],
              "fontSize": 22.133300781249996,
              "fontFamily": 1,
              "text": "Beta release",
              "baseline": 19.666625976562493,
              "textAlign": "left",
              "verticalAlign": "top"
          },
          {
              "type": "rectangle",
              "version": 273,
              "versionNonce": 299494501,
              "isDeleted": false,
              "id": "UQttW70qznY66iLcj5l-o",
              "fillStyle": "hachure",
              "strokeWidth": 1,
              "strokeStyle": "solid",
              "roughness": 1,
              "opacity": 100,
              "angle": 0,
              "x": 633.9998914930554,
              "y": 386.8889181349012,
              "strokeColor": "#000000",
              "backgroundColor": "#fab005",
              "width": 697.7778049045139,
              "height": 175.33331298828125,
              "seed": 1652020530,
              "groupIds": [
                  "Cf2VJFMfztrr6BpetDwdE"
              ],
              "strokeSharpness": "sharp",
              "boundElementIds": []
          },
          {
              "type": "text",
              "version": 676,
              "versionNonce": 39139435,
              "isDeleted": false,
              "id": "c3ia_Z5LtmkcispqjQV0e",
              "fillStyle": "hachure",
              "strokeWidth": 1,
              "strokeStyle": "solid",
              "roughness": 1,
              "opacity": 100,
              "angle": 0,
              "x": 826.6666124131941,
              "y": 400.3334032694498,
              "strokeColor": "#000000",
              "backgroundColor": "#fa5252",
              "width": 476,
              "height": 141,
              "seed": 142571566,
              "groupIds": [
                  "Cf2VJFMfztrr6BpetDwdE"
              ],
              "strokeSharpness": "sharp",
              "boundElementIds": [],
              "fontSize": 28,
              "fontFamily": 1,
              "text": "If you like Excalidraw in Roam,\nsupport me by buying me a coffee,\nso I can stay awake and work on\nupdates.",
              "baseline": 131,
              "textAlign": "left",
              "verticalAlign": "top"
          },
          {
              "type": "text",
              "version": 380,
              "versionNonce": 1415950981,
              "isDeleted": false,
              "id": "WIhfNCnhl-AX4kqdRutGH",
              "fillStyle": "hachure",
              "strokeWidth": 1,
              "strokeStyle": "solid",
              "roughness": 1,
              "opacity": 100,
              "angle": 0,
              "x": 1121.5554334852432,
              "y": 520.9999275207522,
              "strokeColor": "#000000",
              "backgroundColor": "#fa5252",
              "width": 201,
              "height": 35,
              "seed": 710246002,
              "groupIds": [
                  "Cf2VJFMfztrr6BpetDwdE"
              ],
              "strokeSharpness": "sharp",
              "boundElementIds": [],
              "fontSize": 28,
              "fontFamily": 1,
              "text": "ko-fi.com/zsolt",
              "baseline": 25,
              "textAlign": "left",
              "verticalAlign": "top"
          },
          {
              "type": "line",
              "version": 869,
              "versionNonce": 2139681547,
              "isDeleted": false,
              "id": "9-VNwks7d_qHaCwrqzCvs",
              "fillStyle": "solid",
              "strokeWidth": 1,
              "strokeStyle": "solid",
              "roughness": 2,
              "opacity": 50,
              "angle": 0,
              "x": 734.0016397981424,
              "y": 521.8182862170081,
              "strokeColor": "#e78190",
              "backgroundColor": "#e78190",
              "width": 58.81873098236764,
              "height": 101.71181278178392,
              "seed": 1033298994,
              "groupIds": [
                  "4xAUvancUQwZKO1pTw4EB",
                  "Cf2VJFMfztrr6BpetDwdE"
              ],
              "strokeSharpness": "round",
              "boundElementIds": [],
              "startBinding": null,
              "endBinding": null,
              "points": [
                  [
                      0,
                      -73.50931897646686
                  ],
                  [
                      5.308549727650597,
                      -91.34604606137269
                  ],
                  [
                      22.932934823450196,
                      -101.53846153846166
                  ],
                  [
                      47.776947548854544,
                      -99.62738363650739
                  ],
                  [
                      58.81873098236764,
                      -78.60552671501135
                  ],
                  [
                      51.811445341869,
                      -49.30233221838049
                  ],
                  [
                      28.66616852931287,
                      -31.465605133474728
                  ],
                  [
                      16.77501713937556,
                      -22.547241591021844
                  ],
                  [
                      1.0617099455302192,
                      0.17335124332225704
                  ],
                  [
                      8.493679564240756,
                      -17.66337584158339
                  ],
                  [
                      37.159848093553656,
                      -44.630808458048016
                  ],
                  [
                      52.44847130918712,
                      -67.77608527060426
                  ],
                  [
                      48.83865749438457,
                      -87.09920627925226
                  ],
                  [
                      36.31048013712936,
                      -96.4422537999171
                  ],
                  [
                      16.77501713937556,
                      -97.71630573455315
                  ],
                  [
                      0.42468397821188625,
                      -77.33147478037515
                  ],
                  [
                      0,
                      -73.50931897646686
                  ]
              ],
              "lastCommittedPoint": null,
              "startArrowhead": null,
              "endArrowhead": null
          },
          {
              "type": "line",
              "version": 850,
              "versionNonce": 1341904677,
              "isDeleted": false,
              "id": "12Y7UPjklc7_UZOfPPrEK",
              "fillStyle": "solid",
              "strokeWidth": 1,
              "strokeStyle": "solid",
              "roughness": 2,
              "opacity": 100,
              "angle": 0,
              "x": 739.2992267092093,
              "y": 523.2103362277705,
              "strokeColor": "#e78190",
              "backgroundColor": "#e78190",
              "width": 52.67850846405181,
              "height": 108.57753709621193,
              "seed": 920530926,
              "groupIds": [
                  "4xAUvancUQwZKO1pTw4EB",
                  "Cf2VJFMfztrr6BpetDwdE"
              ],
              "strokeSharpness": "round",
              "boundElementIds": [],
              "startBinding": null,
              "endBinding": null,
              "points": [
                  [
                      -4.826369427747376,
                      -71.18894905928033
                  ],
                  [
                      0.46448513414438064,
                      -89.36188429360396
                  ],
                  [
                      14.036677271170934,
                      -98.33333333333326
                  ],
                  [
                      35.66016982846725,
                      -96.95311040414418
                  ],
                  [
                      46.01184179738575,
                      -79.24024947955034
                  ],
                  [
                      39.34076430630489,
                      -55.546422528470046
                  ],
                  [
                      14.496751580900487,
                      -31.852595577389987
                  ],
                  [
                      -3.676183653423017,
                      -12.759511723606854
                  ],
                  [
                      -6.66666666666606,
                      10.244203762878687
                  ]
              ],
              "lastCommittedPoint": null,
              "startArrowhead": null,
              "endArrowhead": null
          },
          {
              "type": "line",
              "version": 781,
              "versionNonce": 531388843,
              "isDeleted": false,
              "id": "KVFhxKrtTCvi3kzEN95Yp",
              "fillStyle": "solid",
              "strokeWidth": 1,
              "strokeStyle": "solid",
              "roughness": 2,
              "opacity": 100,
              "angle": 0,
              "x": 729.2174427731559,
              "y": 530.3618600987986,
              "strokeColor": "#e78190",
              "backgroundColor": "#e78190",
              "width": 62.80014327810554,
              "height": 106.27716554756329,
              "seed": 1364168178,
              "groupIds": [
                  "4xAUvancUQwZKO1pTw4EB",
                  "Cf2VJFMfztrr6BpetDwdE"
              ],
              "strokeSharpness": "round",
              "boundElementIds": [],
              "startBinding": null,
              "endBinding": null,
              "points": [
                  [
                      0,
                      -82.04828027171304
                  ],
                  [
                      8.741411884864347,
                      -102.29154989982038
                  ],
                  [
                      32.43523883594464,
                      -113.33333333333348
                  ],
                  [
                      57.049214406484275,
                      -103.90180998387439
                  ],
                  [
                      62.80014327810554,
                      -75.83727709036197
                  ],
                  [
                      49.22795114107902,
                      -51.683375829552126
                  ],
                  [
                      17.942898079458725,
                      -30.059883272255735
                  ],
                  [
                      4.140668787567401,
                      -7.0561677857702
                  ]
              ],
              "lastCommittedPoint": null,
              "startArrowhead": null,
              "endArrowhead": null
          },
          {
              "type": "line",
              "version": 755,
              "versionNonce": 1126148741,
              "isDeleted": false,
              "id": "sn1ak7oAYveZzEyOi4vF0",
              "fillStyle": "solid",
              "strokeWidth": 1,
              "strokeStyle": "solid",
              "roughness": 2,
              "opacity": 100,
              "angle": 0,
              "x": 880.8414965058316,
              "y": 480.96687604676833,
              "strokeColor": "#e78190",
              "backgroundColor": "#e78190",
              "width": 63.030180432970354,
              "height": 100.75627383080679,
              "seed": 1471021614,
              "groupIds": [
                  "4xAUvancUQwZKO1pTw4EB",
                  "Cf2VJFMfztrr6BpetDwdE"
              ],
              "strokeSharpness": "round",
              "boundElementIds": [],
              "startBinding": null,
              "endBinding": null,
              "points": [
                  [
                      -154.4438216879301,
                      -34.9911783511718
                  ],
                  [
                      -171.92664545765905,
                      -48.333333333333485
                  ],
                  [
                      -200.22121550603626,
                      -47.64322186873892
                  ],
                  [
                      -213.33333333333303,
                      -28.32010086009113
                  ],
                  [
                      -208.27251592630628,
                      1.3546921174753979
                  ],
                  [
                      -183.42850320090176,
                      22.28807321017719
                  ],
                  [
                      -160.99988060157833,
                      38.73572978301445
                  ],
                  [
                      -153.52367306847077,
                      45.29178869666274
                  ],
                  [
                      -150.30315290036268,
                      52.4229404974733
                  ]
              ],
              "lastCommittedPoint": null,
              "startArrowhead": null,
              "endArrowhead": null
          },
          {
              "type": "line",
              "version": 552,
              "versionNonce": 1072294987,
              "isDeleted": false,
              "id": "xV-lcPEi0ZXsOQzTMNH0z",
              "fillStyle": "solid",
              "strokeWidth": 1,
              "strokeStyle": "solid",
              "roughness": 2,
              "opacity": 100,
              "angle": 0,
              "x": 841.351467600766,
              "y": 472.46141801707597,
              "strokeColor": "#e78190",
              "backgroundColor": "#e78190",
              "width": 53.82869423837623,
              "height": 88.56430462296942,
              "seed": 1137508274,
              "groupIds": [
                  "4xAUvancUQwZKO1pTw4EB",
                  "Cf2VJFMfztrr6BpetDwdE"
              ],
              "strokeSharpness": "round",
              "boundElementIds": [],
              "startBinding": null,
              "endBinding": null,
              "points": [
                  [
                      -121.26253187216399,
                      -26.545031852613054
                  ],
                  [
                      -141.0457271905416,
                      -36.66666666666674
                  ],
                  [
                      -155.7681051018923,
                      -35.056406582612716
                  ],
                  [
                      -167.5,
                      -19.643917206667467
                  ],
                  [
                      -162.66921974783799,
                      9.110727151439578
                  ],
                  [
                      -126.09331212432599,
                      39.245594438735644
                  ],
                  [
                      -113.67130576162376,
                      51.897637956302674
                  ]
              ],
              "lastCommittedPoint": null,
              "startArrowhead": null,
              "endArrowhead": null
          },
          {
              "type": "line",
              "version": 849,
              "versionNonce": 2100433381,
              "isDeleted": false,
              "id": "8nAwkIx-KgOQ7M8e4nOOU",
              "fillStyle": "solid",
              "strokeWidth": 1,
              "strokeStyle": "solid",
              "roughness": 2,
              "opacity": 100,
              "angle": 0,
              "x": 733.3097067622473,
              "y": 508.1496764652704,
              "strokeColor": "#e78190",
              "backgroundColor": "#e78190",
              "width": 58.429437335673114,
              "height": 101.44638529540134,
              "seed": 1799982190,
              "groupIds": [
                  "4xAUvancUQwZKO1pTw4EB",
                  "Cf2VJFMfztrr6BpetDwdE"
              ],
              "strokeSharpness": "round",
              "boundElementIds": [],
              "startBinding": null,
              "endBinding": null,
              "points": [
                  [
                      0,
                      -64.55269109612712
                  ],
                  [
                      7.361188955675213,
                      -80.65529193666696
                  ],
                  [
                      32.89531314567416,
                      -89.16666666666674
                  ],
                  [
                      54.28876854810577,
                      -77.43477176855909
                  ],
                  [
                      58.429437335673114,
                      -56.50139067585711
                  ],
                  [
                      49.91806260567354,
                      -38.0984182866687
                  ],
                  [
                      31.975164526214847,
                      -23.836114685047658
                  ],
                  [
                      17.36780519229667,
                      -13.829498448426435
                  ],
                  [
                      6.441040336215876,
                      -3.1327707472106776
                  ],
                  [
                      0.9201486194593379,
                      12.279718628734614
                  ]
              ],
              "lastCommittedPoint": null,
              "startArrowhead": null,
              "endArrowhead": null
          },
          {
              "type": "line",
              "version": 631,
              "versionNonce": 874261227,
              "isDeleted": false,
              "id": "s4zk5hTgrAN16LvL_lGbm",
              "fillStyle": "solid",
              "strokeWidth": 1,
              "strokeStyle": "solid",
              "roughness": 2,
              "opacity": 100,
              "angle": 0,
              "x": 879.5127436789705,
              "y": 487.2500710526848,
              "strokeColor": "#e78190",
              "backgroundColor": "#e78190",
              "width": 60.49977172945707,
              "height": 94.54527064945567,
              "seed": 1899379058,
              "groupIds": [
                  "4xAUvancUQwZKO1pTw4EB",
                  "Cf2VJFMfztrr6BpetDwdE"
              ],
              "strokeSharpness": "round",
              "boundElementIds": [],
              "startBinding": null,
              "endBinding": null,
              "points": [
                  [
                      -150.8240446171194,
                      -39.21425160045108
                  ],
                  [
                      -168.07683123198345,
                      -52.55640658261272
                  ],
                  [
                      -182.56917198846938,
                      -54.16666666666674
                  ],
                  [
                      -200.05199575819842,
                      -49.33588641450477
                  ],
                  [
                      -208.33333333333303,
                      -31.853062644775754
                  ],
                  [
                      -206.2629989395495,
                      -13.450090255587222
                  ],
                  [
                      -181.18894905928013,
                      12.314071089276467
                  ],
                  [
                      -152.89437901090315,
                      33.01741502711357
                  ],
                  [
                      -147.83356160387598,
                      40.37860398278893
                  ]
              ],
              "lastCommittedPoint": null,
              "startArrowhead": null,
              "endArrowhead": null
          },
          {
              "type": "line",
              "version": 880,
              "versionNonce": 1262521669,
              "isDeleted": false,
              "id": "EoxgE0RCqohSQiLpu0lj0",
              "fillStyle": "solid",
              "strokeWidth": 1,
              "strokeStyle": "solid",
              "roughness": 2,
              "opacity": 50,
              "angle": 0,
              "x": 876.1757821112521,
              "y": 483.82770968479906,
              "strokeColor": "transparent",
              "backgroundColor": "#e78190",
              "width": 60.41129590066293,
              "height": 94.91686913039119,
              "seed": 259641006,
              "groupIds": [
                  "4xAUvancUQwZKO1pTw4EB",
                  "Cf2VJFMfztrr6BpetDwdE"
              ],
              "strokeSharpness": "round",
              "boundElementIds": [],
              "startBinding": null,
              "endBinding": null,
              "points": [
                  [
                      -147.85397112312094,
                      -37.868437048482946
                  ],
                  [
                      -169.30051202282917,
                      -52.30769230769238
                  ],
                  [
                      -192.23344684627924,
                      -51.24598236216231
                  ],
                  [
                      -204.2307692307695,
                      -34.24345594874449
                  ],
                  [
                      -203.06288829068637,
                      -4.106060780625704
                  ],
                  [
                      -180.55463744544795,
                      15.641744206234193
                  ],
                  [
                      -143.81947333010658,
                      42.60917682269882
                  ],
                  [
                      -160.38214848037612,
                      22.861371835838877
                  ],
                  [
                      -195.20623469376358,
                      -4.106060780625704
                  ],
                  [
                      -197.2993200149512,
                      -34.69847449682887
                  ],
                  [
                      -187.56192308594697,
                      -45.33074123706602
                  ],
                  [
                      -171.95478688665415,
                      -46.27111290310688
                  ],
                  [
                      -147.85397112312094,
                      -37.868437048482946
                  ]
              ],
              "lastCommittedPoint": null,
              "startArrowhead": null,
              "endArrowhead": null
          },
          {
              "type": "line",
              "version": 859,
              "versionNonce": 1892521355,
              "isDeleted": false,
              "id": "QE6LiChedDtAv1BciE52V",
              "fillStyle": "solid",
              "strokeWidth": 1,
              "strokeStyle": "solid",
              "roughness": 2,
              "opacity": 100,
              "angle": 0,
              "x": 729.5374606759067,
              "y": 534.5093264189941,
              "strokeColor": "#e78190",
              "backgroundColor": "#e78190",
              "width": 62.80014327810554,
              "height": 106.27716554756329,
              "seed": 416430898,
              "groupIds": [
                  "4xAUvancUQwZKO1pTw4EB",
                  "Cf2VJFMfztrr6BpetDwdE"
              ],
              "strokeSharpness": "round",
              "boundElementIds": [],
              "startBinding": null,
              "endBinding": null,
              "points": [
                  [
                      0,
                      -82.04828027171304
                  ],
                  [
                      8.741411884864347,
                      -102.29154989982038
                  ],
                  [
                      32.43523883594464,
                      -113.33333333333348
                  ],
                  [
                      57.049214406484275,
                      -103.90180998387439
                  ],
                  [
                      62.80014327810554,
                      -75.83727709036197
                  ],
                  [
                      49.22795114107902,
                      -51.683375829552126
                  ],
                  [
                      17.942898079458725,
                      -30.059883272255735
                  ],
                  [
                      4.140668787567401,
                      -7.0561677857702
                  ]
              ],
              "lastCommittedPoint": null,
              "startArrowhead": null,
              "endArrowhead": null
          },
          {
              "type": "line",
              "version": 602,
              "versionNonce": 2091424933,
              "isDeleted": false,
              "id": "vFPAjaP8z-2DO04hG9Nhg",
              "fillStyle": "solid",
              "strokeWidth": 1,
              "strokeStyle": "solid",
              "roughness": 2,
              "opacity": 100,
              "angle": 0,
              "x": 893.2237086208295,
              "y": 470.37683842228296,
              "strokeColor": "#e78190",
              "backgroundColor": "transparent",
              "width": 42.15953674614061,
              "height": 45.92378109847477,
              "seed": 1088932078,
              "groupIds": [
                  "4xAUvancUQwZKO1pTw4EB",
                  "Cf2VJFMfztrr6BpetDwdE"
              ],
              "strokeSharpness": "round",
              "boundElementIds": [],
              "startBinding": null,
              "endBinding": null,
              "points": [
                  [
                      -110.56773598113145,
                      0
                  ],
                  [
                      -140.93264042329236,
                      23.84021423144866
                  ],
                  [
                      -152.72727272727207,
                      45.92378109847477
                  ]
              ],
              "lastCommittedPoint": null,
              "startArrowhead": null,
              "endArrowhead": null
          },
          {
              "type": "line",
              "version": 587,
              "versionNonce": 1966648363,
              "isDeleted": false,
              "id": "29GXGJw_gBlDaTSz6ylo-",
              "fillStyle": "solid",
              "strokeWidth": 1,
              "strokeStyle": "solid",
              "roughness": 2,
              "opacity": 100,
              "angle": 0,
              "x": 750.5452481500558,
              "y": 433.91921535002564,
              "strokeColor": "#e78190",
              "backgroundColor": "transparent",
              "width": 43.41428486358545,
              "height": 41.406687875673995,
              "seed": 2030568690,
              "groupIds": [
                  "4xAUvancUQwZKO1pTw4EB",
                  "Cf2VJFMfztrr6BpetDwdE"
              ],
              "strokeSharpness": "round",
              "boundElementIds": [],
              "startBinding": null,
              "endBinding": null,
              "points": [
                  [
                      0,
                      -10.530260569631585
                  ],
                  [
                      16.813624773758544,
                      -14.545454545454504
                  ],
                  [
                      38.14434277031779,
                      0.009623616903629117
                  ],
                  [
                      43.41428486358545,
                      26.86123333021949
                  ]
              ],
              "lastCommittedPoint": null,
              "startArrowhead": null,
              "endArrowhead": null
          },
          {
              "type": "line",
              "version": 561,
              "versionNonce": 420986885,
              "isDeleted": false,
              "id": "kjQQ5pueM1qREQqjCtwWO",
              "fillStyle": "solid",
              "strokeWidth": 1,
              "strokeStyle": "solid",
              "roughness": 2,
              "opacity": 100,
              "angle": 0,
              "x": 896.2824336018064,
              "y": 441.3542333358172,
              "strokeColor": "#e78190",
              "backgroundColor": "transparent",
              "width": 43.163335240096444,
              "height": 6.775639834201189,
              "seed": 2132572974,
              "groupIds": [
                  "4xAUvancUQwZKO1pTw4EB",
                  "Cf2VJFMfztrr6BpetDwdE"
              ],
              "strokeSharpness": "round",
              "boundElementIds": [],
              "startBinding": null,
              "endBinding": null,
              "points": [
                  [
                      -113.20030112353959,
                      -17.769814711253314
                  ],
                  [
                      -130.76677476776462,
                      -24.545454545454504
                  ],
                  [
                      -156.36363636363603,
                      -20.028361322653673
                  ]
              ],
              "lastCommittedPoint": null,
              "startArrowhead": null,
              "endArrowhead": null
          },
          {
              "type": "line",
              "version": 560,
              "versionNonce": 1967648459,
              "isDeleted": false,
              "id": "HtMVWhdIEsyJz9dQ7jcSu",
              "fillStyle": "solid",
              "strokeWidth": 1,
              "strokeStyle": "solid",
              "roughness": 2,
              "opacity": 100,
              "angle": 0,
              "x": 852.3108302965891,
              "y": 468.8843435884163,
              "strokeColor": "#e78190",
              "backgroundColor": "transparent",
              "width": 49.93897507429799,
              "height": 10.288934563046265,
              "seed": 1801361074,
              "groupIds": [
                  "4xAUvancUQwZKO1pTw4EB",
                  "Cf2VJFMfztrr6BpetDwdE"
              ],
              "strokeSharpness": "round",
              "boundElementIds": [],
              "startBinding": null,
              "endBinding": null,
              "points": [
                  [
                      -130.9701158347939,
                      -26.983792709680987
                  ],
                  [
                      -153.05368270182055,
                      -37.27272727272725
                  ],
                  [
                      -166.60496237022255,
                      -36.26892877877158
                  ],
                  [
                      -180.9090909090919,
                      -28.74044007410348
                  ]
              ],
              "lastCommittedPoint": null,
              "startArrowhead": null,
              "endArrowhead": null
          },
          {
              "type": "line",
              "version": 582,
              "versionNonce": 1451980645,
              "isDeleted": false,
              "id": "uYyYwcUpOS0N8fHbqEUK9",
              "fillStyle": "solid",
              "strokeWidth": 1,
              "strokeStyle": "solid",
              "roughness": 2,
              "opacity": 100,
              "angle": 0,
              "x": 702.2969740763044,
              "y": 432.60016428175766,
              "strokeColor": "#e78190",
              "backgroundColor": "transparent",
              "width": 40.151939758229524,
              "height": 71.26969307085695,
              "seed": 1887495534,
              "groupIds": [
                  "4xAUvancUQwZKO1pTw4EB",
                  "Cf2VJFMfztrr6BpetDwdE"
              ],
              "strokeSharpness": "round",
              "boundElementIds": [],
              "startBinding": null,
              "endBinding": null,
              "points": [
                  [
                      -25.6675101384774,
                      0
                  ],
                  [
                      -35.45454545454595,
                      15.056977409335987
                  ],
                  [
                      -34.19979733710117,
                      40.15193975822932
                  ],
                  [
                      -14.625726704964332,
                      60.22790963734395
                  ],
                  [
                      4.697394303683576,
                      71.26969307085695
                  ]
              ],
              "lastCommittedPoint": null,
              "startArrowhead": null,
              "endArrowhead": null
          },
          {
              "type": "line",
              "version": 543,
              "versionNonce": 1133895019,
              "isDeleted": false,
              "id": "EQ-cAVqRt2ivtXOMi3Wg0",
              "fillStyle": "solid",
              "strokeWidth": 1,
              "strokeStyle": "solid",
              "roughness": 2,
              "opacity": 100,
              "angle": 0,
              "x": 791.5185515118771,
              "y": 421.2371816613073,
              "strokeColor": "#e78190",
              "backgroundColor": "transparent",
              "width": 17.064574397247515,
              "height": 41.15573825218506,
              "seed": 8188018,
              "groupIds": [
                  "4xAUvancUQwZKO1pTw4EB",
                  "Cf2VJFMfztrr6BpetDwdE"
              ],
              "strokeSharpness": "round",
              "boundElementIds": [],
              "startBinding": null,
              "endBinding": null,
              "points": [
                  [
                      -44.75360742093447,
                      0
                  ],
                  [
                      -57.55203821887003,
                      12.296531550957726
                  ],
                  [
                      -61.81818181818198,
                      41.15573825218506
                  ]
              ],
              "lastCommittedPoint": null,
              "startArrowhead": null,
              "endArrowhead": null
          },
          {
              "type": "rectangle",
              "version": 844,
              "versionNonce": 1566224005,
              "isDeleted": false,
              "id": "1nOG08NvMG6GT7ObXhGgy",
              "fillStyle": "cross-hatch",
              "strokeWidth": 1,
              "strokeStyle": "solid",
              "roughness": 1,
              "opacity": 100,
              "angle": 0,
              "x": 1158.7436168703262,
              "y": -2.443371926333299,
              "strokeColor": "#000000",
              "backgroundColor": "transparent",
              "width": 168.66655815972217,
              "height": 159.8603064113602,
              "seed": 2015740133,
              "groupIds": [
                  "sa7CSY40OgIvVGPFCddIg"
              ],
              "strokeSharpness": "sharp",
              "boundElementIds": []
          },
          {
              "type": "line",
              "version": 480,
              "versionNonce": 1037117515,
              "isDeleted": false,
              "id": "aXtt5hW2KJkwVImFqsReG",
              "fillStyle": "cross-hatch",
              "strokeWidth": 4,
              "strokeStyle": "solid",
              "roughness": 0,
              "opacity": 100,
              "angle": 0,
              "x": 1176.8641056979804,
              "y": 226.7726024695939,
              "strokeColor": "#000000",
              "backgroundColor": "transparent",
              "width": 42.942712660297374,
              "height": 74.50301955521472,
              "seed": 1455352811,
              "groupIds": [
                  "sa7CSY40OgIvVGPFCddIg"
              ],
              "strokeSharpness": "round",
              "boundElementIds": [],
              "startBinding": null,
              "endBinding": null,
              "points": [
                  [
                      0,
                      -69.49698044478527
                  ],
                  [
                      2.5869104012227333,
                      -94.84870237676802
                  ],
                  [
                      16.556226567825483,
                      -121.23518846923992
                  ],
                  [
                      42.942712660297374,
                      -144
                  ]
              ],
              "lastCommittedPoint": null,
              "startArrowhead": null,
              "endArrowhead": null
          },
          {
              "type": "line",
              "version": 310,
              "versionNonce": 560764389,
              "isDeleted": false,
              "id": "x2gHTSBkun4AnNw-DmgUN",
              "fillStyle": "cross-hatch",
              "strokeWidth": 4,
              "strokeStyle": "solid",
              "roughness": 0,
              "opacity": 100,
              "angle": 0,
              "x": 1330.6186350308026,
              "y": 226.7378383091048,
              "strokeColor": "#000000",
              "backgroundColor": "transparent",
              "width": 22.76481153076005,
              "height": 75.02040163545924,
              "seed": 702962757,
              "groupIds": [
                  "sa7CSY40OgIvVGPFCddIg"
              ],
              "strokeSharpness": "round",
              "boundElementIds": [],
              "startBinding": null,
              "endBinding": null,
              "points": [
                  [
                      -20.26995262972905,
                      -69.97959836454075
                  ],
                  [
                      -19.23518846923995,
                      -95.84870237676805
                  ],
                  [
                      -25.96115551241906,
                      -123.26995262972902
                  ],
                  [
                      -42,
                      -145
                  ]
              ],
              "lastCommittedPoint": null,
              "startArrowhead": null,
              "endArrowhead": null
          },
          {
              "type": "ellipse",
              "version": 360,
              "versionNonce": 1773922027,
              "isDeleted": false,
              "id": "0rqKzXZHNp4qu9vhUzflg",
              "fillStyle": "cross-hatch",
              "strokeWidth": 4,
              "strokeStyle": "solid",
              "roughness": 0,
              "opacity": 100,
              "angle": 0,
              "x": 1211.0113229941194,
              "y": 11.891257476090829,
              "strokeColor": "#000000",
              "backgroundColor": "transparent",
              "width": 85.88542532059475,
              "height": 85.88542532059475,
              "seed": 326121099,
              "groupIds": [
                  "sa7CSY40OgIvVGPFCddIg"
              ],
              "strokeSharpness": "sharp",
              "boundElementIds": []
          },
          {
              "type": "ellipse",
              "version": 244,
              "versionNonce": 227184965,
              "isDeleted": false,
              "id": "6Cda9BWrnjhZVoIBEFIRy",
              "fillStyle": "cross-hatch",
              "strokeWidth": 4,
              "strokeStyle": "solid",
              "roughness": 0,
              "opacity": 100,
              "angle": 0,
              "x": 1240.50210156806,
              "y": 36.72559732782907,
              "strokeColor": "#000000",
              "backgroundColor": "transparent",
              "width": 4.65643872220092,
              "height": 4.65643872220092,
              "seed": 1136429989,
              "groupIds": [
                  "sa7CSY40OgIvVGPFCddIg"
              ],
              "strokeSharpness": "sharp",
              "boundElementIds": []
          },
          {
              "type": "ellipse",
              "version": 268,
              "versionNonce": 1393938827,
              "isDeleted": false,
              "id": "MbiPk2jvtJy-_s9FMM6VG",
              "fillStyle": "cross-hatch",
              "strokeWidth": 4,
              "strokeStyle": "solid",
              "roughness": 0,
              "opacity": 100,
              "angle": 0,
              "x": 1269.9928801419992,
              "y": 35.17345108709548,
              "strokeColor": "#000000",
              "backgroundColor": "transparent",
              "width": 4.65643872220092,
              "height": 4.65643872220092,
              "seed": 1289694507,
              "groupIds": [
                  "sa7CSY40OgIvVGPFCddIg"
              ],
              "strokeSharpness": "sharp",
              "boundElementIds": []
          },
          {
              "type": "line",
              "version": 331,
              "versionNonce": 1863458981,
              "isDeleted": false,
              "id": "D0pqBdZziQ2c3tYNjGlm1",
              "fillStyle": "cross-hatch",
              "strokeWidth": 4,
              "strokeStyle": "solid",
              "roughness": 0,
              "opacity": 100,
              "angle": 0,
              "x": 1233.258752444634,
              "y": 69.14684758079005,
              "strokeColor": "#000000",
              "backgroundColor": "transparent",
              "width": 50.703443863965546,
              "height": 19.143136969048218,
              "seed": 1440075525,
              "groupIds": [
                  "sa7CSY40OgIvVGPFCddIg"
              ],
              "strokeSharpness": "round",
              "boundElementIds": [],
              "startBinding": null,
              "endBinding": null,
              "points": [
                  [
                      0,
                      -2.413089598777267
                  ],
                  [
                      9.830259524646378,
                      10.521462407336394
                  ],
                  [
                      28.456014413450045,
                      14.143136969048218
                  ],
                  [
                      43.46009474054191,
                      4.830259524646382
                  ],
                  [
                      50.703443863965546,
                      -5
                  ]
              ],
              "lastCommittedPoint": null,
              "startArrowhead": null,
              "endArrowhead": null
          },
          {
              "type": "line",
              "version": 149,
              "versionNonce": 2025980517,
              "isDeleted": false,
              "id": "M1ef4IyC9_RF4c_1ki-Ow",
              "fillStyle": "solid",
              "strokeWidth": 1,
              "strokeStyle": "solid",
              "roughness": 1,
              "opacity": 100,
              "angle": 0,
              "x": 84.09778984680666,
              "y": 483.663356333844,
              "strokeColor": "#000000",
              "backgroundColor": "#fab005",
              "width": 138.5641,
              "height": 160,
              "seed": 944794821,
              "groupIds": [],
              "strokeSharpness": "sharp",
              "boundElementIds": [],
              "startBinding": null,
              "endBinding": null,
              "points": [
                  [
                      30,
                      0
                  ],
                  [
                      69.282,
                      40
                  ],
                  [
                      15,
                      25.9808
                  ],
                  [
                      0,
                      80
                  ],
                  [
                      -15,
                      25.9808
                  ],
                  [
                      -69.282,
                      40
                  ],
                  [
                      -30,
                      0
                  ],
                  [
                      -69.282,
                      -40
                  ],
                  [
                      -15,
                      -25.9808
                  ],
                  [
                      0,
                      -80
                  ],
                  [
                      15,
                      -25.9808
                  ],
                  [
                      69.282,
                      -40
                  ],
                  [
                      30,
                      0
                  ]
              ],
              "lastCommittedPoint": null,
              "startArrowhead": null,
              "endArrowhead": null
          },
          {
              "type": "text",
              "version": 138,
              "versionNonce": 1112243851,
              "isDeleted": false,
              "id": "iipgzYlkb_F2NS6ZMy3ze",
              "fillStyle": "cross-hatch",
              "strokeWidth": 1,
              "strokeStyle": "solid",
              "roughness": 1,
              "opacity": 100,
              "angle": 0,
              "x": 957.5213403946318,
              "y": 566.6496263161685,
              "strokeColor": "#000000",
              "backgroundColor": "transparent",
              "width": 368,
              "height": 35,
              "seed": 1471228619,
              "groupIds": [],
              "strokeSharpness": "sharp",
              "boundElementIds": [],
              "fontSize": 28,
              "fontFamily": 1,
              "text": "http://roam-excalidraw.com",
              "baseline": 25,
              "textAlign": "left",
              "verticalAlign": "top"
          }
      ],
      "appState": {
          "currentItemBackgroundColor": "transparent",
          "exportBackground": true,
          "exportEmbedScene": false,
          "exportWithDarkMode": false,
          "height": 750,
          "name": "Excalidraw Splash-screen",
          "scrollX": 358.85471441806885,
          "scrollY": 294.7521503155048,
          "viewBackgroundColor": "#ffffff",
          "width": 1490,
          "offsetLeft": 23,
          "offsetTop": 43.20000076293945
      }
  };