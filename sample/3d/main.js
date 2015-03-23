var channelCanvas = document.getElementById("channelCanvas");
var segCanvas = document.getElementById("segCanvas");
var bufferCanvas = document.getElementById("bufferCanvas");

// prevents dragging the 2d view
channelCanvas.onselectstart = function () { return false; };

setContexts(
  channelCanvas.getContext("2d"),
  segCanvas.getContext("2d"),
  bufferCanvas.getContext("2d")
);

var currentTile;

function waitForAll(asyncFunctions, done) {
  var count = asyncFunctions.length;

  var mydone = done;

  asyncFunctions.forEach(function (f) {
    f(function () {
      count--;

      if (count === 0) {
        mydone();
      }
    });
  });
}

function loadTiles(done) {
  var tileCount = 0;

  // use z as the vertical axis and load tiles for the xy axis
  recenterDim('z', function () {
    loadTilesForAxis('xy', function (tile) {
      tileCount++;

      if (tile.id === currentTile) {
        tile.draw();
      }

      if (tileCount === 256) {
        done();
      }
    });

    ThreeDViewRender();
  });
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

///////////////////////////////////////////////////////////////////////////////
/// buttons, assignment and submission
$('#playButton').click(function () {

  $.post('https://beta.eyewire.org/2.0/tasks/testassign').done(function (task) {
    setTask(task);

    console.log('loaded');

    $('#loadingText').show();

    var loadingIndicator = setInterval(function () {
      $('#loadingText').html($('#loadingText').html() + '.');
    }, 2000);

    loadTaskData(function () {
      console.log('we are done loading!');

      clearInterval(loadingIndicator);
      $('#loadingText').hide();

      $('#channelCanvas').show();
      $('#3dContainer').show();
    });
  });
});

$('#submitTask').click(function () {
  var url = 'https://beta.eyewire.org/2.0/tasks/' + assignedTask.id + '/testsubmit';
  $.post(url, 'status=finished&segments=' + assignedTask.selected.join()).done(function (res) {
    $('#results').html('score ' + res.score + ', accuracy ' + res.accuracy + ', trailblazer ' + res.trailblazer);
  });
});

///////////////////////////////////////////////////////////////////////////////
/// interacting with task
$(document).keypress(function(e) {
  if (e.which === 106) { // j key
    currentTile -= 1;
  } else if (e.which === 107) { // h key
    currentTile += 1;
  }

  currentTile = clamp(currentTile, 1, 254);
  assignedTask.tiles[currentTile].draw();
});

$(channelCanvas).click(function (e) {
  var parentOffset = $(this).offset();
  var relX = e.pageX - parentOffset.left;
  var relY = e.pageY - parentOffset.top;

  var segId = assignedTask.tiles[currentTile].segIdForPosition(relX, relY); // TODO, need to separate current displayed vs requested
  toggleSegId(segId);
});


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
}

function THREEDViewRemoveSegment(segId) {
  segments.remove(meshes[segId]);
  ThreeDViewRender();
}

///////////////////////////////////////////////////////////////////////////////
/// loading mesh data
function displayMeshForVolumeAndSegId(volume, segId, done) {
  if (meshes[segId]) {
    ThreeDViewAddSegment(segId);
    if (done) { done(); }
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

          if (done) { done(); }
        }
      });
    }
  }
}

function getMeshForVolumeXYZAndSegId(volume, x, y, z, segId, callback) {
  var meshUrl = 'http://data.eyewire.org/volume/' + volume + '/chunk/0/'+ x + '/' + y + '/' + z + '/mesh/' + segId;
  $.binaryGet(meshUrl, function (data, error) {
    if (data) {
      var mesh = new THREE.Segment(
        new Float32Array(data),
        new THREE.MeshPhongMaterial({
          color: isSeed(segId) ? 'blue' : 'green'
        })
      );

      callback(mesh);
    } else {
      console.log('No mesh for ', volume, segId);
    }
  });
}
