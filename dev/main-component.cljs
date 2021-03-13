(ns excalidraw.app.alpha.v07
  (:require 
   [clojure.set :as s]
   [reagent.core :as r]
   [roam.datascript :as rd]
   [roam.block :as block]
   [clojure.string :as str]
   [clojure.edn :as edn]
   [roam.util :as util]
   [roam.datascript.reactive :as dr]))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Common functions
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
(def silent (r/atom true))
(defn debug [x]
  (if-not silent (apply (.-log js/console) x)))

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
               :string render-string}})))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Load data from nested block(s)
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
(defn create-block [parent-uid order block-string]
  (.createBlock js/window.ExcalidrawWrapper parent-uid order block-string))

;;finds the json enclosed in double parentheses and returns it
(defn get-data-from-block-string [x]
  (debug ["(get-data-from-block-string)" (count x)])
  (if (= (count x) 0)
    (do 
      (debug ["(get-data-from-block-string) returning nil"])
      nil)
    (do
      (let [data-string (get-in (first x) [0 :block/string])]
        ;;(debug ["(get-data-from-block-string) returning: " (second (re-find #"ExcalDATA\){2}\s*(\{.*\})\s*\}{2}" data-string))])
        (edn/read-string (second (re-find #"ExcalDATA\){2}\s*(\{.*\})\s*\}{2}" data-string)))))))

(defn load-drawing [block-uid drawing data text] ;drawing is the atom holding the drawing map
  (debug ["(load-drawing) enter"])
  (if (nil? data)
      (do
        (debug ["(load-drawing) create ExcalDATA & title"])
        (create-block block-uid 0 "{{roam/render: ((ExcalDATA)) {} }}")
        (reset! drawing {:drawing 
                         {:appState {:name "Untitled drawing"}} 
                         :title {:text "Untitled drawing"
                                 :block-uid (create-block block-uid 1 "Untitled drawing")}}));
      (if (= (count text) 0)
        (do
          (debug ["(load-drawing) create title only"])
          (reset! drawing {:drawing data
                           :title {:text "Untitled drawing"
                                   :block-uid (create-block block-uid 1 "Untitled drawing")}}))
        (do
          (debug ["(load-drawing) ExcalDATA & title already exist"])
          (reset! drawing {:drawing data
                           :title {:text (get-in text [0 :block/string])
                                   :block-uid  (get-in text [0 :block/uid])}}))))
    (debug ["(load-drawing) drawing: " @drawing " data: " data " text: " (str text) "appearance " (get-in data [:appState :appearance])]));)


(defn generate-scene [drawing]
  (let [scene (:drawing @drawing)]
    (debug ["(generate-scene)"])
    (assoc-in scene [:appState :name] (get-in @drawing [:title :text]))))

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;; Main Function Form-3
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
(def embedded-view "ev")
(def full-screen-view "fs")
(def embed-width 500)

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
        top      (int (* height 0.03))
        left     (int (* width 0.03))]
    (debug ["(host-div-style) cur-state :position " (:position @cs) " :top " (int (* height 0.03)) " :left " (int (* width 0.03)) " full-screen? " (is-full-screen cs)])
    (if (is-full-screen cs)
      {:position "fixed"
       :z-index 1000
       :top top
       :left left
       :width  (str/join ["calc(100% - " (* left 2) "px)"]) 
       :height (- height (* top 2))
       :background "white"}
      {:position "relative"
       :width embed-width
       :height "100%"
       :display "block"
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
       (not= (str (type js/React)) ""))
    (reset! deps-available true)
    (js/setTimeout check-js-dependencies 1000)
  ))

(defn pull-children [block-uid order]
  (rd/q '[:find (pull ?b [:block/uid :block/string {:block/children [:block/string :block/order :block/uid {:block/children ...}]}])
                                         :in $ ?block-uid ?order
                                         :where [?e :block/uid ?block-uid]
                                                [?e :block/children ?b]
                                                [?b :block/order ?order]]
			                             block-uid order))

(defn main [{:keys [block-uid]} & args]
  (debug ["(main) component starting..."])
  (check-js-dependencies)
  (reset! debug (.-DEBUG js/window.ExcalidrawConfig))
  (if (= @deps-available false)
    [:div "Libraries have not yet loaded. Please refresh the block in a moment."]
    (fn []
      (debug ["(main) fn[] starting..."])
      (let [drawing (r/atom nil)
            cs (r/atom {:position embedded-view  ;;component-state
                        :zen-mode false
                        :grid-mode false})
           ew (r/atom nil) ;;excalidraw-wrapper
           drawing-before-edit (r/atom nil)
           app-name (str/join ["excalidraw-app-" block-uid])
           this-dom-node (r/atom nil)
           style (r/atom {:host-div (host-div-style cs)})
           resize-handler (fn [] (if (is-full-screen cs) 
                                   (swap! style assoc-in [:host-div] (host-div-style cs))))
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
                                  (reset! this-dom-node (r/dom-node this))
                                  (.addPullWatch js/ExcalidrawWrapper block-uid pull-watch-callback)
                                  (pull-watch-callback nil nil)
                                  (.getPNG js/window.ExcalidrawWrapper (generate-scene drawing) @this-dom-node app-name)
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
                               [:div.excalidraw-host
                                {:style (:host-div @style)}
                                [:div.ex-header-wrapper
                                 [:span.ex-header-buttons-wrapper
                                  [:button.ex-header-button
                                   {:draggable true
                                    :on-click (fn [e]
                                                (if (is-full-screen cs)
                                                  (do (save-component block-uid (js-to-clj-str (get-drawing ew)))
                                                    (going-full-screen? false cs style)
                                                    (.getPNG js/window.ExcalidrawWrapper (get-drawing ew) @this-dom-node app-name)) ;(generate-scene drawing)
                                                  (do (going-full-screen? true cs style)
                                                    (reset! drawing-before-edit (generate-scene drawing))
                                                    (debug ["(main) :on-click drawing-before-edig " @drawing-before-edit])
                                                    (reset! ew (js/ExcalidrawWrapper.
                                                                app-name
                                                                @drawing-before-edit
                                                                @this-dom-node)))))}
                                    (if (is-full-screen cs) "Save" "Edit")]
                                 (if (is-full-screen cs)
                                   [:button.ex-header-button
                                    {:draggable true
                                     :on-click (fn [e]
                                                 (going-full-screen? false cs style)
                                                 (debug ["(main) Cancel :on-click"])
                                                 (save-component block-uid (str @drawing-before-edit))
                                                 (.getPNG js/window.ExcalidrawWrapper @drawing-before-edit @this-dom-node app-name))}
                                    "Cancel"])]
                                  [:span.ex-header-title-wrapper
                                    [:input.ex-header-title
                                     {:value (get-in @drawing [:title :text])
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
                                    [:span.ex-header-options-wrapper
                                      [:label.ex-header-options-label [:input.ex-header-options-checkbox
                                        {:type "checkbox"
                                         :checked (:zen-mode @cs)
                                         :on-change (fn [e]
                                                      (set-zen-mode-enabled
                                                       ew
                                                       cs
                                                       (not (:zen-mode @cs))))}]
                                        "Zen Mode"]
                                    [:label.ex-header-options-label [:input.ex-header-options-checkbox
                                      {:type "checkbox"
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