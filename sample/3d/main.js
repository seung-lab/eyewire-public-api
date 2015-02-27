var channelCanvas = document.getElementById("channelCanvas");
channelCanvas.onselectstart = function () { return false; };
var channelContext = channelCanvas.getContext("2d");

var segCanvas = document.getElementById("segCanvas");
var segContext = segCanvas.getContext("2d");

var bufferCanvas = document.getElementById("bufferCanvas");
var bufferContext = bufferCanvas.getContext("2d");

var currentTile, assignedTask;
var tiles = {};

var meshes = {};

var CHUNK_SIZE = 128;

///////////////////////////////////////////////////////////////////////////////
/// assignment and submission
$('#playButton').click(function () {
  $.post('http://beta.eyewire.org/2.0/tasks/assign').done(playTask);
});

$('#submitTask').click(function () {
  var url = 'http://beta.eyewire.org/2.0/tasks/' + assignedTask.id + '/save?status=finished&segments=' + assignedTask.selected.join();
  $.post(url).done(function (res) {
    $('#results').html('score ' + res.score + ', accuracy ' + res.accuracy + ', trailblazer ' + res.trailblazer)
  });
});

function playTask(task) {
  tiles = {};
  assignedTask = task;
  assignedTask.selected = [];

  for (var i = 0; i < task.seeds.length; i++) {
    var segId = task.seeds[i];
    displayMeshForVolumeAndSegId(task.segmentation_id, segId);
  };

  // use z as the vertical axis and load tiles for the xy axis
  recenterDim('z', function () {
    loadTilesForAxis('xy', function (tile) {
      if (tile.id === currentTile) {
        tile.draw();
      }
    });

    ThreeDViewRender();
  });
};

// recenterDim sets the starting tile for a task.
// it gets a bounding box for the seed pieces using the merge_metadata endpoint
// and calculates a tile correlating to the edge of the bounding box closest to the edge of the task
function recenterDim(dim, callback) {
  var bounds = new Bbox(assignedTask.channel.bounds);
  var center = bounds.getCenter();

  $.post('http://data.eyewire.org/volume/' + assignedTask.segmentation_id + '/segment/merge_metadata', {
    segments: assignedTask.seeds
  }, function (data) {
    if ((data.bbox.min[dim] - bounds.min[dim]) < (bounds.max[dim] - data.bbox.max[dim])) {
      center[dim] = Math.max(data.bbox.min[dim] + 2, bounds.min[dim] + 2);
    }
    else {
      center[dim] = Math.min(data.bbox.max[dim] - 2, bounds.max[dim] - 2);
    }

    currentTile = center[dim] - bounds.min[dim];
    callback();
  }, 'json');
};

///////////////////////////////////////////////////////////////////////////////
/// loading data
function loadTilesForAxis(axis, callback) {
  for (var i = 0; i < 256; i++) {
    tiles[i] = new Tile(i);
  }

  for (var i = 0; i < 8; i++) {
    var x = i % 2;
    var y = i % 4 > 1 ? 1 : 0;
    var z = i < 4 ? 0 : 1;

    getImagesForVolXY(assignedTask.channel_id, x, y, z, axis, 'channel', callback);
    getImagesForVolXY(assignedTask.segmentation_id, x, y, z, axis, 'segmentation', callback);
  };
}

function getImagesForVolXY(volId, x, y, z, axis, type, callback) {
  var url = "http://data.eyewire.org/volume/" + volId + "/chunk/0/" + x + "/" + y + "/" + z + "/tile/" + axis + "/" + 0 + ":" + CHUNK_SIZE;
  $.get(url).done(function (tilesRes) {
    for (var trIdx = 0; trIdx < tilesRes.length; trIdx++) {
      var realTileNum = z * CHUNK_SIZE + trIdx;

      tiles[realTileNum].load(tilesRes[trIdx].data, type, x, y, callback);
    };
  });
};

///////////////////////////////////////////////////////////////////////////////
/// interacting with task
$(document).keypress(function(e) {
  if (e.which === 106) { // j key
    currentTile -= 1;
  } else if (e.which === 107) { // h key
    currentTile += 1;
  }

  currentTile = clamp(currentTile, 1, 254)
  tiles[currentTile].draw();
});

$(channelCanvas).click(function (e) {
  var parentOffset = $(this).offset();
  var relX = e.pageX - parentOffset.left;
  var relY = e.pageY - parentOffset.top;

  var segId = tiles[currentTile].segIdForPosition(relX, relY); // TODO, need to separate current displayed vs requested

  if (segId === 0) { // is it a segment border
    return;
  }

  var selectedIdx = assignedTask.selected.indexOf(segId);
  var seedsIdx = assignedTask.seeds.indexOf(segId);

  if (selectedIdx === -1) { // is it not selected
    if (seedsIdx === -1) { // and not a seed
      assignedTask.selected.push(segId); // select it
      displayMeshForVolumeAndSegId(assignedTask.segmentation_id, segId);
    }
  } else {
    assignedTask.selected.splice(selectedIdx, 1); // unselect it
    THREEDViewRemoveSegment(segId);
  }

  $('#selected').html(assignedTask.selected.join());
  tiles[currentTile].draw();
});

///////////////////////////////////////////////////////////////////////////////
/// utils
function clamp(val, min, max) {
  return Math.max(Math.min(val, max), min);
};

function rgbEqual(rgb1, rgb2) {
  return rgb1[0] === rgb2[0] && rgb1[1] === rgb2[1] && rgb1[2] === rgb2[2];
};

function rgbToSegId(rgb) {
  return rgb[0] + rgb[1] * 256 + rgb[2] * 256 * 256;
};

function segIdToRGB(segId) {
  var blue = Math.floor(segId / (256 * 256));
  var green = Math.floor((segId % (256 * 256)) / 256);
  var red = segId % 256;

  return [red, green, blue];
};

///////////////////////////////////////////////////////////////////////////////
/// classes
function Tile(id) {
  this.id = id;
  this.count = 0;
  this.segmentation = {};
  this.channel = {};
};

Tile.prototype.isComplete = function () {
  this.count === 8; // 4 channel, 4 segmentation
};

function convertBase64ImgToImage(b64String, callback) {
  var imageBuffer = new Image();

  imageBuffer.onload = function () {
    callback(this);
  };

  imageBuffer.src = b64String;
};

Tile.prototype.load = function (data, type, x, y, callback) {
  var _this = this;

  convertBase64ImgToImage(data, function (image) {
    // process image
    bufferContext.drawImage(image, 0, 0);
    _this[type][y * 2 + x] = bufferContext.getImageData(0, 0, CHUNK_SIZE, CHUNK_SIZE);
    _this.count++;

    if (_this.count === 8) { // all tiles have been loaded
      callback(_this);
    }
  });
};

Tile.prototype.draw = function () {
  for (var i = 0; i < 4; i++) {
    var x = i % 2;
    var y = i < 2 ? 0 : 1;

    if (this.count < 8) {
      console.error('we are low on count!', this.count);
    }

    var segData = this.segmentation[i];
    var targetData = this.channel[i];

    channelContext.putImageData(
      highlight(targetData, segData),
      x * CHUNK_SIZE,
      y * CHUNK_SIZE
    );

    segContext.putImageData(
      highlight(segData, segData),
      x * CHUNK_SIZE,
      y * CHUNK_SIZE
    );
  };
};

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

// highlight the seeds and selected segments in the tile 2d view
function highlight(targetData, segData) {
  var copy = bufferContext.createImageData(CHUNK_SIZE, CHUNK_SIZE);
  copy.data.set(targetData.data);

  var copyPixels = copy.data;
  var segPixels = segData.data;

  var selectedColors = assignedTask.selected.map(segIdToRGB);
  var seedColors = assignedTask.seeds.map(segIdToRGB);

  function getColor(buffer, startIndex) {
    return [buffer[startIndex], buffer[startIndex+1], buffer[startIndex+2]];
  };

  function setColor(buffer, startIndex, rgb) {
    buffer[startIndex] = rgb[0];
    buffer[startIndex + 1] = rgb[1];
    buffer[startIndex + 2] = rgb[2];
  };

  for (var j = 0; j < segPixels.length; j += 4) {
    var rgb = getColor(segPixels, j);

    for (var k = 0; k < seedColors.length; k += 1) {
      if (rgbEqual(seedColors[k], rgb)) {
        setColor(copyPixels, j, [0, 0, 255]);
      };
    };

    for (var k = 0; k < selectedColors.length; k += 1) {
      if (rgbEqual(selectedColors[k], rgb)) {
        setColor(copyPixels, j, [0, 255, 0]);
      };
    };
  };

  return copy;
};
















///////////////////////////////////////////////////////////////////////////////
/// 3d code

var renderer = new THREE.WebGLRenderer({
  antialias: true,
  preserveDrawingBuffer: true,
  alpha: false,
});
renderer.setDepthTest(false);
scene = new THREE.Scene();
setScene();
renderer.setSize( 500, 500 );

$('#3dContainer').html(renderer.domElement);

// THREEJS objects
var scene, camera, light, segments, cube;

function setScene() {
  camera = new THREE.PerspectiveCamera(
    60, // Field of View (degrees)
    1, // Aspect ratio (set later)
    1, // Inner clipping plane
    100 // Far clipping plane
  );
  camera.position.set(-1, -0.6, -2);
  camera.up.set(0, -1, 0);
  camera.lookAt(new THREE.Vector3(0,0,0));

  var _wireframe_material = new THREE.MeshBasicMaterial({
    opacity: 0.1,
    wireframe: true,
    transparent: true,
  });

  cube = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), _wireframe_material);
  viewport = new THREE.Object3D();
  segments = new THREE.Object3D();

  light = new THREE.DirectionalLight(0xffffff);
  light.position.set(camera.position.x, camera.position.y, camera.position.z);


  scene.add(cube);
  cube.add(segments);
  scene.add(light);
  scene.add(camera);
}

function ThreeDViewRender() {
  renderer.render(scene, camera);
}

function ThreeDViewAddSegment(segId) {
  segments.add(meshes[segId]);
  ThreeDViewRender();
};

function THREEDViewRemoveSegment(segId) {
  segments.remove(meshes[segId]);
  ThreeDViewRender();
};

function isSeed(segId) {
  return assignedTask.seeds.indexOf(segId) !== -1;
}

function isSelected(segId) {
  return assignedTask.selected.indexOf(segId) !== -1
}

///////////////////////////////////////////////////////////////////////////////
/// loading mesh data
function displayMeshForVolumeAndSegId(volume, segId) {
  if (meshes[segId]) {
    ThreeDViewAddSegment(segId);
  } else {
    var segmentMesh = new THREE.Object3D();
    meshes[segId] = segmentMesh;

    var count = 0;

    for (var i = 0; i < 8; i++) {
      var x = i % 2;
      var y = i % 4 < 2 ? 0 : 1;
      var z = i < 4 ? 0 : 1;

      getMeshForVolumeXYZAndSegId(volume, x, y, z, segId, function (mesh) {
        segmentMesh.add(mesh);

        count++;
        if (count === 8) {
          segmentMesh.position.set(-0.5, -0.5, -0.5); // since the vertexes are from 0 to 1, we want to center around 0

          if (isSelected(segId) || isSeed(segId)) {
            ThreeDViewAddSegment(segId);
          }
        }
      });
    };
  }
};

function getMeshForVolumeXYZAndSegId(volume, x, y, z, segId, callback) {
  $.binaryGet('http://data.eyewire.org/volume/' + volume + '/chunk/0/'+ x + '/' + y + '/' + z + '/mesh/' + segId,
  function (data, error) {
    if (data) {
      var mesh = new THREE.Segment(
        new Float32Array(data),
        new THREE.MeshPhongMaterial({
          color: isSeed(segId) ? 'blue' : 'green'
        })
      );

      callback(mesh);
    } else {
      console.log('No mesh for ', volume, segId)
    }
  });
};
