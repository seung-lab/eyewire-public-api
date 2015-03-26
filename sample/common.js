// globals
var assignedTask = null;

var channelContext = null;
var segmentContext = null;
var bufferContext = null;


// constants
var CHUNK_SIZE = 128;

var CHUNKS = [
  [0,0,0],
  [0,0,1],
  [0,1,0],
  [0,1,1],
  [1,0,0],
  [1,0,1],
  [1,1,0],
  [1,1,1]
];

function setContexts(channel, segment, buffer) {
  channelContext = channel;
  segmentContext = segment;
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

    segmentContext.putImageData(
      highlight(segData, segData),
      x * CHUNK_SIZE,
      y * CHUNK_SIZE
    );
  }
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

// image operations

// perform the 2d and 3d interactions when selecting a segment
// by default, this will toggle the highlighting of the segment in 2d view,
// the visibility of the segment in 3d view, and the presence of the segment in the selected list (for submission)

function selectSegId(segId) {
  assignedTask.selected.push(segId);

  displayMeshForVolumeAndSegId(assignedTask.segmentation_id, segId);

  // update uis
  $('#selected').html(assignedTask.selected.join());
  assignedTask.tiles[currentTile].draw();
}

function unselectSegId(segId) {
  var selectedIdx = assignedTask.selected.indexOf(segId);
  assignedTask.selected.splice(selectedIdx, 1);

  THREEDViewRemoveSegment(segId);

  // update uis
  $('#selected').html(assignedTask.selected.join());
  assignedTask.tiles[currentTile].draw();
}

function toggleSegId(segId) {
  if (segId === 0 || isSeed(segId)) {
    return; // it a segment border or a seed
  }

  if (isSelected(segId)) {
    unselectSegId(segId);
  } else {
    selectSegId(segId);
  }
}

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
  }

  function setColor(buffer, startIndex, rgb) {
    buffer[startIndex] = rgb[0];
    buffer[startIndex + 1] = rgb[1];
    buffer[startIndex + 2] = rgb[2];
  }

  for (var j = 0; j < segPixels.length; j += 4) {
    var rgb = getColor(segPixels, j);

    for (var k = 0; k < seedColors.length; k += 1) {
      if (rgbEqual(seedColors[k], rgb)) {
        setColor(copyPixels, j, [0, 0, 255]);
      }
    }

    for (var k = 0; k < selectedColors.length; k += 1) {
      if (rgbEqual(selectedColors[k], rgb)) {
        setColor(copyPixels, j, [0, 255, 0]);
      }
    }
  }

  return copy;
}

// recenterDim sets the starting tile for a task.
// it gets a bounding box for the seed pieces using the merge_metadata endpoint
// and calculates a tile correlating to the edge of the bounding box closest to the edge of the task
function recenterDim(dim, callback) {
  var bounds = new Bbox(assignedTask.bounds);
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
}

///////////////////////////////////////////////////////////////////////////////
/// loading 2d image data
function loadTilesForAxis(axis, callback) {
  for (var i = 0; i < 256; i++) {
    assignedTask.tiles[i] = new Tile(i);
  }

  CHUNKS.forEach(function(chunk) {
    getImagesForVolXY(assignedTask.channel_id, chunk, axis, 'channel', callback);
    getImagesForVolXY(assignedTask.segmentation_id, chunk, axis, 'segmentation', callback);
  });
}

function getImagesForVolXY(volId, chunk, axis, type, callback) {
  var url = "http://data.eyewire.org/volume/" + volId + "/chunk/0/" + chunk[0] + "/" + chunk[1] + "/" + chunk[2] + "/tile/" + axis + "/" + 0 + ":" + CHUNK_SIZE;
  $.get(url).done(function (tilesRes) {
    for (var trIdx = 0; trIdx < tilesRes.length; trIdx++) {
      var realTileNum = chunk[2] * CHUNK_SIZE + trIdx;

      assignedTask.tiles[realTileNum].load(tilesRes[trIdx].data, type, chunk[0], chunk[1], callback);
    }
  });
}
