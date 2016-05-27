# Leaflet.draw

This is a NBT fork of Leaflet.draw 0.2.4. For latest version, please check the [official repo](https://github.com/Leaflet/Leaflet.draw).

Development branch: [0.2.4-master](https://github.com/NBTSolutions/Leaflet.draw/tree/0.2.4-master)

# Change log

* `L.EditToolbar.Edit` accepts option `extensionZIndexOffset` to specify the z-index offset of the extension line (05/27/2016)

* Prevent user to create multiple extension globally (05/27/2016)

* Allow extension line to snap to its parent layer's guide layers (05/24/2016)

* Change default polyline editing behavior (05/20/2016)

  * double click any existing vertex will remove that vertex

  * single click on the start/end point of the polyline will trigger line extension

  * **the impact to polygon editing is unknow**

* Disable default ESC event at edit tool (05/06/2016)
