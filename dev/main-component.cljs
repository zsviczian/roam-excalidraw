(ns excalidraw.app.alpha.v12
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
(def app-settings (r/atom {:mode "light"
                           :img  "SVG"}))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; util functions
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
(def silent (r/atom true))
(defn debug [x]
  (if-not @silent (apply (.-log js/console) x)))

(defn create-block [parent-uid order block-string]
  (.createBlock js/window.ExcalidrawWrapper parent-uid order block-string))

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
            2 app-settings-block))))
    (let [settings-block (r/atom (rd/q '[:find ?uid .
                                         :in $ ?settings-host
                                         :where [?b :block/uid ?settings-host]
                                                [?b :block/children ?c]
                                                [?c :block/order 0]
                                                [?c :block/uid ?uid]]
                                        @settings-host))]
      (if (nil? @settings-block)
        (do (debug ["(save-settings) settings-block does not exist"])
          (create-block @settings-host 0 (str @app-settings)))
        (do (debug ["(save-settings) settings-block exists, updating"])
          (block/update {:block {:uid @settings-block 
                                 :string (str @app-settings)}}))))))

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

(defn save-component [block-uid map-string]
  (debug ["(save-component) Enter"])
  (let [drawing-block-uid (rd/q '[:find ?drawing-uid .
                                  :in $ ?uid
                                  :where [?e :block/uid ?uid]
                                         [?e :block/children ?c]
                                         [?c :block/order 0]
                                         [?c :block/string ?s]
                                         [(clojure.string/starts-with? ?s "{{roam/render: ((ExcalDATA)) ")]
                                         [?c :block/uid ?drawing-uid]]
                                block-uid)
        render-string (str/join ["{{roam/render: ((ExcalDATA)) " (fix-double-bracket map-string) " }}"])]
    ;(debug  ["(save-component)  data-string: " render-string])
    (block/update
      {:block {:uid drawing-block-uid
               :string render-string}})               
    (swap! app-settings assoc-in [:mode] (get-in (edn/read-string map-string) [:appState :appearance]))
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
          (reset! app-settings {:mode "light" :img  "SVG"}))
        (if (nil? (:mode @app-settings)) 
          (swap! app-settings assoc-in [:mode] "light"))
        (if (nil? (:img @app-settings)) 
          (swap! app-settings assoc-in [:img] "SVG")))
      (save-settings))))

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
      (let [data-string (get-in (first x) [0 :block/string])]
        (debug ["(get-data-from-block-string) returning: " (second (re-find #"ExcalDATA\){2}\s*(\{.*\})\s*\}{2}" data-string))])
        (edn/read-string (second (re-find #"ExcalDATA\){2}\s*(\{.*\})\s*\}{2}" data-string)))))))

(defn load-drawing [block-uid drawing data text] ;drawing is the atom holding the drawing map
  (debug ["(load-drawing) enter"])
  (if (= (count data) 0)
      (do
        (debug ["(load-drawing) create ExcalDATA & title"])
        (let [default-data {:appState {:name "Untitled drawing"
                                       :appearance (:mode @app-settings)}}]
          (create-block block-uid 0 (str/join ["{{roam/render: ((ExcalDATA)) "
                                      (str default-data) " }}"]))
          (reset! drawing {:drawing default-data 
                           :title {:text "Untitled drawing"
                                   :block-uid (create-block block-uid 1 "Untitled drawing")}}))
          (block/update {:block {:uid block-uid :open false}}))
      (if (= (count text) 0)
        (do
          (debug ["(load-drawing) create title only"])
          (reset! drawing {:drawing data
                           :title {:text "Untitled drawing"
                                   :block-uid (create-block block-uid 1 "Untitled drawing")}})
          (block/update {:block {:uid block-uid :open false}}))
        (do
          (debug ["(load-drawing) ExcalDATA & title already exist"])
          (reset! drawing {:drawing data
                           :title {:text (get-in text [0 :block/string])
                                   :block-uid  (get-in text [0 :block/uid])}}))))
    (debug ["(load-drawing) drawing: " @drawing " data: " data " text: " (str text) "appearance " (get-in data [:appState :appearance])]))


(defn generate-scene [drawing]
  (let [scene (:drawing @drawing)]
    (debug ["(generate-scene)"])
    (assoc-in scene [:appState :name] (get-in @drawing [:title :text]))))

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
        top      (int (* height 0.015))
        left     (int (* width 0.015))
        host-div-width (if (nil? (:this-dom-node @cs)) 500
                         (-> (:this-dom-node @cs)  
                           (.-parentElement)
                           (.-parentElement)
                           (.-parentElement)
                           (.-clientWidth)))
        embed-width (if (> host-div-width 500) 500 host-div-width)]
    (debug ["(host-div-style) cur-state :position " (:position @cs) " :top " (int (* height 0.03)) " :left " (int (* width 0.03)) " full-screen? " (is-full-screen cs)])
    (if (is-full-screen cs)
      {:position "fixed"
       :z-index 1000
       :top top
       :left left
       :width  (str/join ["calc(100% - " (* left 2) "px)"]) 
       :height (- height (* top 2))
       :resize "none"} 
      {:position "relative"
       :width embed-width
       :height "100%"
       :resize "both"
       :overflow "hidden"})))

(defn going-full-screen? [x cs style]
  (if (= x true)
    (do
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
       (not= (str (type js/ExcalidrawConfig)) ""))
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
                        :this-dom-node nil})
           ew (r/atom nil) ;;excalidraw-wrapper
           drawing-before-edit (r/atom nil)
           app-name (str/join ["excalidraw-app-" block-uid])
           style (r/atom {:host-div (host-div-style cs)})
           resize-handler (fn [] (if (is-full-screen cs)
                                   (swap! style assoc-in [:host-div] (host-div-style cs))
                                   (if-not (nil? (:this-dom-node @cs)) 
                                     (swap! style assoc-in [:host-div] (host-div-style cs)))))
           pull-watch-callback (fn [before after]
                                 (let [drawing-data (pull-children block-uid 0)
                                       drawing-text (pull-children block-uid 1)]
                                  (load-drawing block-uid drawing (get-data-from-block-string drawing-data) (first drawing-text) )
                                 ; (if (is-full-screen cs) (update-scene ew (generate-scene drawing)))
                                  (debug ["(main) :callback drawing-data appearance" (get-in @drawing [:drawing :appState :appearance]) ]) ))]
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
                                  (swap! style assoc-in [:host-div] (host-div-style cs))
                                  (.addPullWatch js/ExcalidrawWrapper block-uid pull-watch-callback)
                                  (pull-watch-callback nil nil)
                                  (get-embed-image (generate-scene drawing) (:this-dom-node @cs) app-name)
                                  (.addEventListener js/window "resize" resize-handler)
                                  (debug ["(main) :component-did-mount Exalidraw mount initiated"]))
           :component-did-update (fn [this old-argv old-state snapshot]
                                   (debug ["(main) :component-did-update"])
                                   (if (is-full-screen cs)
                                     (resize ew)))
           :component-will-unmount (fn [this]
                                     (.removePullWatch js/ExcalidrawWrapper block-uid pull-watch-callback)
                                     (.removeEventListener js/window "resize" resize-handler))
;           :component-did-catch (fn [this error info])
           :reagent-render (fn [{:keys [block-uid]} & args]
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
                                                  (do (save-component block-uid (js-to-clj-str (get-drawing ew)))
                                                    (going-full-screen? false cs style)
                                                    (get-embed-image (get-drawing ew) (:this-dom-node @cs) app-name)) ;(generate-scene drawing)
                                                  (do (going-full-screen? true cs style)
                                                    (reset! drawing-before-edit (generate-scene drawing))
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
                                                 (going-full-screen? false cs style)
                                                 (debug ["(main) Cancel :on-click"])
                                                 (save-component block-uid (str @drawing-before-edit))
                                                 (get-embed-image @drawing-before-edit (:this-dom-node @cs) app-name))}
                                    "❌"])]
                                  [:span {:class (get-style "ex-header-title-wrapper")}
                                    [:input
                                     {:class (get-style "ex-header-title")
                                      :value (get-in @drawing [:title :text])
                                      :on-change (fn [e] 
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
                                                         (update-scene 
                                                          ew 
                                                          (assoc-in 
                                                           x 
                                                           [:appState :name] (get-in @drawing [:title :text]))))))
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
                                           {:position "relative" :width "100%" :height "calc(100% - 30px)"}
                                           {:background (if (= (get-in @drawing [:drawing :appState :appearance]) "dark") "black" "white")})}
                               ]])})))))