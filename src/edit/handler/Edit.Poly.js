L.Edit = L.Edit || {};

/*
 * L.Edit.Poly is an editing handler for polylines and polygons.
 */

L.Edit.Poly = L.Handler.extend({
	options: {
		icon: new L.DivIcon({
			iconSize: new L.Point(8, 8),
			className: 'leaflet-div-icon leaflet-editing-icon'
		})
	},

	initialize: function (poly, options) {
		this._poly = poly;
    this._ignoreDragging = false;
    this._extendable = true;
		L.setOptions(this, options);
	},

	addHooks: function () {
		var poly = this._poly;

		if (!(poly instanceof L.Polygon) &&	poly.options.editing) {
			poly.options.editing.fill = false;
		}

		poly.setStyle(poly.options.editing);

		if (this._poly._map) {
			if (!this._markerGroup) {
				this._initMarkers();
			}

      if (!(this._poly instanceof L.Polygon)) {
        this._poly._map.on('draw:created', this._onExtendFinish, this);
        this._poly._map.on('extend:start', this._onExtendStart, this);
      }

			this._poly._map.addLayer(this._markerGroup);

      if (!this._mouseMarker) {
        this._mouseMarker = L.marker(this._poly._map.getCenter(), {
          icon: L.divIcon({
            className: 'leaflet-mouse-marker',
            iconAnchor: [20, 20],
            iconSize: [40, 40]
          }),
          opacity: 0,
          zIndexOffset: this.options.zIndexOffset
        });

        this._mouseMarker
          .on('mousedown', this._onMouseDown, this)
          .addTo(this._poly._map);
      }
		}
	},

	removeHooks: function () {
		var poly = this._poly;

		poly.setStyle(poly.options.original);

		if (poly._map && this._markerGroup) {
			poly._map.removeLayer(this._markerGroup);
			delete this._markerGroup;
			delete this._markers;
		}

    if (poly._map) {

      if (this._mouseMarker) {
        this._mouseMarker
          .off('mousedown', this._onMouseDown, this);
        poly._map.removeLayer(this._mouseMarker);
        delete this._mouseMarker;
      }

      if (!(this._poly instanceof L.Polygon)) {
        this._poly._map.off('draw:created', this._onExtendFinish, this);
        this._poly._map.off('extend:start', this._onExtendStart, this);
        this._clearExtension();
      }
    }
	},

	updateMarkers: function () {
		this._markerGroup.clearLayers();
		this._initMarkers();
	},

	_initMarkers: function () {
		if (!this._markerGroup) {
			this._markerGroup = new L.LayerGroup();
		}
		this._markers = [];

		var latlngs = this._poly._latlngs,
			i, j, len, marker;

		// TODO refactor holes implementation in Polygon to support it here

		for (i = 0, len = latlngs.length; i < len; i++) {

			marker = this._createMarker(latlngs[i], i);
			marker.on('dblclick', this._onMarkerDbClick, this);
      marker.on('click', this._check_later, this);
			this._markers.push(marker);
		}

		var markerLeft, markerRight;

		for (i = 0, j = len - 1; i < len; j = i++) {
			if (i === 0 && !(L.Polygon && (this._poly instanceof L.Polygon))) {
				continue;
			}

			markerLeft = this._markers[j];
			markerRight = this._markers[i];

			this._createMiddleMarker(markerLeft, markerRight);
			this._updatePrevNext(markerLeft, markerRight);
		}
	},

	_createMarker: function (latlng, index) {
		var marker = new L.Marker(latlng, {
			draggable: true,
			icon: this.options.icon
		});

		marker._origLatLng = latlng;
		marker._index = index;

		marker.on('drag', this._onMarkerDrag, this);
		marker.on('dragend', this._fireEdit, this);

		this._markerGroup.addLayer(marker);

		return marker;
	},

	_removeMarker: function (marker) {
		var i = marker._index;

		this._markerGroup.removeLayer(marker);
		this._markers.splice(i, 1);
		this._poly.spliceLatLngs(i, 1);
		this._updateIndexes(i, -1);

		marker
      .off('click', this._check_later, this)
			.off('drag', this._onMarkerDrag, this)
			.off('dragend', this._fireEdit, this)
			.off('dblclick', this._onMarkerDbClick, this);
	},

	_fireEdit: function () {
		this._poly.edited = true;
		this._poly.fire('edit');
	},

	_onMarkerDrag: function (e) {
		var marker = e.target;

		L.extend(marker._origLatLng, marker._latlng);

		if (marker._middleLeft) {
			marker._middleLeft.setLatLng(this._getMiddleLatLng(marker._prev, marker));
		}
		if (marker._middleRight) {
			marker._middleRight.setLatLng(this._getMiddleLatLng(marker, marker._next));
		}

		this._poly.redraw();
	},

  _onPolylineExtend: function(e) {

    // the user can only extend polyline
    if (this._poly instanceof L.Polygon) { return; }

    // check if the user is extending the other line
    if (!this._extendable) { return; }

    // if the user are extending this line now, don't draw another extension line
    if (this._extending && this._extending.enabled()) { return; }

    var latLng = e.latlng;
    var latLngs = this._poly.getLatLngs();

    // set the extending order if the user clicks on the start point
    if (latLng.equals(latLngs[latLngs.length - 1])) {
      this._extendOrder = 1;
    }

    // set the reverse extending order if the user clicks on the end point
    if (latLng.equals(latLngs[0])) {
      this._extendOrder = -1;
    }

    if (!this._extendOrder) { return; }

    this._extending = new L.Draw.Polyline(this._poly._map, {
      newIcon: new L.DivIcon({
        iconSize: new L.Point(10, 10),
        className: 'leaflet-div-icon leaflet-editing-icon'
      }),
      shapeOptions: {
        color: '#c13104',
        weight: 4,
        opacity: 0.5
      },
      zIndexOffset: this.options.extensionZIndexOffset || 2000,
      snapDistance: 15,
      guideLayers: (this._snapper ? this._snapper._guides : null) || []
    });

    this._extending.enable();

    this._extending._currentLatLng = latLng;
    this._extending.addVertex(latLng);

    this._poly._map.fire('extend:start');
  },

  _onExtendStart: function() {
    if (this._extending && this._extending.enabled()) { return; }
    this._extendable = false;
  },

  _onExtendFinish: function(e) {

    this._extendable = true;

    if (!this._extendOrder) { return; }

    if (!(this._extending && this._extending.enabled())) { return; }

    var newVertices = e.layer.getLatLngs();
    newVertices.splice(0, 1);

    for (var i = 0, n = newVertices.length; i < n; i++) {
      if (this._extendOrder === 1) {
        this._poly.addLatLng(newVertices[i]);
      } else if (this._extendOrder === -1) {
        this._poly.spliceLatLngs(0, 0, newVertices[i]);
      }
    }

    this.updateMarkers();
    this._clearExtension();
  },

  _clearExtension: function() {
    if (this._extending) {
      if (this._extending.enabled()) {
        this._extending.disable();
      }

      this._poly._map.removeLayer(this._extending);

      delete this._extending;
      delete this._extendOrder;
    }
  },

	_onMarkerDbClick: function (e) {

    window.setTimeout( this._clear_h, 0 );

		var minPoints = L.Polygon && (this._poly instanceof L.Polygon) ? 4 : 3,
			marker = e.target;

		// If removing this point would create an invalid polyline/polygon don't remove
		if (this._poly._latlngs.length < minPoints) {
			return;
		}

		// remove the marker
		this._removeMarker(marker);

		// update prev/next links of adjacent markers
		this._updatePrevNext(marker._prev, marker._next);

		// remove ghost markers near the removed marker
		if (marker._middleLeft) {
			this._markerGroup.removeLayer(marker._middleLeft);
		}
		if (marker._middleRight) {
			this._markerGroup.removeLayer(marker._middleRight);
		}

		// create a ghost marker in place of the removed one
		if (marker._prev && marker._next) {
			this._createMiddleMarker(marker._prev, marker._next);

		} else if (!marker._prev) {
			marker._next._middleLeft = null;

		} else if (!marker._next) {
			marker._prev._middleRight = null;
		}

		this._fireEdit();
	},

	_updateIndexes: function (index, delta) {
		this._markerGroup.eachLayer(function (marker) {
			if (marker._index > index) {
				marker._index += delta;
			}
		});
	},

	_createMiddleMarker: function (marker1, marker2) {
		var latlng = this._getMiddleLatLng(marker1, marker2),
		    marker = this._createMarker(latlng),
		    onClick,
		    onDragStart,
		    onDragEnd;

		marker.setOpacity(0.6);

		marker1._middleRight = marker2._middleLeft = marker;

		onDragStart = function () {

      this._ignoreDragging = true;

			var i = marker2._index;

			marker._index = i;

			marker
          .off('click', this._check_later, this)
			    .off('click', onClick, this)
			    .on('dblclick', this._onMarkerDbClick, this)

			latlng.lat = marker.getLatLng().lat;
			latlng.lng = marker.getLatLng().lng;
			this._poly.spliceLatLngs(i, 0, latlng);
			this._markers.splice(i, 0, marker);

			marker.setOpacity(1);

			this._updateIndexes(i, 1);
			marker2._index++;
			this._updatePrevNext(marker1, marker);
			this._updatePrevNext(marker, marker2);

			this._poly.fire('editstart');
		};

		onDragEnd = function () {
      this._ignoreDragging = false;

			marker.off('dragstart', onDragStart, this);
			marker.off('dragend', onDragEnd, this);

			this._createMiddleMarker(marker1, marker);
			this._createMiddleMarker(marker, marker2);
		};

		onClick = function () {
			onDragStart.call(this);
			onDragEnd.call(this);
			this._fireEdit();
		};

		marker
        .on('click', this._check_later, this)
		    .on('click', onClick, this)
		    .on('dragstart', onDragStart, this)
		    .on('dragend', onDragEnd, this);

		this._markerGroup.addLayer(marker);
	},

	_updatePrevNext: function (marker1, marker2) {
		if (marker1) {
			marker1._next = marker2;
		}
		if (marker2) {
			marker2._prev = marker1;
		}
	},

	_getMiddleLatLng: function (marker1, marker2) {
		var map = this._poly._map,
		    p1 = map.project(marker1.getLatLng()),
		    p2 = map.project(marker2.getLatLng());

		return map.unproject(p1._add(p2)._divideBy(2));
	},

  // source code from leaflet-click_0.7
  _check_later: function(e) {

    var that = this;

    this._clear_h();
    this._h = window.setTimeout( check, 500 );

    function check() {
      if (!that._ignoreDragging) {
        that._onPolylineExtend(e);
      } else {
        that._ignoreDragging = false;
      }
    }
  },

  // source code from leaflet-click_0.7
  _clear_h: function () {
    if (this._h != null) {
      window.clearTimeout(this._h);
      this._h = null;
    }
  }
});

L.Polyline.addInitHook(function () {

	// Check to see if handler has already been initialized. This is to support versions of Leaflet that still have L.Handler.PolyEdit
	if (this.editing) {
		return;
	}

	if (L.Edit.Poly) {
		this.editing = new L.Edit.Poly(this);

		if (this.options.editable) {
			this.editing.enable();
		}
	}

	this.on('add', function () {
		if (this.editing && this.editing.enabled()) {
			this.editing.addHooks();
		}
	});

	this.on('remove', function () {
		if (this.editing && this.editing.enabled()) {
			this.editing.removeHooks();
		}
	});
});
