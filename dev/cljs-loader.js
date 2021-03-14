window.ExcalidrawLoader = {
  sketchingUID : ExcalidrawConfig.sketchingUID,
  excalDATAUID : ExcalidrawConfig.excalDATAUID,
  settingsUID  : ExcalidrawConfig.settingsUID,
  pageTitle : 'roam/excalidraw',
  mainComponentParent : 'Main Component',
  dataComponentParent : 'Data Block Component',
  settingsComponentParent : 'Settings', 
  defaultSetting: '{:mode "light", :img "SVG"}',

  updateCodeBlock(blockUID, sourceCode) {
    window.roamAlphaAPI.updateBlock({"block": 
                                    {"string": sourceCode,
                                      "uid": blockUID}});
  },

  createBlockWithUID(parentUID, order, blockString, blockUID) {
    window.roamAlphaAPI.createBlock({"location":
                                    {"parent-uid": parentUID, 
                                    "order": order}, 
                                      "block": {"string": blockString,
                                                "uid": blockUID}});  
  },

  createBlock(parentUID, order, blockString) {
    blockUID = window.roamAlphaAPI.util.generateUID();
    this.createBlockWithUID (parentUID, order, blockString, blockUID);
    return blockUID;
  },

  getBlockUIDByStringANDOrder (pageUID, order, blockString) {
    q = `[:find ?uid . :where [?p :block/uid "${pageUID}"]
                            [?p :block/children ?b]
                            [?b :block/order ${order}]
                            [?b :block/string ?s]
                            [(= ?s "${blockString}")]
                            [?b :block/uid ?uid]]`;
    return window.roamAlphaAPI.q(q);
  },

  getORcreateBlockBYString (pageUID, order, blockString) {
    uid = this.getBlockUIDByStringANDOrder (pageUID, order, blockString);
    if (uid == null)
      uid = this.createBlock(pageUID,order, blockString);
    return uid;
  },

  blockExists(blockUID) {
    q = `[:find ?e . :where [?e :block/uid "${blockUID}"]]`;
    res = window.roamAlphaAPI.q(q);  
    return (res!=null);
  }, 

  createBlockIfNotExists (parentUID, blockUID, blockString) {
    if(this.blockExists(blockUID))
      this.updateCodeBlock(blockUID,blockString);
    else
      this.createBlockWithUID (parentUID,0,blockString,blockUID);
  },

  buildPage() {
    //check if page exists, if not, create it
    q = `[:find ?uid . :where [?e :node/title "${this.pageTitle}"][?e :block/uid ?uid]]`;
    firstEverRun = false;
    pageUID = window.roamAlphaAPI.q(q);
    if(pageUID == null) {
      pageUID = window.roamAlphaAPI.util.generateUID();
      window.roamAlphaAPI.createPage({"page": 
                                            {"title": this.pageTitle, 
                                            "uid": pageUID}});
      firstEverRun = true;                                
    }
    
    function isParent(blockUID, parentUID) {
      q = `[:find ?uid . :where [?b :block/uid "${blockUID}"][?p :block/children ?b][?p :block/uid ?uid]]`;
      uid = window.roamAlphaAPI.q(q);
      return (uid == parentUID);
    }

    mainComponentParentUID = this.getORcreateBlockBYString (pageUID,0,this.mainComponentParent);
    dataComponentParentUID = this.getORcreateBlockBYString (pageUID,1,this.dataComponentParent);
    settingsComponentParentUID = this.getORcreateBlockBYString (pageUID,2,this.settingsComponentParent);

    this.createBlockIfNotExists (mainComponentParentUID, this.sketchingUID, '');
    this.createBlockIfNotExists (dataComponentParentUID, this.excalDATAUID, '');
    if(!this.blockExists(this.settingsUID))
      this.createBlockWithUID (settingsComponentParentUID,0,this.defaultSetting,this.settingsUID);

    if(!isParent(this.sketchingUID,this.mainComponentParent))
      window.roamAlphaAPI.moveBlock({"location":
                                      {"parent-uid": mainComponentParentUID, 
                                    "order": 0}, 
                                      "block": {"uid": this.sketchingUID}});
    if(!isParent(this.excalDATAUID,this.dataComponentParent))                                    
      window.roamAlphaAPI.moveBlock({"location":
                                      {"parent-uid": dataComponentParentUID, 
                                    "order": 0}, 
                                      "block": {"uid": this.excalDATAUID}});
    
    window.roamAlphaAPI.updateBlock({"block": {"uid": mainComponentParentUID,
                                               "open": false}});
    window.roamAlphaAPI.updateBlock({"block": {"uid": dataComponentParentUID,
                                               "open": false}});
    
    //create template
    if (firstEverRun) {
      templateUID = window.roamAlphaAPI.util.generateUID();
      window.roamAlphaAPI.createBlock( 
        {"location": 
           {"parent-uid": window.roamAlphaAPI.q('[:find ?uid . :where [?p :node/title "roam/templates"][?p :block/uid ?uid]]'),
            "order": 1000},
         "block": 
           {"string": "Excalidraw",
            "uid": templateUID}});
      window.roamAlphaAPI.createBlock(
        {"location":
           {"parent-uid": templateUID,
            "order": 0},
         "block": {"string": "{{roam/render: ((sketching))}}"}});
    }
  }
}

function loadExcalidrawCljs() {
  ExcalidrawLoader.buildPage();
  tripple_accent = String.fromCharCode(96,96,96);
  ExcalidrawLoader.updateCodeBlock(ExcalidrawLoader.sketchingUID,tripple_accent + 
                  'clojure\n' + 
                  ExcalidrawConfig.mainComponent +
                  tripple_accent);
  delete ExcalidrawConfig.mainComponent;

  ExcalidrawLoader.updateCodeBlock(ExcalidrawLoader.excalDATAUID,tripple_accent + 
                  'clojure\n' + 
                  ExcalidrawConfig.dataComponent +
                  tripple_accent);
  delete ExcalidrawConfig.dataComponent;
}

loadExcalidrawCljs();
loadExcalidrawCljs = undefined;
ExcalidrawLoader = undefined;
delete ExcalidrawConfig.sketchingUID;
delete ExcalidrawConfig.excalDATAUID;
delete ExcalidrawConfig.settingsUID;