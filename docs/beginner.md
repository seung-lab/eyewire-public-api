Beginner's Guide to the EyeWire Api
===


##Sample Apps

We provide two very simple sample EyeWire apps; a 2d and 3d app. The 2d app is almost completely functional. The 3d version is very bare bones because depending on what direction you want to go, the code will be drastically different. What it does is show you how to access the 3d meshes and how to render them in one engine, [ThreeJS](http://threejs.org/).

[2D Sample App](../sample/2d/index.html)

[3D Sample App](../sample/3d/index.html)

The 2D and 3D sample apps share code in [common.js](../sample/common.js)

##Introduction
The EyeWire API handles two essential actions, assigning tasks and submitting the work completed for that task.

In order to simplify development, we allow playing around with these actions without requiring authentication. As a result, the submission is scored but will not become part of the consensus since we need an associated EyeWire account.


Assignment is accomplished by a POST request to `http://beta.eyewire.org/2.0/tasks/testassign`

You can trigger this using the command line tool curl:
```
$ curl --data '' http://beta.eyewire.org/2.0/tasks/testassign
```

`--data ''` forces it to be a POST request.

You will get back a JSON response.

```json
{
	"id": 563919,
	"seeds": [
		620
	],
	"cell_id": 143,
	"channel_id": 123949,
	"segmentation_id": 123950,
	"bounds": {
		"min": {
			"x": 1586,
			"y": 12818,
			"z": 2226
		},
		"max": {
			"x": 1842,
			"y": 13074,
			"z": 2482
		}
	}
}
```

`id` identifies the task.

`cell_id` indicates the cell that the task belongs to.

`channel_id` used to load the channel tiles

`segmentation_id` used to load the segmentation tiles and the segmentation 3d meshes

To see how tiles are loaded, look at `loadTilesForAxis` in common.js. To see how 3d meshes are loaded, look at `displayMeshForVolumeAndSegId`.



Submission is accomplished by a POST request to `http://beta.eyewire.org/2.0/tasks/TASK_ID/testsubmit`

Example curl request:
```
$ curl --data 'status=finished&segments=1407,1880,3898,4506,4722,5028,5075,5444,3614,3888,4072,1540' http://beta.eyewire.org/2.0/tasks/563914/testsubmit
```

Example response:
```json
{
	"score": 0,
	"accuracy": 0.43,
	"trailblazer": false,
	"special": null
}
```
