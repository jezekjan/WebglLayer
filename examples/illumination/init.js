function visualize(data) {
  console.log(data.num);
  WGL.init(data.num, '../../','map', true);

  // register movezoom event
  map.on("move", onMove);
  
  // resize window
  window.onresize = function(){
    WGL.getManager().updateMapSize();
    WGL.mcontroller.resize();
    $("#webglayer").css("display","none");
    onMove();
  };

  const heatmap = WGL.addHeatMapDimension(data.pts, 'heatmap');
  heatmap.radiusFunction = function (r, z) {
    return r*(z/10);
  };
  heatmap.setRadius(30);
  heatmap.renderIllumination(true);

  WGL.addExtentFilter();
  WGL.colorSchemes.setSchemeSelected('fire');

  let idt = WGL.addIdentifyDimension(data.pts, data.pts_id, 'idt', '../birmingham/data/identify/');
  idt.enabled = true;
  pw = new WGL.ui.PopupWin(".mapboxgl-canvas", "idt", "Accident Details");
  pw.setProp2html(function (t) {
    const d =  (new Date(t["timestamp"]*1000));
    const weekarray = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri","Sat"];
    const wd = weekarray[d.getDate()];
    const sev = data.sevEnum[t["accident_severity"]-1];
    const rt = data.rtEnum[t["road_type"]];
    //speed_limit

    let s = "<table>";
    s += "<tr><td width='100px'>Date: </td><td>"+d.toDateString()+"</td></tr>";
    s += "<tr><td>Time: </td><td>"+d.toLocaleTimeString()+"</td></tr>";
    s += "<tr><td>Severity: </td><td>"+sev+"</td></tr>";
    s += "<tr><td>Road Type: </td><td>"+rt+"</td></tr>";
    s += "<tr><td>Speed Limit: </td><td>"+t["speed_limit"]+"</td></tr>";
    return s;
  });
  pw.setMovemap(function (dx, dy) {
    let c = map.getCenter();
    const cpx = map.project(c);
    cpx.x -= dx;
    cpx.y -= dy;
    map.setCenter(map.unproject(cpx));
  });
  map.on("move", function () {
    pw.zoommove(map.getZoom()+1, getTopLeftTC());
  });

  
  $("#webglayer").css("z-index","1");
  $("#webglayer").css("display","none");

  const layer = {
    "id": "canvas",
    "source": "canvas",
    "type": "raster",
    "paint": { 'raster-fade-duration': 0 }
  };

  const layers = map.getStyle().layers;
  // Find the index of the first symbol layer in the map style
  let firstSymbolId;
  for (let i = 0; i < layers.length; i++) {
    if (layers[i].type === 'symbol') {
      firstSymbolId = layers[i].id;
      break;
    }
  }
  const map_source = {
    "type": 'canvas',
    "canvas": 'webglayer',
    "coordinates": [
      [-12, 60],
      [2, 60],
      [2, 50],
      [-12, 50]
    ],
    "animate": true
  };
  map.addSource("canvas", map_source);
  map.addLayer(layer, firstSymbolId);

  onMove();

  // sliders

  $('input#sl_alpha').on('input', function () {
    //console.log($(this).val());
    heatmap.renderer2.ph_alpha = $(this).val()/100.0;
    onMove();
  });//
  $('input#sl_ambient').on('input', function () {
    //console.log($(this).val());
    heatmap.renderer2.ph_ambient = $(this).val()/100.0;
    onMove();
  });
  $('input#sl_materialShininess').on('input', function () {
    //console.log($(this).val());
    heatmap.renderer2.ph_materialShininess = $(this).val()/20.0;
    onMove();
  });
  function slideAngle(value) {
    //console.log(value);
    const rad = (-(value - 90))/180*3.1415926535;
    const x = Math.cos(rad);
    const y = Math.sin(rad);
    const h = heatmap.renderer2.ph_lightDir[2];
    heatmap.renderer2.ph_lightDir = [x, y, h];
    onMove();
  }
  $('input#sl_height').on('input', function () {
    heatmap.renderer2.ph_lightDir[2] = $(this).val()/10.0;
    onMove();
  });



  $('#slider').CircularSlider({
    radius: 113, // default radius
    innerCircleRatio: '0.5',
    handleDist : 100,
    min : 0, // min value
    max: 359, // max value
    clockwise: true, // false = counterclockwise
    value : 0, // default vale
    labelPrefix: "", // label text
    labelSuffix: "", // label text
    shape: "Circle", // circle, Half Circle, Half Circle Right, Half Circle Left, KPH
    touch: true, // enable touch events
    animate: true, // linear animation support
    animateDuration: 50, // <a href="https://www.jqueryscript.net/animation/">Animation</a> duration in milliseconds
    selectable: false,
    slide : function(value) {slideAngle(parseInt(value[0].textContent))}, // event to be fired on slide w.fn.init.a.fn.CircularSlider
    onSlideEnd: function(ui, value) {},
    formLabel: undefined // for image carousel
  });
}

/**
 * Compute coordinates of top-left conner in zero level pixel
 * for MapBox JS GL API
 * Note: zoom = mapbox_zoom + 1 !!!!
 * @returns {{x: number, y: number}}
 */
function getTopLeftTC() {
  const ZERO_PIX_3857_COEF = 128/20037508.34;
  const z = map.getZoom() + 1;
  const scale = Math.pow(2, z);
  const dx = WGL.getManager().w/2/scale;
  const dy = WGL.getManager().h/2/scale;

  const TL3857_ZERO = {x: -20037508.34, y: 20037508.34};
  const c = map.getCenter();

  const proj = new SphericalMercator.SphericalMercator();
  const center_3857 = proj.forward([c.lng, c.lat]);

  return {
    x: (center_3857[0] - TL3857_ZERO.x)*ZERO_PIX_3857_COEF - dx,
    y: (-center_3857[1] + TL3857_ZERO.y)*ZERO_PIX_3857_COEF - dy
  };
}
	
function onMove() {
  const z = map.getZoom() + 1;
  WGL.mcontroller.zoommove(z, getTopLeftTC());
  modifyCanvasCor();
}

function modifyCanvasCor(){
  const b = map.getBounds();
  let cor = [];
  cor[0] = [b._sw.lng, b._ne.lat];
  cor[1] = [b._ne.lng, b._ne.lat];
  cor[2] = [b._ne.lng, b._sw.lat];
  cor[3] = [b._sw.lng, b._sw.lat];
  let canvas_source = map.getSource('canvas');
  canvas_source.setCoordinates(cor);
  canvas_source.play();
  canvas_source.prepare();
  canvas_source.pause();
}
	
	
	