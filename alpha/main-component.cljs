(ns excalidraw.app.alpha.v30
  (:require 
   [clojure.set :as s]
   [reagent.core :as r]
   [roam.datascript :as rd]
   [roam.block :as block]
   [clojure.string :as str]
   [clojure.edn :as edn]
   [roam.util :as util]
   [roam.datascript.reactive :as dr]
   [clojure.pprint :as pp]))

(def plugin-version 1)
(def app-page "roam/excalidraw")
(def app-settings-block "Settings")
(def app-setting-uid "Excal_SET")
(def default-app-settings {:mode "light"
                           :img  "SVG"
                           :full-screen-margin 0.015
                           :max-embed-width 600
                           :max-embed-height 400
                           :nested-text-rows 20
                           :nested-text-row-height 40
                           :nested-text-col-width 400
                           :nested-text-start-top 40
                           :nested-text-start-left 320
                           :nested-text-font-size 20
                           :nested-text-font-family 1})
(def app-settings (r/atom default-app-settings))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; util functions
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
(def silent (r/atom false))
(defn debug [x]
  (if-not @silent (apply (.-log js/console) "<<< Roam-Excalidraw Main cljs >>>" x)))

(def embedded-view "ev")
(def full-screen-view "fs")
(defn is-full-screen [cs]  ;;component-state
  (not= (:position @cs) embedded-view))

(defn create-block [parent-uid order block-string]
  (.createBlock js/window.ExcalidrawWrapper parent-uid order block-string))

(defn block-update [x]
  (.updateBlock js/window.ExcalidrawWrapper x))

(defn pretty-settings [x]
  (let [y (into (sorted-map) (sort-by first (seq x)))]
    (-> (str y)
          (str/replace "{" "{\n")
          (str/replace ", " "\n")
          (str/replace "}" "\n}"))))

(defn get-next-block-order [x]
  (let [o (rd/q '[:find (max ?o) . 
                  :in $ ?uid
                  :where [?b :block/uid ?uid]
                         [?b :block/children ?c]
                         [?c :block/order ?o]]
                x)]
    (if (nil? o) 0 (+ 1 o))
))

(defn save-settings []
  ;;(debug ["(save-settings) Enter"])
  (let [settings-host (r/atom (rd/q '[:find ?uid .
                                     :in $ ?page ?block
                                     :where [?p :node/title ?page]
                                            [?p :block/children ?b]
                                            [?b :block/string ?block]
                                            [?b :block/uid ?uid]]
                                    app-page app-settings-block))]
    (if (nil? @settings-host)
      (do 
        ;;(debug ["(save-settings) settings host does not exist"])
        (reset! settings-host
          (create-block 
            (rd/q '[:find ?uid . 
                    :in $ ?page
                    :where [?p :node/title ?page]
                           [?p :block/uid ?uid]]
                  app-page)
            3 app-settings-block))))
    (let [settings-block (r/atom (rd/q '[:find ?uid .
                                         :in $ ?settings-host
                                         :where [?b :block/uid ?settings-host]
                                                [?b :block/children ?c]
                                                [?c :block/order 0]
                                                [?c :block/uid ?uid]]
                                        @settings-host))]
      (if (nil? @settings-block)
        (do 
          ;;(debug ["(save-settings) settings-block does not exist"])
          (create-block @settings-host 0 (pretty-settings @app-settings)))
        (do 
          ;;(debug ["(save-settings) settings-block exists, updating"])
          (block-update {:block {:uid @settings-block 
                                 :string (pretty-settings @app-settings)}}))))))

(defn js-to-clj-str [& x]
  ;;(debug ["(js-to-clj-str): x: " x (str x)])
  (let [res (-> x
              (str)
              (str/replace #"\(#js"  "")
              (str/replace #"#js" "")
              (str/replace #"\}\}\)" "}}"))]
    res))

(defn fix-double-bracket [x]
  (str/replace x #"\[{2}" "[ ["))

(defn get-data-block-uid [x]
  (rd/q '[:find ?drawing-uid .
          :in $ ?uid
          :where [?e :block/uid ?uid]
                  [?e :block/children ?c]
                  [?c :block/order 0]
                  [?c :block/string ?s]
                  [(clojure.string/includes? ?s "((ExcalDATA))")]
                  [?c :block/uid ?drawing-uid]]
        x))

(defn pull-children [block-uid order]
  (rd/q '[:find (pull ?b [:block/uid :block/string {:block/children [:block/string :block/order :block/uid {:block/children ...}]}])
                                         :in $ ?block-uid ?order
                                         :where [?e :block/uid ?block-uid]
                                                [?e :block/children ?b]
                                                [?b :block/order ?order]]
			                             block-uid order))

(defn flatten-nested-text [nested-text level] 
  (let [result (atom nil)]
    (doseq [y nested-text]
      (let [order (str/join [level (pp/cl-format nil "~2,'0d" (:block/order y))])]
        (reset! result (conj @result {:block/string (:block/string y)
                                       :block/order order
                                       :block/uid (:block/uid y)}))
        (if-not (nil? (:block/children y)) 
          (reset! result (concat @result (flatten-nested-text (:block/children y) order))))
    ))   
    ;;(debug ["flat-nest " (str @result)])
     (into [] (sort-by :block/order @result))
))

(defn get-text-blocks [x]
  (-> x
    (pull-children 1)
    (first)
    (get-in [0 :block/children])
    (flatten-nested-text "")))

(defn get-text-elements [x]
  (filter (comp #{"text"} :type) x)
)

(defn get-block-uid-from-text-element [x]
  (second (re-find #"ROAM_(.*)_ROAM" (:id x)))
)

;;updates the :elements value of the drawing with nested text and updated object groups
(defn update-elements-with-parts [x] {:raw-elements [] :text-elements [] :groups []}
  (into [] (concat (into [] (remove (comp #{"text"} :type) (:raw-elements x)))  (:text-elements x)))
)

;;{:block-uid "BlockUID" :map-string "String" :cs atom :drawing atom}
(defn save-component [x] 
  ;;Disable the pullWatch while blocks are edited
  (reset! (:saving-flag x) true) 
  ;;(debug ["(save-component) Enter"])

  (let [data-block-uid (get-data-block-uid (:block-uid x))
        edn-map (edn/read-string (:map-string x))
        text-elements (r/atom nil)
        ;;get text blocks nested under title
        nestedtext-parent-block-uid (get-in @(:drawing x) [:nestedtext-parent :block-uid])
        nested-text-blocks (get-text-blocks (:block-uid x)) 
        app-state (into {} (filter (comp some? val) (:appState edn-map)))] ;;remove nil elements from appState
    
    ;;process text on drawing
    ;;(debug ["(save-component) start processing text"])
    (doseq [y (get-text-elements (:elements edn-map))]
      (if (:isDeleted y)
        (if (str/starts-with? (:id y) "ROAM_")
          (block/delete {:block {:uid (get-block-uid-from-text-element y)}})
        )
        (if (str/starts-with? (:id y) "ROAM_")
          (do ;;block with text should already exist, update text, but double check that the block is there...
            ;;(debug ["(save-component) nested block should exist text:" (:text y) "block-id" (get-block-uid-from-text-element y)])
            (let [text-block-uid (get-block-uid-from-text-element y)
                  nested-block (filter (comp #{text-block-uid} :block/uid) nested-text-blocks)]
              (if-not (= 0 (count nested-block))
                (do ;;block exists
                  ;;(debug ["(save-component) block exists, updateing"])
                  (if-not (= (:block/string (first nested-block)) (:text y))
                    (block-update {:block {:uid text-block-uid :string (:text y)}}))
                  (reset! text-elements (conj @text-elements y))
                )
                (do ;block no-longer exists, create new one
                  ;;(debug ["(save-component) block should, but does not exist, creating..."])
                  (let [new-block-uid (.createBlock js/ExcalidrawWrapper nestedtext-parent-block-uid (get-next-block-order nestedtext-parent-block-uid) (:text y))]
                    (reset! text-elements (conj @text-elements (assoc-in y [:id] (str/join ["ROAM_" new-block-uid "_ROAM"]))))
          )))))
          (do ;;block with text does not exist as nested block, create new
            ;;(debug ["(save-component) block does not exists, creating"])
            (let [new-block-uid (.createBlock js/ExcalidrawWrapper nestedtext-parent-block-uid (get-next-block-order nestedtext-parent-block-uid) (:text y))]
              (reset! text-elements (conj @text-elements (assoc-in y [:id] (str/join ["ROAM_" new-block-uid "_ROAM"])))) 
              (reset! text-elements (conj @text-elements (assoc-in y [:isDeleted] true))) 
              )))))

    ;;(debug ["(save-component) text-blocks with updated IDs" (str @text-elements)])
    ;;updating the data block is the final piece in saving the component
    (let [elements (update-elements-with-parts {:raw-elements (:elements edn-map) :text-elements @text-elements})  
          out-string (fix-double-bracket (str {:elements elements :appState app-state :roamExcalidraw {:version plugin-version}}))
          render-string (str/join ["{{roam/render: ((ExcalDATA)) " out-string " }}"])]
      (block-update
        {:block {:uid data-block-uid
                :string render-string}}) 
      (swap! app-settings assoc-in [:mode] (get-in app-state [:theme]))
      (save-settings)
      (reset! (:saving-flag x) false)
      {:elements elements :appState app-state :roamExcalidraw {:version plugin-version}}                                      
)))

(defn load-settings []
  ;;(debug ["(load-settings) Enter"])
  (let [settings-block (rd/q '[:find ?settings .
                              :in $ ?page ?block
                              :where [?p :node/title ?page]
                                     [?p :block/children ?b]
                                     [?b :block/string ?block]
                                     [?b :block/children ?c]
                                     [?c :block/order 0]
                                     [?c :block/string ?settings]]
                            app-page app-settings-block)]
    (if-not (nil? settings-block)
      (do 
        ;;(debug ["(load-settings) settings: " settings-block])
        (reset! app-settings (edn/read-string settings-block))
        (if (nil? @app-settings)
          (reset! app-settings default-app-settings))
        (doseq [key (keys default-app-settings)]
          (if (nil? (key @app-settings))
            (swap! app-settings assoc-in [key] (key default-app-settings))))))))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Load data from nested block(s)
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

;;finds the json enclosed in double parentheses and returns it
(defn get-data-from-block-string [x]
  ;;(debug ["(get-data-from-block-string)" (count x)])
  (if (= (count x) 0)
    (do 
      ;;(debug ["(get-data-from-block-string) returning nil"])
      nil)
    (do
      (let [data-string (get-in (first x) [0 :block/string])
            return-string (second (re-find #"ExcalDATA\){2}\s*(\{.*\})\s*\}{2}" data-string))]
        ;;;(debug ["(get-data-from-block-string) returning: " retrun-string])
        (edn/read-string return-string)))))

(defn create-nested-blocks [x]; {:block-uid "BlockUID" :drawing atom :empty-block-uid "BlockUID"}
;;block uid is the block of the roam/render component
;;empty block is the block created by the user by trying to nest text under 
;;a new drawing that hasn't been edited yet (i.e. the data and title children
;;are missing)
  ;;(debug ["(create-nested-blocks)"])
  (let [default-data {:appState {:theme (:mode @app-settings)}
                      :roamExcalidraw {:version 1}}]
    (create-block (:block-uid x) 0 (str/join ["{{roam/render: ((ExcalDATA)) "
                                (str default-data) " }}"]))
    (reset! (:drawing x) {:drawing default-data 
                          :nestedtext-parent {:block-uid (create-block (:block-uid x) 1 "**Text nested here will appear on your drawing:**")}})
                                                              
    (if (nil? (:empty-block-uid x)) 
      (block-update {:block {:uid (:block-uid x) :open false}}) ;;fold up the drawing block to hide children
      (block/move {:location {:parent-uid (get-in @(:drawing x) [:nestedtext-parent :block-uid]) ;;move new block under nested text
                            :order 0}
                 :block {:uid (:empty-block-uid x)}}))
))



(defn load-drawing [x] ;{:block-uid "BlockUID" :drawing atom :data objects :text "text"} 
;drawing is the atom holding the drawing map
;block uid is the block with the roam/render component
;data are the drawing objects
;text are the nested text blocks
  ;;(debug ["(load-drawing) enter"])
  (if (= (count (:data x)) 0)
      (do
        ;;(debug ["(load-drawing) no children - creating dummy data"])
        (let [default-data {:appState {:theme (:mode @app-settings)}
                            :roamExcalidraw {:version 1}}]
          (reset! (:drawing x) {:drawing default-data 
                                :nestedtext-parent {:block-uid nil}})
      ))
      (if (= (count (:text x)) 0)
        (do
          ;;(debug ["(load-drawing) create title only"])
          (reset! (:drawing x) {:drawing (:data x)
                                :nestedtext-parent {:block-uid (create-block (:block-uid x) 1 "**Text nested here will appear on your drawing:**")}})
          (block-update {:block {:uid (:block-uid x) :open false}})
        )
        (do
          ;;(debug ["(load-drawing) ExcalDATA & title already exist"])
          (reset! (:drawing x) {:drawing (:data x)
                                :nestedtext-parent {:block-uid  (get-in (:text x) [0 :block/uid])}
                                :text (get-in (:text x) [0 :block/children])})
  )))
  ;;(debug ["(load-drawing) drawing: " @(:drawing x) " data: " (:data x) " text: " (str (:text x)) "theme " (get-in (:data x) [:appState :theme])])
)

;;check if text in nested block has changed compared to drawing and updated text in drawing element including size
(defn update-drawing-based-on-nested-blocks [x] ;{:elements [] :appState {} :nested-text [:block/uid "BlockUID" :block/string "text"]}
  ;;(debug ["(update-drawing-based-on-nested-blocks) Enter x:" x])
  (if-not (nil? (:nested-text x)) 
    (do
      (let [text-elements (r/atom nil)
            nested-text (flatten-nested-text (:nested-text x) "")]   
      ;;(debug ["(update-drawing-based-on-nested-blocks) processing nested text - apply changes to existing text elements, omit deleted ones"])
        ;;update elements on drawing based on changes to nested text
        (doseq [y (get-text-elements (:elements x))]
          (let [block-uid (get-block-uid-from-text-element y)
                block-text (:block/string (first (filter (comp #{block-uid} :block/uid) nested-text)))
                text-element-has-nested-block-pair (= 0 (count (filter (comp #{block-uid} :block/uid) nested-text)))]
            ;;add text to drawing if text element has a nested block pair, 
            (if (not text-element-has-nested-block-pair)  
              (do
                ;if text has changed, update measures
                (if-not (= block-text (:text y)) 
                  (let [text-measures (js->clj (.measureText js/ExcalidrawWrapper block-text y))]
                    (reset! text-elements 
                              (conj @text-elements 
                                      (-> y 
                                        (assoc-in [:text] block-text)
                                        (assoc-in [:baseline] (get text-measures "baseline"))
                                        (assoc-in [:width] (get text-measures "width"))
                                        (assoc-in [:height] (get text-measures "height"))
                    ))))
                  ;;else add to list as-is 
                  (reset! text-elements (conj @text-elements y))))
              ;;else it should be removed from the drawing
              ;;unless the drawing is from an old version of the plugin when nested blocks weren't handled
              (if (< (get-in x [:roamExcalidraw :version]) 1) 
                (reset! text-elements (conj @text-elements y)))
        )))
        
        ;;(debug ["(update-drawing-based-on-nested-blocks) processing nested text - add new nested blocks"])
        ;;add text for newly nested blocks
        (let [counter (atom -1)]
          (doseq [nt nested-text]
            (swap! counter inc)
            (let [text (:block/string nt)
                  dummy {:fontFamily (:nested-text-font-family @app-settings) 
                        :fontSize (:nested-text-font-size @app-settings)}
                  order (:block/order nt)
                  id (:block/uid nt)]
              (if (= 0 (count (filter (comp #{(str/join ["ROAM_" (:block/uid nt) "_ROAM"])} :id) @text-elements)))
                (let [col (int (/ @counter (:nested-text-rows @app-settings)))
                      row (mod @counter (:nested-text-rows @app-settings))
                      x (+ (:nested-text-start-left @app-settings) (* col (:nested-text-col-width @app-settings)))
                      y (+ (:nested-text-start-top @app-settings) (* row (:nested-text-row-height @app-settings)))  
                      text-measures (js->clj (.measureText js/ExcalidrawWrapper text dummy))]
                  ;;(debug ["(update-drawing-based-on-nested-blocks) add new: text" text "id" id])
                  (reset! text-elements 
                            (conj @text-elements 
                                  {:y y
                                    :baseline (get text-measures "baseline")
                                    :isDeleted false
                                    :strokeStyle "solid":roughness 1
                                    :width (get text-measures "width")
                                    :type "text"
                                    :strokeSharpness "sharp"
                                    :fillStyle "hachure"
                                    :angle 0
                                    :groupIds []
                                    :seed 1
                                    :fontFamily (:nested-text-font-family @app-settings)
                                    :boundElementIds []
                                    :strokeWidth 1
                                    :opacity 100
                                    :id (str/join ["ROAM_" id "_ROAM"])
                                    :verticalAlign "top"
                                    :strokeColor "#000000"
                                    :textAlign "left"
                                    :x (+ x (* 5 (count order)))
                                    :fontSize (:nested-text-font-size @app-settings)
                                    :version 1
                                    :backgroundColor "transparent"
                                    :versionNonce 1
                                    :height (get text-measures "height")
                                    :text text}))                                
          )))))


        {:elements (update-elements-with-parts {:raw-elements (:elements x) :text-elements @text-elements})
        :appState (:appState x)}
    ))
    {:elements (:elements x) :appState (:appState x)}
))

(defn generate-scene [x] ;{:drawing atom}]
  ;;(debug ["(generate-scene) enter" x])
  (update-drawing-based-on-nested-blocks {:elements (:elements (:drawing @(:drawing x)))
                                                      :appState (:appState (:drawing @(:drawing x)))
                                                      :nested-text (:text @(:drawing x))
                                                      :roamExcalidraw (:roamExcalidraw (:drawing @(:drawing x)))}))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Main Function Form-3
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
(defn resize [ew]
  ;;(debug ["(resize)"])
  (if-not (nil? @ew) (.onResize @ew)))

(defn update-scene [ew scene]
  ;;(debug ["(update-scene) scene: " scene])
  (if-not (nil? @ew) (.updateScene @ew scene)))

(defn get-drawing [ew]
  ;;(debug ["(get-drawing): " (.getDrawing js/window.ExcalidrawWrapper @ew)])
  (.getDrawing js/window.ExcalidrawWrapper @ew))

(defn host-div-style [cs]
  (let [width    (.-innerWidth js/window)
        height   (.-innerHeight js/window)
        top      (int (* height (:full-screen-margin @app-settings)))
        left     (int (* width (:full-screen-margin @app-settings)))
        host-div-width (if (nil? (:this-dom-node @cs)) (:max-embed-width @app-settings)
                         (.getHostDIVWidth js/ExcalidrawWrapper (:this-dom-node @cs)))
        embed-width (if (> host-div-width (:max-embed-width @app-settings)) 
                      (:max-embed-width @app-settings) host-div-width)
        embed-height (* (:max-embed-height @app-settings) (/ embed-width (:max-embed-width @app-settings)))
        ar (:aspect-ratio @cs)
        w (if (nil? ar) embed-width 
            (if (> ar 1.0) embed-width
              (* ar embed-height)))
        h (if (nil? ar @cs) "100%" 
            (if (> ar 1.0) "100%" 
              embed-height  ))]
    (if (is-full-screen cs)
      {:position "fixed"
      :z-index 1000
      :top top
      :left left
      :width  (str/join ["calc(100% - " (* left 2) "px)"]) 
      :height (- height (* top 2))
      :resize "none"}
      {:position "relative"
      :width w
      :height h
      :resize "both"
      :overflow "hidden"}
)))

(defn going-full-screen? [x cs style]
  (if (= x true)
    (do
      (load-settings)
      (.fullScreenKeyboardEventRedirect js/window.ExcalidrawWrapper true)
      (swap! cs assoc-in [:position] full-screen-view)
      (swap! style assoc-in [:host-div] (host-div-style cs))
      (swap! cs assoc-in [:mouseover] false))
    (do
      (.fullScreenKeyboardEventRedirect js/window.ExcalidrawWrapper false)
      (swap! cs assoc-in [:position] embedded-view)
      (swap! style assoc-in [:host-div] (host-div-style cs)))))


;;state to capture when callback confirms React libraries have loaded
(def deps-available (r/atom false))

(defn check-js-dependencies []
  (if (and 
       (not= (str (type js/Excalidraw)) "")
       (not= (str (type js/ReactDOM)) "")
       (not= (str (type js/React)) "")
       (not= (str (type js/ExcalidrawConfig)) "")
       (not= (str (type js/ExcalidrawWrapper)) ""))
    (do (reset! silent (not (.-DEBUG js/ExcalidrawConfig)))
      (reset! deps-available true))
    (js/setTimeout check-js-dependencies 1000)
  ))
                                  
(defn get-embed-image [drawing dom-node app-name]
  (if (= (:img @app-settings) "PNG")
    (.getPNG js/window.ExcalidrawWrapper drawing dom-node app-name)
    (.getSVG js/window.ExcalidrawWrapper drawing dom-node app-name)
  ))

(defn main [{:keys [block-uid]} & args]
  ;;(debug ["(main) component starting..."])
  (check-js-dependencies)
  (let [drawing (r/atom nil)
        cs (r/atom {:position embedded-view  ;;component-state
                    :this-dom-node nil
                    :aspect-ratio nil
                    :mouseover false
                    :prev-empty-block nil}) ;; this is a semaphore system to avoid creating double nested blocks when manually creating the first nested element
        saving-flag (atom false)
        pull-watch-active (atom false)
        ew (r/atom nil) ;;excalidraw-wrapper
        app-name (str/join ["excalidraw-app-" block-uid])
        style (r/atom {:host-div (host-div-style cs)})
        resize-handler (fn [] (if (is-full-screen cs) 
                                (swap! style assoc-in [:host-div] (host-div-style cs))  
                                (if-not (nil? (:this-dom-node @cs)) 
                                  (swap! style assoc-in [:host-div] (host-div-style cs)))))
        ;changed-drawing (atom nil)
        drawing-on-change-callback (fn [x] (if-not @saving-flag
                                             (.updateScene 
                                              @ew 
                                              (save-component 
                                               {:block-uid block-uid 
                                                :map-string (js-to-clj-str x) 
                                                :cs cs
                                                :drawing drawing
                                                :saving-flag saving-flag}))))
        pull-watch-callback (fn [before after]
                              ;;(debug ["(pull-watch-callback) after:" (js-to-clj-str after)])
                              (if-not (or @saving-flag (is-full-screen cs) @pull-watch-active)
                                (do 
                                  (reset! pull-watch-active true)
                                  (let [drawing-data (pull-children block-uid 0)
                                        drawing-text (pull-children block-uid 1)
                                        empty-block-uid (re-find #":block/uid \"(.*)\", (:block/string \"\")" (str drawing-data))] ;check if user has nested a block under a new drawing
                                    (if-not (nil? empty-block-uid)
                                      (if-not (= (second empty-block-uid) (:prev-empty-block @cs))
                                        (do
                                          (swap! cs assoc-in [:prev-empty-block] (second empty-block-uid)) ;;semaphore to avoid double creation of blocks
                                          (create-nested-blocks {:block-uid block-uid 
                                                                  :drawing drawing 
                                                                  :empty-block-uid (second empty-block-uid)})
                                          ))) 
                                    (load-drawing {:block-uid block-uid 
                                                  :drawing drawing 
                                                  :data (get-data-from-block-string drawing-data) 
                                                  :text (first drawing-text)})
                                    (if-not (is-full-screen cs)
                                      (do
                                        (swap! cs assoc-in [:aspect-ratio] (get-embed-image (generate-scene {:drawing drawing}) (:this-dom-node @cs) app-name))
                                        (swap! style assoc-in [:host-div] (host-div-style cs)))))
                                  (reset! pull-watch-active false)
  )))]
    (if (= @deps-available false)
    [:div "Libraries have not yet loaded. Please refresh the block in a moment."]
    (fn []
      ;;(debug ["(main) fn[] starting..."])
      (r/create-class
      { :display-name "Excalidraw Roam Beta"
        ;; Constructor
;           :constructor (fn [this props])
;           :get-initial-state (fn [this] )
        ;; Static methods
;           :get-derived-state-from-props (fn [props state] )
;           :get-derived-state-from-error (fn [error] )
        ;; Methods
;          :get-snapshot-before-update (fn [this old-argv new-argv] )
;          :should-component-update (fn [this old-argv new-argv])
        :component-did-mount (fn [this]
                                ;;(debug ["(main) :component-did-mount"])
                                (load-settings)
                                (swap! cs assoc-in [:this-dom-node] (r/dom-node this))
                                ;;(debug ["(main) :component-did-mount addPullWatch"])
                                (.addPullWatch js/ExcalidrawWrapper block-uid pull-watch-callback)
                                (pull-watch-callback nil nil)
                                (swap! style assoc-in [:host-div] (host-div-style cs))
                                (.addEventListener js/window "resize" resize-handler)
                                ;;(debug ["(main) :component-did-mount Exalidraw mount initiated"])
                              )
        :component-did-update (fn [this old-argv old-state snapshot]
                                ;;(debug ["(main) :component-did-update"])
                                (if (is-full-screen cs)
                                  (resize ew)))
        :component-will-unmount (fn [this]
                                  ;;(debug ["(main) :component-will-unmount"])
                                  (.removePullWatch js/ExcalidrawWrapper block-uid pull-watch-callback)
                                  (.removeEventListener js/window "resize" resize-handler))
;           :component-did-catch (fn [this error info])
        :reagent-render (fn [{:keys [block-uid]} & args]
                          ;;(debug ["(main) :reagent-render"])
                          [:div
                            {:class "excalidraw-host"
                              :style (:host-div @style)
                              :on-mouse-over (fn[e] (swap! cs assoc-in [:mouseover] true))
                              :on-mouse-leave (fn[e] (swap! cs assoc-in [:mouseover] false)) }
                            (if-not (is-full-screen cs)
                              [:button
                                {:class "ex-embed-button"
                                :style {:display (if (:mouseover @cs) "block" "none")
                                        :left (if-not (nil? (:this-dom-node @cs)) 
                                                (- (.-clientWidth (:this-dom-node @cs)) 32) 
                                                0)}
                                :draggable true
                                :on-click (fn [e]
                                            (load-settings)
                                            (going-full-screen? true cs style)
                                            (if (nil? (get-in @drawing [:nestedtext-parent :block-uid])) 
                                              (create-nested-blocks {:block-uid block-uid 
                                                                      :drawing drawing 
                                                                      :empty-block-uid nil}))
                                            (reset! ew (js/ExcalidrawWrapper.
                                                        app-name
                                                        (generate-scene {:drawing drawing})
                                                        (:this-dom-node @cs)
                                                        drawing-on-change-callback ))
                                                        ;(js/setTimeout autosave 10000)
                                                        )}
                                "🖋"]
                              [:button
                                {:class "ex-fullscreen-button"
                                :style {:left (- (.-clientWidth (:this-dom-node @cs)) 32)}
                                :draggable true
                                :on-click (fn [e]
                                            (.svgClipboard js/ExcalidrawWrapper)
                                            (going-full-screen? false cs style)
                                            (save-component {:block-uid block-uid 
                                                              :map-string (js-to-clj-str (get-drawing ew))
                                                              :cs cs
                                                              :drawing drawing
                                                              :saving-flag saving-flag})
                                            (swap! cs assoc-in [:aspect-ratio] (get-embed-image (get-drawing ew) (:this-dom-node @cs) app-name))
                                )}
                                "❌"])
                            [:div
                              {:id app-name
                              :style {:position "relative" :width "100%" :height "100%"}}
]])})))))