(ns excalidraw.svg.v03
  (:require
   [reagent.core :as r]
   [clojure.string :as str]
   [roam.datascript :as rd]
   [clojure.edn :as edn]))

(def silent (r/atom true))
(defn debug [x]
  (if-not @silent (apply (.-log js/console) "<<< Roam-Excalidraw SVG cljs >>>" x)))

(def app-page "roam/excalidraw")
(def app-settings-block "Settings")
(def app-setting-uid "Excal_SET")
(def default-app-settings {:mode "light"
                           :img  "SVG"
                           :full-screen-margin 0.015
                           :max-embed-width 600
                           :max-embed-height 400})
(def app-settings (r/atom default-app-settings))

(defn load-settings []
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
        (reset! app-settings (edn/read-string settings-block))
        (if (nil? @app-settings)
          (reset! app-settings default-app-settings))
        (doseq [key (keys default-app-settings)]
          (if (nil? (key @app-settings))
            (swap! app-settings assoc-in [key] (key default-app-settings))))))))

(defn host-div-style [cs]
  (let [host-div-width (if (nil? (:tdn @cs)) (:max-embed-width @app-settings)
                       (.getHostDIVWidth js/ExcalidrawWrapper (:tdn @cs)))
      embed-width (if (> host-div-width (:max-embed-width @app-settings)) 
                    (:max-embed-width @app-settings) host-div-width)
      embed-height (* (:max-embed-height @app-settings) (/ embed-width (:max-embed-width @app-settings)))
      ar (:aspect-ratio @cs)
      w (if (nil? ar) embed-width 
          (if (> ar 1.0) embed-width
            (* ar embed-height)))
      h (if (nil? ar @cs) "100%" 
          (if (> ar 1.0) "100%" 
            embed-height ))]
    {:position "relative"
     :width w
     :height h
     :resize "both"
     :overflow "hidden"}))

;;state to capture when callback confirms React libraries have loaded
(def deps-available (r/atom false))

(defn check-js-dependencies []
  (if (and (not= (str (type js/ExcalidrawWrapper)) "")
       (not= (str (type js/ExcalidrawConfig)) ""))
    (do (reset! silent (not (.-DEBUG js/ExcalidrawConfig)))
      (reset! deps-available true))
    (js/setTimeout check-js-dependencies 1000)
  ))


(defn main [{:keys [block-uid]} & args]
  (check-js-dependencies)
  (if (= @deps-available false)
    [:div "Libraries have not yet loaded. Please refresh the block in a moment."]
    (fn []
      (let [cs (r/atom {:tdn nil ;this-dom-node
                        :aspect-ratio nil}) 
            style (r/atom {})
            app-name (str/join ["excalidraw-svg-" block-uid])] 
        (r/create-class 
        { :display-name "debug name" 
          :component-did-mount (fn [this]
                                  (load-settings)
                                  (swap! cs assoc-in [:tdn] (r/dom-node this))
                                  (swap! cs assoc-in [:aspect-ratio] (.setSVG js/ExcalidrawWrapper (:tdn @cs) (first args) app-name))
                                  (reset! style (host-div-style cs)))
          :reagent-render (fn [{:keys [block-uid]} & args] 
                            [:div {:style @style}
                              [:div {:id app-name} ]]
                            )})))))

