// globals
var assignedTask = null;
var channelContext = null;
var bufferContext = null;


// constants
var CHUNK_SIZE = 128;

var CHUNKS = [
  [0,0,0],
  [1,0,0],
  [0,1,0],
  [1,1,0],
  [0,0,1],
  [1,0,1],
  [0,1,1],
  [1,1,1]
];

function setContexts(channel, buffer) {
  channelContext = channel;
  bufferContext = buffer;
}

function setTask(task) {
  task.selected = [];
  assignedTask = task;
  assignedTask.tiles = {};
}

///////////////////////////////////////////////////////////////////////////////
/// utils

function isSeed(segId) {
  return assignedTask.seeds.indexOf(segId) !== -1;
}

function isSelected(segId) {
  return assignedTask.selected.indexOf(segId) !== -1;
}

function clamp(val, min, max) {
  return Math.max(Math.min(val, max), min);
}

function rgbEqual(rgb1, rgb2) {
  return rgb1[0] === rgb2[0] && rgb1[1] === rgb2[1] && rgb1[2] === rgb2[2];
}

function rgbToSegId(rgb) {
  return rgb[0] + rgb[1] * 256 + rgb[2] * 256 * 256;
}

function segIdToRGB(segId) {
  var blue = Math.floor(segId / (256 * 256));
  var green = Math.floor((segId % (256 * 256)) / 256);
  var red = segId % 256;

  return [red, green, blue];
}

///////////////////////////////////////////////////////////////////////////////
/// classes
function Tile(id) {
  this.id = id;
  this.count = 0;
  this.segmentation = {};
  this.channel = {};
}

Tile.prototype.isComplete = function () {
  return this.count === 8; // 4 channel, 4 segmentation
};

function convertBase64ImgToImage(b64String, callback) {
  var imageBuffer = new Image();

  imageBuffer.onload = function () {
    callback(this);
  };

  imageBuffer.src = b64String;
}

Tile.prototype.load = function (data, type, x, y, callback) {
  var _this = this;

  var chunk = y * 2 + x;

  if (_this[type][chunk]) {
    return; // chunk already loaded or in queue
  }

  _this[type][chunk] = true; // mark it as being in progress

  tileLoadingQueue.push(function () {
    convertBase64ImgToImage(data, function (image) {
      // process image
      bufferContext.drawImage(image, 0, 0);
      _this[type][chunk] = bufferContext.getImageData(0, 0, CHUNK_SIZE, CHUNK_SIZE);
      _this.count++;

      if (_this.isComplete()) { // all tiles have been loaded
        callback(_this);
      }
    });
  });
};

// draw this tile in the 2d view and update the plane position in the 3d view
Tile.prototype.draw = function () {
  plane.position.z = -0.5 + (currentTile / 256);
  ThreeDViewRender();

  for (var i = 0; i < 4; i++) {
    var x = i % 2;
    var y = i < 2 ? 0 : 1;

    if (!this.isComplete()) {
      return;
    }

    var segData = this.segmentation[i];
    var targetData = this.channel[i];

    channelContext.putImageData(
      highlight(targetData, segData),
      x * CHUNK_SIZE,
      y * CHUNK_SIZE
    );
  }
};

// highlight the seeds and selected segments in the tile 2d view
function highlight(targetData, segData) {
  var copy = bufferContext.createImageData(CHUNK_SIZE, CHUNK_SIZE);
  copy.data.set(targetData.data);

  var copyPixels = copy.data;
  var segPixels = segData.data;

  var selected = assignedTask.selected;

  var selectedColors = selected.map(segIdToRGB);
  var seedColors = assignedTask.seeds.map(segIdToRGB);

  function getColor(buffer, startIndex) {
    return [buffer[startIndex], buffer[startIndex+1], buffer[startIndex+2]];
  }

  function setColor(buffer, startIndex, rgb) {
    overlay = [rgb[0] * 0.5, rgb[1] * 0.5, rgb[2] * 0.5];

    for (i = 0; i < 3; i++) {
      buffer[startIndex + i] = overlay[i] + buffer[startIndex + i] * 0.5;
    }
  }

  var seedColor = [0, 0, 255];
  var selectedColor = [0, 255, 0];

  for (var j = 0; j < segPixels.length; j += 4) {
    var rgb = getColor(segPixels, j);

    for (var k = 0; k < seedColors.length; k += 1) {
      if (rgbEqual(seedColors[k], rgb)) {
        setColor(copyPixels, j, seedColor);
      }
    }

    for (var k = 0; k < selectedColors.length; k += 1) {
      if (rgbEqual(selectedColors[k], rgb)) {
        setColor(copyPixels, j, selectedColor);
      }
    }
  }

  return copy;
}

// returns the the segment id located at the given x y position of this tile
Tile.prototype.segIdForPosition = function(x, y) {
  var chunkX = Math.floor(x / CHUNK_SIZE);
  var chunkY = Math.floor(y / CHUNK_SIZE);
  var chunkRelX = x % CHUNK_SIZE;
  var chunkRelY = y % CHUNK_SIZE;
  var data = this.segmentation[chunkY * 2 + chunkX].data;
  var start = (chunkRelY * CHUNK_SIZE + chunkRelX) * 4;
  var rgb = [data[start], data[start+1], data[start+2]];
  return rgbToSegId(rgb);
};

// image operations

// perform the 2d and 3d interactions when selecting a segment
// by default, this will toggle the highlighting of the segment in 2d view,
// the visibility of the segment in 3d view, and the presence of the segment in the selected list (for submission)

function selectSegId(segId) {
  assignedTask.selected.push(segId);
  assignedTask.tiles[currentTile].draw();
  displayMeshForVolumeAndSegId(assignedTask.segmentation_id, segId);
}

function deselectSegId(segId) {
  var selectedIdx = assignedTask.selected.indexOf(segId);
  assignedTask.selected.splice(selectedIdx, 1);

  assignedTask.tiles[currentTile].draw();
  THREEDViewRemoveSegment(segId);
}

function toggleSegId(segId) {
  if (segId === 0 || isSeed(segId)) {
    return; // it a segment border or a seed
  }

  if (isSelected(segId)) {
    deselectSegId(segId);
  } else {
    selectSegId(segId);
  }
}

///////////////////////////////////////////////////////////////////////////////
/// loading 2d image data

function loadTilesForAxis(axis, startingTile, callback) {
  for (var i = 0; i < 256; i++) {
    assignedTask.tiles[i] = new Tile(i);
  }

  for (var i = 0; i < 4; i++) {
    var chunk = CHUNKS[i];
    getStartingTiles(startingTile, 1, assignedTask.channel_id, chunk, axis, 'channel', callback);
    getStartingTiles(startingTile, 1, assignedTask.segmentation_id, chunk, axis, 'segmentation', callback);
  }

  for (var i = 0; i < 4; i++) {
    var chunk = CHUNKS[i];
    getStartingTiles(startingTile, 32, assignedTask.channel_id, chunk, axis, 'channel', callback);
    getStartingTiles(startingTile, 32, assignedTask.segmentation_id, chunk, axis, 'segmentation', callback);
  }

  CHUNKS.forEach(function(chunk) {
    getImagesForVolXY(assignedTask.channel_id, chunk, axis, 'channel', callback);
    getImagesForVolXY(assignedTask.segmentation_id, chunk, axis, 'segmentation', callback);
  });
}

// get tiles around the starting tile
function getStartingTiles(realTileNum, bundleSize, volId, chunk, axis, type, callback) {
  var chunkTile = realTileNum % CHUNK_SIZE;
  var chunkZ = Math.floor(realTileNum / CHUNK_SIZE);
  var start = clamp(chunkTile - Math.floor(bundleSize / 2), 0, CHUNK_SIZE - bundleSize);
  var range = [start, start + bundleSize];
  var url = "http://cache.eyewire.org/volume/" + volId + "/chunk/0/" + chunk[0] + "/" + chunk[1] + "/" + chunkZ + "/tile/" + axis + "/" + range[0] + ":" + range[1];

  $.get(url).done(function (tilesRes) {
    for (var trIdx = 0; trIdx < tilesRes.length; trIdx++) {
      var realTileNum = chunkZ * CHUNK_SIZE + range[0] + trIdx;

      assignedTask.tiles[realTileNum].load(tilesRes[trIdx].data, type, chunk[0], chunk[1], callback);
    }
  });
}

// load all the tiles for the given axis in the given chunk of the given type
// ex. load all the segmentation tiles in chunk (0, 0, 0) for the 'z' axis (x/y plane)
function getImagesForVolXY(volId, chunk, axis, type, callback) {
  var url = "http://cache.eyewire.org/volume/" + volId + "/chunk/0/" + chunk[0] + "/" + chunk[1] + "/" + chunk[2] + "/tile/" + axis + "/" + 0 + ":" + CHUNK_SIZE;
  $.get(url).done(function (tilesRes) {
    for (var trIdx = 0; trIdx < tilesRes.length; trIdx++) {
      var realTileNum = chunk[2] * CHUNK_SIZE + trIdx;

      assignedTask.tiles[realTileNum].load(tilesRes[trIdx].data, type, chunk[0], chunk[1], callback);
    }
  });
}


// initialize canvases
var channelCanvas = document.getElementById("channelCanvas");
var bufferCanvas = document.getElementById("bufferCanvas");

// prevents dragging the 2d view image
channelCanvas.onselectstart = function () { return false; };

setContexts(
  channelCanvas.getContext("2d"),
  bufferCanvas.getContext("2d")
);

var mouseX = 0, mouseY = 0;

///////////////////////////////////////////////////////////////////////////////
/// interacting with task

function register2dInteractions() {
  $(document).keypress(function(e) {
    if (e.which === 119) { // w key
      currentTile -= 1;
    } else if (e.which === 115) { // s key
      currentTile += 1;
    }

    currentTile = clamp(currentTile, 1, 254);
    assignedTask.tiles[currentTile].draw();
  });

  $(channelCanvas).click(function (e) {
    var parentOffset = $(this).offset();
    var relX = e.pageX - parentOffset.left;
    var relY = e.pageY - parentOffset.top;

    var tile = assignedTask.tiles[currentTile];

    if (tile.isComplete()) {
      var segId = tile.segIdForPosition(relX, relY);
      toggleSegId(segId);
    }
  });
}


///////////////////////////////////////////////////////////////////////////////
/// 3d code

var meshes = {};

var renderer = new THREE.WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true,
  alpha: false,
});
renderer.setDepthTest(false);
scene = new THREE.Scene();
setScene();
var threeDContainer = $('#3dContainer');

renderer.setSize(threeDContainer.width(), threeDContainer.height());
threeDContainer.html(renderer.domElement);

// THREEJS objects
var scene, camera, light, segments, cube, center, plane;

// Rotate an object around an arbitrary axis in world space
function rotateAroundWorldAxis(object, axis, radians) {
    var rotWorldMatrix = new THREE.Matrix4();
    rotWorldMatrix.makeRotationAxis(axis.normalize(), radians);

    rotWorldMatrix.multiply(object.matrix);                // pre-multiply

    object.matrix = rotWorldMatrix;
    object.rotation.setFromRotationMatrix(object.matrix);
}

function setScene() {
  camera = new THREE.PerspectiveCamera(
    60, // Field of View (degrees)
    1, // Aspect ratio (set later)
    1, // Inner clipping plane
    100 // Far clipping plane
  );
  camera.position.set(0, 0, 1.8);
  camera.up.set(0, 1, 0);

  center = new THREE.Vector3(0,0,0);

  camera.lookAt(center);

  var mesh = new THREE.Mesh( new THREE.BoxGeometry( 1, 1, 1 ), new THREE.MeshNormalMaterial() );
  cube = new THREE.BoxHelper( mesh );
  cube.material.color.set( 0x555555 );

  viewport = new THREE.Object3D();
  segments = new THREE.Object3D();

  light = new THREE.DirectionalLight(0xffffff);

  var planeGeo = new THREE.PlaneBufferGeometry( 1, 1, 1 );

  var material = new THREE.MeshBasicMaterial( {color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.2} );
  plane = new THREE.Mesh( planeGeo, material );

  cube.add(plane);

  var xAxis = new THREE.Vector3(1,0,0);
  rotateAroundWorldAxis(cube, xAxis, Math.PI / 2);

  scene.add(cube);
  cube.add(segments);
  scene.add(light);
  scene.add(camera);
}

$("#3dContainer canvas").mousemove(function (e) {
  var jThis = $(this);
  var parentOffset = jThis.offset();
  var relX = e.pageX - parentOffset.left;
  var relY = e.pageY - parentOffset.top;

  mouseX = relX / jThis.width() - 0.5;
  mouseY = relY / jThis.height() - 0.5;
});


// flags for energy efficiency
var animating = false;
var canvasHasFocus = false;

$("#3dContainer canvas").mouseenter(function (e) {
  canvasHasFocus = true;
  if (!animating) {
    animating = true;
    requestAnimationFrame(animate);
  }
})
.mouseout(function () {
  canvasHasFocus = false;
});

// rotates the cube based on mouse position
function animate() {
  var dx = (4 * mouseX - camera.position.x) * 0.05;
  var dy = (-4 * mouseY - camera.position.y) * 0.05;

  if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
    ThreeDViewRender(dx, dy);
    requestAnimationFrame(animate);
  }
  else if (canvasHasFocus) {
    requestAnimationFrame(animate);
  }
  else {
    animating = false;
  }
}

// rerenders the 3d world
function ThreeDViewRender(dx, dy) {
  dx = (dx === undefined) ? 0 : dx;
  dy = (dy === undefined) ? 0 : dy;

  camera.position.x += dx;
  camera.position.y += dy;
  camera.lookAt(center);

  light.position.set(camera.position.x, camera.position.y, camera.position.z);

  renderer.render(scene, camera);
}

// adds the segment to the 3d world
function ThreeDViewAddSegment(segId) {
  segments.add(meshes[segId]);
}

// removes the segment from the 3d world and instantly rerenders
function THREEDViewRemoveSegment(segId) {
  segments.remove(meshes[segId]);
  ThreeDViewRender();
}

///////////////////////////////////////////////////////////////////////////////
/// loading 3d mesh data

// loads the mesh for the given segment in the given volume. Calls the done handler
// when the mesh is ready for display. If the mesh is selected or is a seed, it
// displays the segment.
function displayMeshForVolumeAndSegId(volume, segId, done) {
  var doneWrapper = function () {
    if (done) {
      done();
    }
    ThreeDViewRender();
  };

  if (meshes[segId]) {
    ThreeDViewAddSegment(segId);
    doneWrapper();
  } else {
    var segmentMesh = new THREE.Object3D();
    meshes[segId] = segmentMesh;

    var count = CHUNKS.length; // ensure that we have a response for each chunk

    CHUNKS.forEach(function(chunk) {
      getMeshForVolumeXYZAndSegId(volume, chunk, segId, function (mesh) {
        count--;
        if (mesh) {
          segmentMesh.add(mesh);
        }
        if (count === 0) {
          segmentMesh.position.set(-0.5, -0.5, -0.5); // since the vertexes are from 0 to 1, we want to center around 0

          if (isSelected(segId) || isSeed(segId)) {
            ThreeDViewAddSegment(segId);
          }

          doneWrapper();
        }
      });
    });
  }
}

// loads the VOA mesh for the given segment in the given chunk from the EyeWire data server into a Three JS mesh.
// passes the mesh to the done handler as a single argument or passes false if there is no mesh for the given segment in the chunk
function getMeshForVolumeXYZAndSegId(volume, chunk, segId, done) {
  var meshUrl = 'http://cache.eyewire.org/volume/' + volume + '/chunk/0/'+ chunk[0] + '/' + chunk[1] + '/' + chunk[2] + '/mesh/' + segId;

  var req = new XMLHttpRequest();
  req.open("GET", meshUrl, true);
  req.responseType = "arraybuffer";

  req.onload = function (event) {
    var data = req.response;

    if (data) {
      var mesh = new THREE.Segment(
        new Float32Array(data),
        new THREE.MeshLambertMaterial({
          color: isSeed(segId) ? 'blue' : 'green'
        })
      );

      done(mesh);
    } else {
      done(false);
    }
  };

  req.send();
}





// start game
function waitForAll(asyncFunctions, done) {
  var count = asyncFunctions.length;

  asyncFunctions.forEach(function (f) {
    f(function () {
      count--;

      if (count === 0) {
        done();
      }
    });
  });
}


var currentTile;
var tileLoadingQueue = [];

// load all the tiles for the assigned task
function loadTiles(done) {
  var tileCount = 0;

  var startingTile = assignedTask.startingTile;
  currentTile = startingTile;

  function loadTilesNicely() {
    for (var i = 0; i < 8; i++) {
      var load = tileLoadingQueue.shift();
      if (load) {
        load();
      }
    }

    if (tileCount < 256) {
      // continue to check for more tiles
      requestAnimationFrame(loadTilesNicely);
    }
  }
  requestAnimationFrame(loadTilesNicely);

  loadTilesForAxis('xy', startingTile, function (tile) {
    tileCount++;

    if (tile.id === startingTile) {
      loadedStartingTile = true;
      tile.draw();
      $('#channelCanvas').show();

      register2dInteractions();
    }

    if (tileCount === 256) {
      done();
    }
  });

  ThreeDViewRender();
}

function loadSeedMeshes(done) {
  var seedsLoaded = 0;
  assignedTask.seeds.forEach(function (segId) {
    displayMeshForVolumeAndSegId(assignedTask.segmentation_id, segId, function () {
      seedsLoaded++;
      if (seedsLoaded === assignedTask.seeds.length) {
        done();
      }
    });
  });
}

function loadTaskData(done) {
  waitForAll([
    loadTiles,
    loadSeedMeshes
  ], done);
}

function playTask(task) {
  setTask(task);

  $('#loadingText').show();

  var loadingIndicator = setInterval(function () {
    $('#loadingText').html($('#loadingText').html() + '.');
  }, 2000);

  loadTaskData(function () {
    console.log('we are done loading!');
    clearInterval(loadingIndicator);
    $('#loadingText').hide();
    $('#3dContainer').show();

    $('#submitTask').click(function () {
      var url = 'https://beta.eyewire.org/2.0/tasks/' + assignedTask.id + '/testsubmit';
      $.post(url, 'status=finished&segments=' + assignedTask.selected.join()).done(function (res) {
        $('#results').html('score ' + res.score + ', accuracy ' + res.accuracy + ', trailblazer ' + res.trailblazer);
      });
    });
  });
}

function start() {
  $.post('https://beta.eyewire.org/2.0/tasks/testassign').done(playTask);
}
start();
