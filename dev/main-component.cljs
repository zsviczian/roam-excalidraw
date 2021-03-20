(ns excalidraw.app.dev.v20
  (:require 
   [clojure.set :as s]
   [reagent.core :as r]
   [roam.datascript :as rd]
   [roam.block :as block]
   [clojure.string :as str]
   [clojure.edn :as edn]
   [roam.util :as util]
   [roam.datascript.reactive :as dr]))

(def app-page "roam/excalidraw")
(def app-settings-block "Settings")
(def app-setting-uid "Excal_SET")
(def default-app-settings {:mode "light"
                           :img  "SVG"
                           :full-screen-margin 0.015
                           :max-embed-width 600
                           :max-embed-height 400})
(def app-settings (r/atom default-app-settings))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; util functions
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
(def silent (r/atom true))
(defn debug [x]
  (if-not @silent (apply (.-log js/console) "<<< Roam-Excalidraw Main cljs >>>" x)))

(defn create-block [parent-uid order block-string]
  (.createBlock js/window.ExcalidrawWrapper parent-uid order block-string))

(defn pretty-settings [x]
 (-> (str x)
      (str/replace "{" "{\n")
      (str/replace ", " "\n")
      (str/replace "}" "\n}")))
 
(defn save-settings []
  (debug ["(save-settings) Enter"])
  (let [settings-host (r/atom (rd/q '[:find ?uid .
                                     :in $ ?page ?block
                                     :where [?p :node/title ?page]
                                            [?p :block/children ?b]
                                            [?b :block/string ?block]
                                            [?b :block/uid ?uid]]
                                    app-page app-settings-block))]
    (if (nil? @settings-host)
      (do (debug ["(save-settings) settings host does not exist"])
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
        (do (debug ["(save-settings) settings-block does not exist"])
          (create-block @settings-host 0 (pretty-settings @app-settings)))
        (do (debug ["(save-settings) settings-block exists, updating"])
          (block/update {:block {:uid @settings-block 
                                 :string (pretty-settings @app-settings)}}))))))

(defn js-to-clj-str [& x]
  (debug ["(js-to-clj-str): x: " x (str x)])
  (let [res (-> x
              (str)
              (str/replace #"\(#js"  "")
              (str/replace #"#js" "")
              (str/replace #"\}\}\)" "}}"))]
    (debug ["(js-to-clj-str) result: " res])
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
                  [(clojure.string/starts-with? ?s "{{roam/render: ((ExcalDATA)) ")]
                  [?c :block/uid ?drawing-uid]]
        x))

(defn get-text-blocks [x]
  (:block/children (rd/q '[:find (pull ?e [:block/children {:block/children [:block/uid :block/string]}])
          :in $ ?title-uid
          :where [?e :block/uid ?title-uid]]
        x)))

(defn get-or-create-orphans-block-uid [x]
  (let [uid (rd/q '[:find ?orphan-uid .
                   :in $ ?uid
                   :where [?b :block/uid ?uid]
                          [?b :block/children ?c]
                          [?c :block/string ?s]
                          [(= ?s "Orphans")]
                          [?c :block/uid ?orphan-uid]]
                  x)]
    (if (nil? uid)
      (.createBlock js/ExcalidrawWrapper x 3 "Orphans")
      uid)))

(defn save-component [x] ;;{:block-uid "BlockUID" :map-string "String" :cs atom :drawing atom}
  (swap! (:cs x) assoc-in [:saving] true) ;;used to disable the pullWatch while blocks are edited
  (debug ["(save-component) Enter"])
  (let [data-block-uid (get-data-block-uid (:block-uid x))
        edn-map (edn/read-string (:map-string x))
        text-elements (r/atom nil)
        ;;get text blocks nested under title
        title-block-uid (get-in @(:drawing x) [:title :block-uid])
        nested-text-blocks (get-text-blocks title-block-uid) 
        app-state (into {} (filter (comp some? val) (:appState edn-map))) ;;remove nil elements from appState
        orphans-block-uid (r/atom nil)] 
    ;;process text on drawing
    (doseq [y (filter (comp #{"text"} :type) (:elements edn-map))]
      (if (str/starts-with? (:id y) "ROAM_")
        (do ;;block with text should already exist, update text, but double check that the block is there...
          (debug ["(save-component) nested block should exist text:" (:text y) "block-id" (re-find #"ROAM_(.*)_ROAM" (:id y))])
          (let [text-block-uid (second (re-find #"ROAM_(.*)_ROAM" (:id y)))]
            (if-not (nil? (filter (comp #{text-block-uid} :block/uid) nested-text-blocks))
              (do ;;block exists
                (debug ["(save-component) block exists, updateing"])
                (block/update {:block {:uid text-block-uid :string (:text y)}})
                (reset! text-elements (conj @text-elements y)))
              (do ;block no-longer exists, create new one
                (debug ["(save-component) block should, but does not exist, creating..."])
                (let [new-block-uid (.createBlock js/ExcalidrawWrapper title-block-uid 1000 (:text y))]
                  (reset! text-elements (conj @text-elements (assoc-in y [:id] (str/join ["ROAM_" new-block-uid "_ROAM"])))))))))
        (do ;;block with text does not exist as nested block, create new
          (debug ["(save-component) block does not exists, creating"])
          (let [new-block-uid (.createBlock js/ExcalidrawWrapper title-block-uid 1000 (:text y))]
            (reset! text-elements (conj @text-elements (assoc-in y [:id] (str/join ["ROAM_" new-block-uid "_ROAM"]))))))))
    ;;process nested text - move to orphans blocks no longer on drawing
    
    (doseq [y nested-text-blocks]
      (if (nil? (filter (comp #{(str/join ["ROAM_" (:block/uid y) "_ROAM"])} :id) @text-elements))
        (do (if (nil? @orphans-block-uid) (reset! orphans-block-uid (get-or-create-orphans-block-uid (:block-uid x))))
          (block/move {:location {:parent-uid @orphans-block-uid :order 1000}
                       :block {:uid (:block/uid y)}}))))
    (debug ["(save-component) text-blocks with updated IDs" (str @text-elements)])
    ;;updating the data block is the final piece in saving the component
    ;;this update will trigger pullwatch to load the updated drawing 
    ;;to display as SVG or PNG (depending on setting)
    ;;I enable pullwatch event handler actions before updating the data block
    (swap! (:cs x) assoc-in [:saving] false)
    (let [elements (concat (into [] (remove (comp #{"text"} :type) (:elements edn-map)))  @text-elements)
          out-string (fix-double-bracket (str {:elements elements :appState app-state}))
          render-string (str/join ["{{roam/render: ((ExcalDATA)) " out-string " }}"])]
      (block/update
        {:block {:uid data-block-uid
                :string render-string}}))
    (swap! app-settings assoc-in [:mode] (get-in app-state [:appearance]))
    (save-settings)))

(defn load-settings []
  (debug ["(load-settings) Enter"])
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
        (debug ["(load-settings) settings: " settings-block])
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
  (debug ["(get-data-from-block-string)" (count x)])
  (if (= (count x) 0)
    (do 
      (debug ["(get-data-from-block-string) returning nil"])
      nil)
    (do
      (let [data-string (get-in (first x) [0 :block/string])
            return-string (second (re-find #"ExcalDATA\){2}\s*(\{.*\})\s*\}{2}" data-string))]
        ;(debug ["(get-data-from-block-string) returning: " retrun-string])
        (edn/read-string return-string)))))

(defn create-nested-blocks [x]; {:block-uid "BlockUID" :drawing atom :empty-block-uid "BlockUID"}
;;block uid is the block of the roam/render component
;;empty block is the block created by the user by trying to nest text under 
;;a new drawing that hasn't been edited yet (i.e. the data and title children
;;are missing)
  (debug ["(create-nested-blocks)"])
  (let [default-data {:appState {:name "Untitled drawing"
                                       :appearance (:mode @app-settings)}}]
    (create-block (:block-uid x) 0 (str/join ["{{roam/render: ((ExcalDATA)) "
                                (str default-data) " }}"]))
    (reset! (:drawing x) {:drawing default-data 
                          :title {:text (if (nil? (:empty-block-uid x)) "Untitled drawing" "")
                                  :block-uid (if (nil? (:empty-block-uid x)) 
                                               (create-block (:block-uid x) 1 "Untitled drawing")
                                               (:empty-block-uid x))}})
    (if (nil? (:empty-block-uid x)) 
      (block/update {:block {:uid (:block-uid x) :open false}}))))

(defn load-drawing [x] ;{:block-uid "BlockUID" :drawing atom :data objects :text "text"} 
;drawing is the atom holding the drawing map
;block uid is the block with the roam/render component
;data are the drawing objects
;text are the nested text blocks
  (debug ["(load-drawing) enter"])
  (if (= (count (:data x)) 0)
      (do
        (debug ["(load-drawing) no children - creating dummy data"])
        (let [default-data {:appState {:name "Untitled drawing"
                                       :appearance (:mode @app-settings)}}]
          (reset! (:drawing x) {:drawing default-data 
                            :title {:text "Untitled drawing"
                                    :block-uid nil}})))
      (if (= (count (:text x)) 0)
        (do
          (debug ["(load-drawing) create title only"])
          (reset! (:drawing x) {:drawing (:data x)
                           :title {:text "Untitled drawing"
                                   :block-uid (create-block (:block-uid x) 1 "Untitled drawing")}})
          (block/update {:block {:uid (:block-uid x) :open false}}))
        (do
          (debug ["(load-drawing) ExcalDATA & title already exist"])
          (reset! (:drawing x) {:drawing (:data x)
                           :title {:text (get-in (:text x) [0 :block/string])
                                   :block-uid  (get-in (:text x) [0 :block/uid])}}))))
    (debug ["(load-drawing) drawing: " @(:drawing x) " data: " (:data x) " text: " (str (:text x)) "appearance " (get-in (:data x) [:appState :appearance])]))


(defn generate-scene [x] ;{:drawing atom}]
  (let [scene (:drawing @(:drawing x))]
    (debug ["(generate-scene)"])
    (assoc-in scene [:appState :name] (get-in @(:drawing x) [:title :text]))))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Main Function Form-3
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
(def embedded-view "ev")
(def full-screen-view "fs")

(defn is-full-screen [cs]  ;;component-state
  (not= (:position @cs) embedded-view))

(defn set-zen-mode-enabled [ew cs value] ;;exalidraw-wrapper component-state
  (debug ["(set-zen-mode-enabled) " value])
  (swap! cs assoc-in [:zen-mode] value)
  (if-not (nil? @ew) (.setZenModeEnabled @ew value)))

(defn set-grid-mode-enabled [ew cs value] ;;exalidraw-wrapper component-state
  (debug ["(set-grid-mode-enabled) " value])
  (swap! cs assoc-in [:grid-mode] value)
  (if-not (nil? @ew) (.setGridModeEnabled @ew value)))

(defn resize [ew]
  (debug ["(resize)"])
  (if-not (nil? @ew) (.onResize @ew)))

(defn update-scene [ew scene]
  (debug ["(update-scene) scene: " scene])
  (if-not (nil? @ew) (.updateScene @ew scene)))

(defn get-drawing [ew]
  (debug ["(get-drawing): " (.getDrawing js/window.ExcalidrawWrapper @ew)])
  (.getDrawing js/window.ExcalidrawWrapper @ew))

(defn host-div-style [cs]
  (let [width    (.-innerWidth js/window)
        height   (.-innerHeight js/window)
        top      (int (* height (:full-screen-margin @app-settings)))
        left     (int (* width (:full-screen-margin @app-settings)))
        host-div-width (if (nil? (:this-dom-node @cs)) (:max-embed-width @app-settings)
                         (-> (:this-dom-node @cs)  
                           (.-parentElement)
                           (.-parentElement)
                           (.-parentElement)
                           (.-clientWidth)))
        embed-width (if (> host-div-width (:max-embed-width @app-settings)) 
                      (:max-embed-width @app-settings) host-div-width)
        embed-height (* (:max-embed-height @app-settings) (/ embed-width (:max-embed-width @app-settings)))
        ar (:aspect-ratio @cs)
        w (if (nil? ar) embed-width 
            (if (> ar 1.0) embed-width
              (* ar embed-height)))
        h (if (nil? ar @cs) "100%" 
            (if (> ar 1.0) "100%" 
              (+ embed-height (:header-height @cs) )))]
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
       :overflow "hidden"})))

(defn going-full-screen? [x cs style]
  (if (= x true)
    (do
      (load-settings)
      (.fullScreenKeyboardEventRedirect js/window.ExcalidrawWrapper true)
      (swap! cs assoc-in [:position] full-screen-view)
      (swap! style assoc-in [:host-div] (host-div-style cs)))
    (do
      (.fullScreenKeyboardEventRedirect js/window.ExcalidrawWrapper false)
      (swap! cs assoc-in [:position] embedded-view)
      (swap! style assoc-in [:host-div] (host-div-style cs)))))


;;state to capture when callback confirms React libraries have loaded
(def deps-available (r/atom false))

(defn check-js-dependencies []
  (if (and (not= (str (type js/ExcalidrawUtils)) "")
       (not= (str (type js/Excalidraw)) "")
       (not= (str (type js/ReactDOM)) "")
       (not= (str (type js/React)) "")
       (not= (str (type js/ExcalidrawConfig)) "")
       (not= (str (type js/ExcalidrawWrapper)) ""))
    (do (reset! silent (not (.-DEBUG js/ExcalidrawConfig)))
      (reset! deps-available true))
    (js/setTimeout check-js-dependencies 1000)
  ))

(defn pull-children [block-uid order]
  (rd/q '[:find (pull ?b [:block/uid :block/string {:block/children [:block/string :block/order :block/uid {:block/children ...}]}])
                                         :in $ ?block-uid ?order
                                         :where [?e :block/uid ?block-uid]
                                                [?e :block/children ?b]
                                                [?b :block/order ?order]]
			                             block-uid order))
(defn get-embed-image [drawing dom-node app-name]
  (if (= (:img @app-settings) "PNG")
    (.getPNG js/window.ExcalidrawWrapper drawing dom-node app-name)
    (.getSVG js/window.ExcalidrawWrapper drawing dom-node app-name)
  ))

(defn get-style [x]
  (str/join [x "-" (:mode @app-settings)]))

(defn main [{:keys [block-uid]} & args]
  (debug ["(main) component starting..."])
  (check-js-dependencies)
  (if (= @deps-available false)
    [:div "Libraries have not yet loaded. Please refresh the block in a moment."]
    (fn []
      (debug ["(main) fn[] starting..."])
      (let [drawing (r/atom nil)
            cs (r/atom {:position embedded-view  ;;component-state
                        :zen-mode false
                        :grid-mode false
                        :this-dom-node nil
                        :header-height 30
                        :aspect-ratio nil
                        :saving false})
           ew (r/atom nil) ;;excalidraw-wrapper
           drawing-before-edit (r/atom nil)
           app-name (str/join ["excalidraw-app-" block-uid])
           style (r/atom {:host-div (host-div-style cs)})
           resize-handler (fn [] (if (is-full-screen cs)
                                   (swap! style assoc-in [:host-div] (host-div-style cs))
                                   (if-not (nil? (:this-dom-node @cs)) 
                                     (swap! style assoc-in [:host-div] (host-div-style cs)))))
           pull-watch-callback (fn [before after]
                                 (if-not (:saving @cs)
                                   (do 
                                     (let [drawing-data (pull-children block-uid 0)
                                           drawing-text (pull-children block-uid 1)
                                           empty-block-uid (re-find #":block/uid \"(.*)\", (:block/string \"\")" (str drawing-data))] ;check if user has nested a block under a new drawing
                                       (if-not (nil? empty-block-uid)
                                       (create-nested-blocks {:block-uid block-uid 
                                                              :drawing drawing 
                                                              :empty-block-uid (second empty-block-uid)}))
                                       (load-drawing {:block-uid block-uid 
                                                      :drawing drawing 
                                                      :data (get-data-from-block-string drawing-data) 
                                                      :text (first drawing-text)})
                                       (debug ["(main) :callback drawing-data appearance" (get-in @drawing [:drawing :appState :appearance]) ]) ))))]
        (r/create-class
         { :display-name "Excalidraw Roam Beta"
           ;; Constructor
;           :constructor (fn [this props]
;                          (debug ["(main) :constructor"]))
;           :get-initial-state (fn [this]
;                                (debug ["(main) :get-initial-state"]))
           ;; Static methods
;           :get-derived-state-from-props (fn [props state] )
;           :get-derived-state-from-error (fn [error] )
           ;; Methods
 ;          :get-snapshot-before-update (fn [this old-argv new-argv] )
 ;          :should-component-update (fn [this old-argv new-argv]
 ;                                     (debug ["(main) :should-component-update"]))
           :component-did-mount (fn [this]
                                  (debug ["(main) :component-did-mount"])
                                  (load-settings)
                                  (swap! cs assoc-in [:this-dom-node] (r/dom-node this))
                                  (swap! cs assoc-in [:header-height]
                                    (-> (:this-dom-node @cs)  
                                          (.querySelector "[class^=\"ex-header-wrapper\"]")
                                          (.-clientHeight)))
                                  (debug ["(main) :component-did-mount addPullWatch"])
                                  (.addPullWatch js/ExcalidrawWrapper block-uid pull-watch-callback)
                                  (pull-watch-callback nil nil)
                                  (swap! cs assoc-in [:aspect-ratio] (get-embed-image (generate-scene {:drawing drawing}) (:this-dom-node @cs) app-name))
                                  (swap! style assoc-in [:host-div] (host-div-style cs))
                                  (.addEventListener js/window "resize" resize-handler)
                                  (debug ["(main) :component-did-mount Exalidraw mount initiated"]))
           :component-did-update (fn [this old-argv old-state snapshot]
                                   (debug ["(main) :component-did-update"])
                                   (if (is-full-screen cs)
                                     (resize ew)))
           :component-will-unmount (fn [this]
                                     (debug ["(main) :component-will-unmount"])
                                     (.removePullWatch js/ExcalidrawWrapper block-uid pull-watch-callback)
                                     (.removeEventListener js/window "resize" resize-handler))
;           :component-did-catch (fn [this error info])
           :reagent-render (fn [{:keys [block-uid]} & args]
                             (letfn [(clear-checkboxes [] 
                               (if (:zen-mode @cs) (swap! cs assoc-in [:zen-mode] false))
                               (if (:grid-mode @cs) (swap! cs assoc-in [:grid-mode] false)))]
                              (debug ["(main) :reagent-render"])
                                [:div
                                  {:class (get-style "excalidraw-host")
                                  :style (:host-div @style)}
                                  [:div {:class (get-style "ex-header-wrapper")}
                                  [:span {:class (get-style "ex-header-buttons-wrapper")}
                                    [:button
                                    {:class (get-style "ex-header-button")
                                      :draggable true
                                      :on-click (fn [e]
                                                  (if (is-full-screen cs)
                                                    (do (clear-checkboxes)
                                                      (.svgClipboard js/ExcalidrawWrapper)
                                                      (save-component {:block-uid block-uid 
                                                                       :map-string (js-to-clj-str (get-drawing ew))
                                                                       :cs cs
                                                                       :drawing drawing})
                                                      (swap! cs assoc-in [:aspect-ratio] (get-embed-image (get-drawing ew) (:this-dom-node @cs) app-name))
                                                      (going-full-screen? false cs style)) 
                                                    (do (going-full-screen? true cs style)
                                                      (if (nil? (get-in @drawing [:title :block-uid])) 
                                                        (create-nested-blocks {:block-uid block-uid 
                                                                               :drawing drawing 
                                                                               :empty-block-uid nil}))
                                                      (reset! drawing-before-edit (generate-scene {:drawing drawing}))
                                                      (debug ["(main) :on-click drawing-before-edig " @drawing-before-edit])
                                                      (reset! ew (js/ExcalidrawWrapper.
                                                                  app-name
                                                                  @drawing-before-edit
                                                                  (:this-dom-node @cs) )))))}
                                      (if (is-full-screen cs) "💾" "🖋")]
                                  (if (is-full-screen cs)
                                    [:button
                                      {:class (get-style "ex-header-button")
                                      :draggable true
                                      :on-click (fn [e]
                                                  (clear-checkboxes)
                                                  (.svgClipboard js/ExcalidrawWrapper)
                                                  (debug ["(main) Cancel :on-click"])
                                                  (save-component {:block-uid block-uid 
                                                                   :map-string (str @drawing-before-edit)
                                                                   :cs cs
                                                                   :drawing drawing})
                                                  (swap! cs assoc-in [:aspect-ratio] (get-embed-image @drawing-before-edit (:this-dom-node @cs) app-name))
                                                  (going-full-screen? false cs style))}
                                      "❌"])]
                                    [:span {:class (get-style "ex-header-title-wrapper")}
                                      [:input
                                      {:class (get-style "ex-header-title")
                                        :value (get-in @drawing [:title :text])
                                        :on-change (fn [e] 
                                                    (if (nil? (get-in @drawing [:title :block-uid])) 
                                                      (create-nested-blocks {:block-uid block-uid 
                                                                             :drawing drawing 
                                                                             :empty-block-uid nil}))
                                                    (swap! drawing assoc-in [:title :text] (.. e -target -value))
                                                    (block/update
                                                      {:block {:uid (get-in @drawing [:title :block-uid])
                                                              :string (get-in @drawing [:title :text])}})
                                                    (if (is-full-screen cs)
                                                      (do
                                                        (let [x (edn/read-string
                                                                  (js-to-clj-str
                                                                  (get-drawing ew)))]
                                                          (debug ["(main) input.ex-header-title update x:" x])
                                                            (assoc-in 
                                                            x 
                                                            [:appState :name] (get-in @drawing [:title :text])))))
                                                    )}]]
                                  (if (is-full-screen cs)
                                      [:span {:class (get-style "ex-header-options-wrapper")}
                                        [:label {:class (get-style "ex-header-options-label")} 
                                        [:input
                                          {:class (get-style "ex-header-options-checkbox")
                                          :type "checkbox"
                                          :checked (:zen-mode @cs)
                                          :on-change (fn [e]
                                                        (set-zen-mode-enabled
                                                        ew
                                                        cs
                                                        (not (:zen-mode @cs))))}]
                                          "Zen Mode"]
                                      [:label {:class (get-style "ex-header-options-label")}
                                      [:input
                                        {:class (get-style "ex-header-options-checkbox")
                                        :type "checkbox"
                                        :checked (:grid-mode @cs)
                                        :on-change (fn [e]
                                                      (set-grid-mode-enabled
                                                      ew
                                                      cs
                                                      (not (:grid-mode @cs))))}]
                                        "Grid Mode"]])];];)]
                                  [:div
                                  {:id app-name
                                    :style (if (is-full-screen cs)
                                            {:position "relative" :width "100%" :height (str/join ["calc(100% - " (:header-height @cs) "px"])}
                                            {:background (if (= (get-in @drawing [:drawing :appState :appearance]) "dark") "#121212" "white")})}
]]))})))))