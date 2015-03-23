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
  });
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

    loadTiles(function () {
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
