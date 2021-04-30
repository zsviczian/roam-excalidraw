  window.ExcalidrawLoader = {
    sketchingUID : ExcalidrawConfig.sketchingUID,
    excalDATAUID : ExcalidrawConfig.excalDATAUID,
    excalSVGUID  : ExcalidrawConfig.excalSVGUID,
    settingsUID  : ExcalidrawConfig.settingsUID,
    pageTitle : 'roam/excalidraw',
    mainComponentParent : 'Main Component',
    dataComponentParent : 'Data Block Component',
    svgComponentParent : 'SVG Component',
    settingsComponentParent : 'Settings', 
    defaultSetting: '{\n:mode "light"\n:img "SVG"\n:max-embed-width 600\n:max-embed-height 400\n:full-screen-margin 0.015\n}',

    async updateCodeBlock(blockUID, sourceCode) {
      await window.roamAlphaAPI.updateBlock({"block": 
                                      {"string": sourceCode,
                                        "uid": blockUID}});
    },

    async createBlockWithUID(parentUID, order, blockString, blockUID) {
      await window.roamAlphaAPI.createBlock({"location":
                                      {"parent-uid": parentUID, 
                                      "order": order}, 
                                        "block": {"string": blockString,
                                                  "uid": blockUID}});  
    },

    async createBlock(parentUID, order, blockString) {
      blockUID = window.roamAlphaAPI.util.generateUID();
      await this.createBlockWithUID (parentUID, order, blockString, blockUID);
      return blockUID;
    },

    getBlockUIDByString (pageUID, blockString) {
      q = `[:find ?uid . :where [?p :block/uid "${pageUID}"]
                              [?p :block/children ?b]
                              [?b :block/string ?s]
                              [(= ?s "${blockString}")]
                              [?b :block/uid ?uid]]`;
      return window.roamAlphaAPI.q(q);
    },

    async getORcreateBlockBYString (pageUID, order, blockString) {
      uid = this.getBlockUIDByString (pageUID, blockString);
      if (!uid)
        uid = await this.createBlock(pageUID,order, blockString);
      return uid;
    },

    blockExists(blockUID) {
      q = `[:find ?e . :where [?e :block/uid "${blockUID}"]]`;
      res = window.roamAlphaAPI.q(q);  
      return (res!=null);
    }, 

    async createBlockIfNotExists (parentUID, blockUID, blockString) {
      if(this.blockExists(blockUID))
        await this.updateCodeBlock(blockUID,blockString);
      else
        await this.createBlockWithUID (parentUID,0,blockString,blockUID);
    },

    async buildPage() {
      //check if page exists, if not, create it
      q = `[:find ?uid . :where [?e :node/title "${this.pageTitle}"][?e :block/uid ?uid]]`;
      firstEverRun = false;
      pageUID = window.roamAlphaAPI.q(q);
      if(pageUID == null) {
        pageUID = window.roamAlphaAPI.util.generateUID();
        await window.roamAlphaAPI.createPage(
          {"page": 
            {"title": this.pageTitle, 
            "uid": pageUID}});
        firstEverRun = true;                                
      }
      ExcalidrawConfig.log('cljs-loader.js','buildPage() [[roam/excalidraw]] is present?',!firstEverRun);
      
      function isParent(blockUID, parentUID) {
        q = `[:find ?uid . :where [?b :block/uid "${blockUID}"][?p :block/children ?b][?p :block/uid ?uid]]`;
        uid = window.roamAlphaAPI.q(q);
        return (uid == parentUID);
      }

      mainComponentParentUID = await this.getORcreateBlockBYString (pageUID,0,this.mainComponentParent);
      ExcalidrawConfig.log('cljs-loader.js','buildPage() mainComponentParentUID',mainComponentParentUID);
      dataComponentParentUID = await this.getORcreateBlockBYString (pageUID,1,this.dataComponentParent);
      ExcalidrawConfig.log('cljs-loader.js','buildPage() dataComponentParentUID',dataComponentParentUID);
      svgComponentParentUID  = await this.getORcreateBlockBYString (pageUID,2,this.svgComponentParent);
      ExcalidrawConfig.log('cljs-loader.js','buildPage() svgComponentParentUID',svgComponentParentUID);
      settingsComponentParentUID = await this.getORcreateBlockBYString (pageUID,3,this.settingsComponentParent);
      ExcalidrawConfig.log('cljs-loader.js','buildPage() settingsComponentParentUID',settingsComponentParentUID);

      await this.createBlockIfNotExists (mainComponentParentUID, this.sketchingUID, '');
      ExcalidrawConfig.log('cljs-loader.js','buildPage() created sketching block');
      await this.createBlockIfNotExists (dataComponentParentUID, this.excalDATAUID, '');
      ExcalidrawConfig.log('cljs-loader.js','buildPage() created data block');
      await this.createBlockIfNotExists (svgComponentParentUID, this.excalSVGUID,'');
      ExcalidrawConfig.log('cljs-loader.js','buildPage() created svg block');
      break;
      if(!this.blockExists(this.settingsUID)) {
        await this.createBlockWithUID (settingsComponentParentUID,0,this.defaultSetting,this.settingsUID);
        ExcalidrawConfig.log('cljs-loader.js','buildPage() created default settings');
      }

      if(!isParent(this.sketchingUID,this.mainComponentParent)) {
        await window.roamAlphaAPI.moveBlock({"location":
                                        {"parent-uid": mainComponentParentUID, 
                                      "order": 0}, 
                                        "block": {"uid": this.sketchingUID}});
        ExcalidrawConfig.log('cljs-loader.js','buildPage() moved sketching');
      }
      if(!isParent(this.excalDATAUID,this.dataComponentParent)) {
        await window.roamAlphaAPI.moveBlock({"location":
                                        {"parent-uid": dataComponentParentUID, 
                                      "order": 0}, 
                                        "block": {"uid": this.excalDATAUID}});
        ExcalidrawConfig.log('cljs-loader.js','buildPage() moved data');
      }
      if(!isParent(this.excalSVGUID,this.svgComponentParent)) {                            
        await window.roamAlphaAPI.moveBlock({"location":
                                        {"parent-uid": svgComponentParentUID, 
                                      "order": 0}, 
                                        "block": {"uid": this.excalSVGUID}});
        ExcalidrawConfig.log('cljs-loader.js','buildPage() moved svg');
      }                                   
      
      await window.roamAlphaAPI.updateBlock({"block": {"uid": mainComponentParentUID,
                                                "open": false}});
      await window.roamAlphaAPI.updateBlock({"block": {"uid": dataComponentParentUID,
                                                "open": false}});
      await window.roamAlphaAPI.updateBlock({"block": {"uid": svgComponentParentUID,
      "open": false}});

      
      //create template
      if (firstEverRun) {
        roamTemplatesUID = window.roamAlphaAPI.q('[:find ?uid . :where [?p :node/title "roam/templates"][?p :block/uid ?uid]]');
        if (roamTemplatesUID == null) {
          ExcalidrawConfig.log('cljs-loader.js','[[roam/templates]] did not exist. Creating it...');
          roamTemplatesUID = window.roamAlphaAPI.util.generateUID();
          await window.roamAlphaAPI.createPage( 
            {"page": 
              {"uid": roamTemplatesUID,
                "title": "roam/templates"}});
        }
        templateUID = window.roamAlphaAPI.util.generateUID();
        await window.roamAlphaAPI.createBlock( 
          {"location": 
            {"parent-uid": roamTemplatesUID,
              "order": 1000},
          "block": 
            {"string": "Excalidraw",
              "uid": templateUID}});
        await window.roamAlphaAPI.createBlock(
          {"location":
            {"parent-uid": templateUID,
              "order": 0},
          "block": {"string": "{{roam/render: ((sketching))}}"}});
      }
    }
  }

  async function loadExcalidrawCljs() {
    ExcalidrawConfig.log('cljs-loader.js','loadExcalidrawCljs()','Enter');
    ExcalidrawLoader.buildPage();
    tripple_accent = String.fromCharCode(96,96,96);
    ExcalidrawConfig.log('cljs-loader.js','loadExcalidrawCljs()','updateCodeBlock');
    
    //update main-component
    await ExcalidrawLoader.updateCodeBlock(ExcalidrawLoader.sketchingUID,tripple_accent + 
                    'clojure\n' + 
                    ExcalidrawConfig.mainComponent +
                    tripple_accent);
    delete ExcalidrawConfig.mainComponent;

    //update data-component
    await ExcalidrawLoader.updateCodeBlock(ExcalidrawLoader.excalDATAUID,tripple_accent + 
                    'clojure\n' + 
                    ExcalidrawConfig.dataComponent +
                    tripple_accent);
    delete ExcalidrawConfig.dataComponent;

    //update svg-component
    await ExcalidrawLoader.updateCodeBlock(ExcalidrawLoader.excalSVGUID,tripple_accent + 
                                      'clojure\n' + 
                                      ExcalidrawConfig.svgComponent +
                                      tripple_accent);
    delete ExcalidrawConfig.svgComponent;

  }

  loadExcalidrawCljs();
  ExcalidrawConfig.log('cljs-loader.js','terminating temporary objects');
  
  loadExcalidrawCljs = undefined;
  ExcalidrawLoader = undefined;
  delete ExcalidrawConfig.sketchingUID;
  delete ExcalidrawConfig.excalDATAUID;
  delete ExcalidrawConfig.settingsUID;
