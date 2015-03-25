#Introduction to the EyeWire API

### What is the EyeWire API?

An API is a agreed upon ~~syntax~~ ~~format~~ for communicating between separate programs.

### Interacting with the EyeWire API

- Getting assignment

- Submitting an ~~answer~~

### Receiving an assignment

EyeWire has to carefully assign tasks to each player to efficiently complete a task. The assignment interaction kicks off a game session and provides the client with the necessary information to load the required data to play the task.

### Data

When assigned a task, several different data formats become available to help players understand the underlying structure.

EyeWire has 2d and 3d data available. All of our data is built from images from an electron microscope. That raw data can be accessed. Our artificial intelligence analyzes the raw image to divide the tissue into smaller pieces called segments that clearly belong to the same neuron. Segments can range drastically in size.

We can access those segments via a 2d segmentation image and via 3d meshes. The 3d meshes are available in two formats, vao, efficient memory wise, and obj files, ubiquitous and supported by both Unity and Unreal game engines.

Raw image data (channel) (.jpg)
Segmentation images (segmentation) (.png)

Segment meshes
- vao
- wavefront .obj

### Selecting segments

Players fulfill an assignment by responding with a list of segments that they believe to be part of the neuron.

In our implementation of EyeWire, players select segments by clicking on the raw image. We match it up with the corresponding segmentation image to determine the segment id. We then load and display that segment in the 3d view. We allow players to deselect segments in both the 2d and 3d views.

### Submission and results

Once a player has finalized their list of segments, they need to be sent to the EyeWire backend for processing. The back end will return a suggested score and accuracy for the submission.


### Where now?

Checkout the beginner docs and the full api documentation.
