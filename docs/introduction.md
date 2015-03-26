#Introduction to the EyeWire API

### What is the EyeWire API?

The EyeWire API is a set of URLs that you can use to gain access to our data and build a game based on our engine. Specificially, it's a set of URLs that respond to GET and POST requests from an HTTP capable client. We created this API in the hope that others might invent new game mechanics that further engage players, and thus increase the rate at which we do science.

### What can you do with it? Specifically.

If you're familiar with eyewire.org, we make available the following operations:

- Get a Task: Get assigned a small area of the images that contains a neuron we want to trace.

- Submit an Evaluation: When a player has finished examining the small area, they can submit their evaluation. We combine multiple evaluations into a consensus neuron piece. We'll also provide feedback based primarily on how that player compared to others. We call these evaluations "validations".

### Receiving an assignment

EyeWire has to carefully assign tasks to each player to efficiently complete a neuron. The assignment interaction kicks off a game session and provides the client with the information needed to load the data required to play the task.

### Data

For an assigned task, several different data formats are available to help players figure out the ~~underlying~~ structure.

EyeWire uses both 2d and 3d data. All of our data is constructed from electron microscope images. Our artificial intelligence analyzes the raw images to divide the tissue into smaller pieces called segments that clearly belong to the same neuron. Segments can range drastically in size.

We can view these segments via 2d segmentation images and 3d meshes. The 3d meshes are available in two formats, VAO (efficient memory wise), and Wavefront obj files (ubiquitous and supported by both Unity and Unreal game engines).

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

Once a player has finalized their list of segments, they can submit the list to the EyeWire backend for analysis. The submission interaction returns an accuracy and suggested score and  given a list of segments.

### Where to go from here?

Check out the beginner docs, the sample apps, and the full api documentation.
