#Introduction to the EyeWire API

### What is the EyeWire API?

An API is a specification for communicating between separate computer programs. We created this API so that third parties such as yourselves could create their own EyeWire applications that contribute to mapping the brain. We hope to find new game mechanics that further engage players.

### Interacting with the EyeWire API

- Getting an assignment - We assign a small area of neuron to each player when they press the play button.

- Submitting a result - When a player has finished examining the small area, they submit their results so that we can form a consensus and so that they can get feedback.

### Receiving an assignment

EyeWire has to carefully assign tasks to each player to efficiently complete a neuron. The assignment interaction kicks off a game session and provides the client with the information needed to load the data required to play the task.

### Data

When assigned a task, several different data formats become available to help players figure out the ~~underlying~~ structure.

EyeWire has 2d and 3d data available. All of our data is constructed from electron microscope images. Our artificial intelligence analyzes the raw images to divide the tissue into smaller pieces called segments that clearly belong to the same neuron. Segments can range drastically in size.

We can access those segments via 2d segmentation images and 3d meshes. The 3d meshes are available in two formats, VAO (efficient memory wise), and Wavefront obj files (ubiquitous and supported by both Unity and Unreal game engines).

Raw image data, also known as channel images (.jpg)

PUT IMAGE HERE

Segmentation images (.png)

PUT SEGMENTATION IMAGE HERE

Segment meshes
- VAO (vertices and associated normals)
- Wavefront .obj (VAO encoded as text)

PUT MESH IMAGE HERE

### Selecting segments

A task has a list of segments known as the seed. Players are tasked with finding more segments that belong with the seed. Sometimes the correct answer is none.

Players fulfill an assignment by submitting a list of the segments that they believe are associated with the seed. A segment is identified by a numerical id.

In our implementation of EyeWire, players select segments by clicking on the raw 2d image. We match it with the corresponding segmentation image to determine the segment id (the segment id is encoded in the segmentation image as the color). We then load and display that segment in the 3d view. We allow players to deselect segments in both the 2d and 3d views.

### Submission and results

Once a player has finalized their list of segments, it needs to be sent to the EyeWire backend for analysis. The submission interaction returns a suggested score and accuracy given a list of segments.

### Where to go from here?

Check out the beginner docs, the sample apps, and the full api documentation.
