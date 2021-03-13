(ns excalidraw.data.alpha.v01)

(def silent true)
(defn debug [x] 
  (if-not silent (apply (.-log js/console) x)))

(defn main2 [{:keys [block-uid]}  args]
  (debug ["data: " args])
  [:div [:span.excalidraw-data "Excalidraw DATA"]])