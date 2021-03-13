window.ExcalidrawLoader = {
  sketchingUID : ExcalidrawConfig.sketchingUID,
  excalDATAUID : ExcalidrawConfig.excalDATAUID,
  pageTitle : 'roam/excalidraw',
  mainComponentParent : "Main Component",
  dataComponentParent : "Data Block Component",

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
    const blockUID = window.roamAlphaAPI.util.generateUID();
    this.createBlockWithUID (parentUID, order, blockString, blockUID);
    return blockUID;
  },

  getBlockUIDByStringANDOrder (pageUID, order, blockString) {
    const q = `[:find ?uid . :where [?p :block/uid "${pageUID}"]
                            [?p :block/children ?b]
                            [?b :block/order ${order}]
                            [?b :block/string ?s]
                            [(= ?s "${blockString}")]
                            [?b :block/uid ?uid]]`;
    return window.roamAlphaAPI.q(q);
  },

  getORcreateBlockBYString (pageUID, order, blockString) {
    let uid = this.getBlockUIDByStringANDOrder (pageUID, order, blockString);
    if (uid == null)
      uid = this.createBlock(pageUID,order, blockString);
    return uid;
  },

  blockExists(blockUID) {
    const q = `[:find ?e . :where [?e :block/uid "${blockUID}"]]`;
    const res = window.roamAlphaAPI.q(q);  
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
    let q= `[:find ?uid . :where [?e :node/title "${this.pageTitle}"][?e :block/uid ?uid]]`;
    let pageUID = window.roamAlphaAPI.q(q);
    if(pageUID == null) {
      pageUID = window.roamAlphaAPI.util.generateUID();
      window.roamAlphaAPI.createPage({"page": 
                                            {"title": this.pageTitle, 
                                            "uid": pageUID}});
    }
    
    function isParent(blockUID, parentUID) {
      const q = `[:find ?uid . :where [?b :block/uid "${blockUID}"][?p :block/children ?b][?p :block/uid ?uid]]`;
      const uid = window.roamAlphaAPI.q(q);
      return (uid == parentUID);
    }

    const mainComponentParentUID = this.getORcreateBlockBYString (pageUID,0,this.mainComponentParent);
    const dataComponentParentUID = this.getORcreateBlockBYString (pageUID,1,this.dataComponentParent);
    this.createBlockIfNotExists (mainComponentParentUID, this.sketchingUID, '');
    this.createBlockIfNotExists (dataComponentParentUID, this.excalDATAUID, '');

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
  }
}

function loadExcalidrawCljs() {
  ExcalidrawLoader.buildPage();
  const tripple_accent = String.fromCharCode(96,96,96);
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