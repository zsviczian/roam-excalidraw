const sketchingUID  = 'sketching';
const excalDATAUID = 'ExcalDATA';
const pageTitle = 'roam/excalidraw';
const mainComponentParent = "Main Component";
const dataComponentParent = "Data Block Component";

function getClojureNS(blockUID) {
  const q = `[:find ?s . :where [?e :block/uid "${blockUID}"][?e :block/string ?s]]`;
  const renderString = window.roamAlphaAPI.q(q);
  if(renderString != null) { 
    ptrn = /\(ns (.*)\s/g;
    const res = ptrn.exec(renderString);
    if(res == null) return '';
    return res[1];
  }
  return '';
}

function updateCodeBlock(blockUID, sourceCode) {
  window.roamAlphaAPI.updateBlock({"block": 
                                   {"string": sourceCode,
                                    "uid": blockUID}});
}

function createBlockWithUID(parentUID, order, blockString, blockUID) {
  window.roamAlphaAPI.createBlock({"location":
                                   {"parent-uid": parentUID, 
	                                "order": order}, 
                                    "block": {"string": blockString,
                                              "uid": blockUID}});  
}

function createBlock(parentUID, order, blockString) {
  const blockUID = window.roamAlphaAPI.util.generateUID();
  createBlockWithUID (parentUID, order, blockString, blockUID);
  return blockUID;
}

function getBlockUIDByStringANDOrder (pageUID, order, blockString) {
  const q = `[:find ?uid . :where [?p :block/uid "${pageUID}"]
                           [?p :block/children ?b]
                           [?b :block/order ${order}]
                           [?b :block/string ?s]
                           [(= ?s "${blockString}")]
                           [?b :block/uid ?uid]]`;
  return window.roamAlphaAPI.q(q);
}

function getORcreateBlockBYString (pageUID, order, blockString) {
  let uid = getBlockUIDByStringANDOrder (pageUID, order, blockString);
  if (uid == null)
    uid = createBlock(pageUID,order, blockString);
  return uid;
}

function blockExists(blockUID) {
  const q = `[:find ?e . :where [?e :block/uid "${blockUID}"]]`;
  const res = window.roamAlphaAPI.q(q);  
  return (res!=null);
} 

function createBlockIfNotExists (parentUID, blockUID, blockString) {
  if(blockExists(blockUID))
    updateCodeBlock(blockUID,blockString);
  else
    createBlockWithUID (parentUID,0,blockString,blockUID);
}

function buildPage() {
  //check if page exists, if not, create it
  let q= `[:find ?uid . :where [?e :node/title "${pageTitle}"][?e :block/uid ?uid]]`;
  let pageUID = window.roamAlphaAPI.q(q);
  if(pageUID == null) {
    pageUID = window.roamAlphaAPI.util.generateUID();
    window.roamAlphaAPI.createPage({"page": 
                                          {"title": pageTitle, 
                                           "uid": pageUID}});
  }
  
  const mainComponentParentUID = getORcreateBlockBYString (pageUID,0,mainComponentParent);
  const dataComponentParentUID = getORcreateBlockBYString (pageUID,1,dataComponentParent);
  createBlockIfNotExists (mainComponentParentUID, sketchingUID, '');
  createBlockIfNotExists (dataComponentParentUID, excalDATAUID, '');
  window.roamAlphaAPI.moveBlock({"location":
                                  {"parent-uid": mainComponentParentUID, 
	                               "order": 0}, 
                                   "block": {"uid": sketchingUID}});
  window.roamAlphaAPI.moveBlock({"location":
                                  {"parent-uid": dataComponentParentUID, 
	                               "order": 0}, 
                                   "block": {"uid": excalDATAUID}});  
}

if (getClojureNS(sketchingUID) != ExcalidrawConfig.cljCodeVersion) {
  buildPage();

  updateCodeBlock(sketchingUID,tripple_accent + 
                  'clojure\n' + 
                  ExcalidrawConfig.mainComponent +
                  tripple_accent);
  ExcalidrawConfig.mainComponent = null;

  updateCodeBlock(excalDATAUID,tripple_accent + 
                  'clojure\n' + 
                  ExcalidrawConfig.dataComponent +
                  tripple_accent);
  ExcalidrawConfig.dataComponent = null;
}