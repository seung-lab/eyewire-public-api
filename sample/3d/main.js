var channelCanvas = document.getElementById("channelCanvas");
var segCanvas = document.getElementById("segCanvas");
var bufferCanvas = document.getElementById("bufferCanvas");


var mouseX = 0, mouseY = 0;

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
var scene, camera, light, segments, cube, center;


function setScene() {
  camera = new THREE.PerspectiveCamera(
    60, // Field of View (degrees)
    1, // Aspect ratio (set later)
    1, // Inner clipping plane
    100 // Far clipping plane
  );
  camera.position.set(-1, -0.6, -2);
  camera.up.set(0, -1, 0);

  center = new THREE.Vector3(0,0,0);

  camera.lookAt(center);

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

  animate();
}

$("#3dContainer canvas").mousemove(function (e) {
  var jThis = $(this);
  var parentOffset = jThis.offset();
  var relX = e.pageX - parentOffset.left;
  var relY = e.pageY - parentOffset.top;

  mouseX = relX / jThis.width() - 0.5;
  mouseY = relY / jThis.height() - 0.5;
});

function animate() {
  var dx = (2 * mouseX - camera.position.x) * 0.05;
  var dy = (2 * mouseY - camera.position.y) * 0.05;

  if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) {
    ThreeDViewRender(dx, dy);
  }

  requestAnimationFrame(animate);
}

function ThreeDViewRender(dx, dy) {
  dx = (dx === undefined) ? 0 : dx;
  dy = (dy === undefined) ? 0 : dy;

  camera.position.x += dx;
  camera.position.y += dy;
  camera.lookAt(center);

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
/// loading 3d mesh data
function displayMeshForVolumeAndSegId(volume, segId, done) {
  if (meshes[segId]) {
    ThreeDViewAddSegment(segId);
    if (done) { done(); }
  } else {
    var segmentMesh = new THREE.Object3D();
    meshes[segId] = segmentMesh;

    var count = CHUNKS.length;

    CHUNKS.forEach(function(chunk) {
      getMeshForVolumeXYZAndSegId(volume, chunk, segId, function (mesh) {
        segmentMesh.add(mesh);
        count--;
        if (count === 0) {
          segmentMesh.position.set(-0.5, -0.5, -0.5); // since the vertexes are from 0 to 1, we want to center around 0

          if (isSelected(segId) || isSeed(segId)) {
            ThreeDViewAddSegment(segId);
          }

          if (done) { done(); }
        }
      });
    });
  }
}

var loader = new THREE.OBJLoader();

function getMeshForVolumeXYZAndSegId(volume, chunk, segId, done) {
  var meshUrl = 'https://beta.eyewire.org/2.0/data/mesh/' + volume + '/' + chunk[0] + '/' + chunk[1] + '/' + chunk[2] + '/' + segId;

  loader.load(meshUrl, function (geometry) {
    var material = new THREE.MeshLambertMaterial({
      color: isSeed(segId) ? 'blue' : 'green'
    });
    var mesh = new THREE.Mesh( geometry, material );
    done(mesh);
  });
}
