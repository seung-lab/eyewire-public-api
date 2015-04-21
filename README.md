#Eyewire Public API - WIP
This is a draft, the api is available to try at https://beta.eyewire.org

# Table of Contents
<!-- MarkdownTOC autolink=true bracket=round -->

- [Overview](#overview)
- [Defintions](#defintions)
- [EyeWire Structure & Terminology](#eyewire-structure--terminology)
  - [The Dataset](#the-dataset)
  - [Playing Eyewire (interacting with the dataset)](#playing-eyewire-interacting-with-the-dataset)
  - [Special things](#special-things)
- [Oauth2](#oauth2)
  - [Registering an application](#registering-an-application)
  - [Getting access tokens](#getting-access-tokens)
  - [GET oauth2/1.0/auth](#get-oauth210auth)
  - [POST oauth2/1.0/exchange](#post-oauth210exchange)
- [Tasks](#tasks)
  - [POST 2.0/tasks/assign](#post-20tasksassign)
  - [POST 2.0/tasks/:id/save](#post-20tasksidsave)
- [Data](#data)
- [Response Objects](#response-objects)
  - [Volume Object](#volume-object)
  - [Bounds Object](#bounds-object)

<!-- /MarkdownTOC -->


# Overview

[EyeWire](https://eyewire.org/) is a game to map the brain. Players from around the world collectively analyze the retina to determine the three dimensional structure of neurons. Players map neurons by solving 3D puzzles. They scroll through volumes of stacked microscope images and select 3D segments that extend a seed piece either to the other side of a cube or to a termination. Players decide which segment to add by "coloring inside the lines"  on a 2D cross section of the volume.

The EyeWire REST API provides programmatic access to interact with EyeWire's data. The key api interactions are [assigning tasks](#post-20tasksassign) and [submitting validations](#post-20tasksidsave). Assignments and submissions must have an associated user account and application id. That information is passed to the api as an Oauth2 access token query parameter.

# Definitions
- Oauth2 - [open standard for authorization](http://oauth.net/2/). We support only three-legged authentication. See [our Oauth2 implementation](#oauth2) for more details.
- access token - a string that identifies an EyeWire account and client application.

# EyeWire Structure & Terminology
## The Dataset
The EyeWire dataset comprises pairs of .jpg and .png images from which we can map a 3D volume. EyeWire calls the sets of .jpg images `channels` and the sets of .png images `segmentations`. The sets are grouped into `chunks`, which are then grouped into `volumes`.

- `channel`
    - a set of 8bpp greyscale .jpg files
    - the electron microscope images
- `segmentation`
    - a set of 24bpp RGB .png files for normal `tasks`
    - used to describe which pixels belong to which `segment` ID
    - The RGB color represents the `segment` ID: R + 256*G + 256^2 * B
- `voxel`
    - The highest precision of the dataset. Can be considered a 1x1x1 pixel cube.
- `volume`
    - a 256^3 voxel cube
    - each `volume` overlaps its adjacent `volumes` by 32 voxels
    - a `volume` is comprised of 2x2x2 voxel `chunks`
- `chunk`
    - a 128^3 voxel cube
    - a set of 2D images inside a `volume`
    - there are 8 `chunks` in each `volume`
    - each `chunk` contains two sets of data: `channel` images and `segmentation` images
    - a chunk contains 128 images for each of the three axis 'xy', 'yz', 'xz'

## Playing EyeWire (interacting with the dataset)
When a user plays EyeWire they see the `channel` images and a 3D representation of a part of the current `cell` they are attempting to map. This part is located inside a specific `volume` and `chunk` (think of it like an address). The starting point of the part the user is mapping is called a `seed`. There may be multiple `seeds` when a user begins mapping.

Providing the user with `seeds` for a `cell` is called assigning the player a `task`. As the user maps, they select `segments` they believe are attached to the `seeds`. When the user is done mapping the `task`, the `segments` the user selected are added to the task and create  a `validation`.

- `task`
    - a `volume` with `seeds`
    - associated with a `cell`
- `cell`
    - a neuron
    - a tree structure consisting of several `tasks`
    - the root `task` is usually part of the cell body
- `seeds`
    - the pre-highlighted `segments` visible when a player begins a task
    - players select `segments` to group them with the `seeds`
- `segment`:
    - a group of connected voxels that the EyeWire AI determined as belonging to a single branch of a cell
    - each `segment` has a unique identifier for its containing `volume`
- `validation`
    - a `task` with a list of additional `segments`
    - for example, a user starts playing EyeWire and receives a `task`. The user then highlights `segments` s/he believes are part of the `cell` that the initial `seeds` are part of. The resulting `task` is returned as a `validation`
- `consensus`
    - the current set of `segments` that are believed to belong to a `task` based on user submitted `validations`

## Special things
- `subspace`
    - used for gathering cell overview meshes, which uses different subdivision
    - the size of a `subspace` depends on the user-specified MIP-level: 2 * 128^mip
    - Other than `volumes` they don't overlap

# Oauth2

We use Oauth2 to allow EyeWire player's to share access to their account with your applications. To get an Oauth2 access token you must register an application.

## Registering an application
An application requires a name and a redirection endpoint which is a url where you will receive auth codes and exchange them for access tokens.

1. Register an EyeWire account at beta.eyewire.org
2. Login to the API via https://beta.eyewire.org/2.0/account/login?username=EDITUSERNAME&password=EDITPASS using the credentials of your EyeWire account.
3. Visit https://beta.eyewire.org/oauth2/1.0/clients and click 'Create new client'
4. Enter an app name and a redirect uri and click save.
5. You will be redirected to the client details screen containing the client id and secret along with the abilities to edit and delete the client.

## Getting access tokens
To get an access token for a user, redirect them to [oauth2/1.0/auth](#get-oauth210auth) endpoint as detailed below.

After the user logs in and accepts your request, the user will be redirected to the redirection endpoint along with an auth code. You then use the [oauth2/1.0/exchange](#get-oauth210exchange) endpoint to receive an access token.


## GET oauth2/1.0/auth

Redirect the end user to this authentication request url to kick off the process of receiving an access token.

### Request
| Name         | Description                                            |
|:-------------|:-------------------------------------------------------|
| response_type| always 'code' |
| redirect_uri | client redirect_uri                                    |
| client_id    | client id                                              |

### Response:
User will be redirected to the endpoint specified by the redirect_uri with the auth code in the query parameter.

### Error Responses:
In the 'error' query parameter.
- access_denied - if the user denies giving your app permission.


### Example Request
https://beta.eyewire.org/oauth2/1.0/auth?response_type=code&redirect_uri=http://website.com&client_id=141

### Example Response
http://website.com/?code=f9u12m12e9we

### Example Access Denied Response
http://website.com/?error=access_denied


## POST oauth2/1.0/exchange

Returns an access code given an auth code. One time use, the auth code is invalidated.

### Request
| Name         | Description                                            |
|:-------------|:-------------------------------------------------------|
| auth_code    | auth code returned by the end user to the redirect_uri |
| secret       | client secret                                          |
| redirect_uri | client redirect_uri                                    |
| client_id    | client id                                              |
| grant_type | always 'authorization_code'

### Response 200
| Name         | Description                           |
|:-------------|:--------------------------------------|
| access_token | token used to access parts of the api |
| token_type   | the string "bearer" in accordance with the Oauth2 spec        |

### Error Responses
- 400 - invalid_client, the client application information is invalid
- 400 - invalid_grant, the auth code is invalid, possibly already used.
- 400 - unsupported_grant_type, the grant_type is not authorization_code

### Example Request

```
$ curl --data 'auth_code=f9u12m12e9we&secret=1234&redirect_uri=http://website.com&client_id=1&grant_type=authorization_code' https://beta.eyewire.org/oauth2/1.0/exchange
```

### Example Response

```json
{
  "access_token": "78q3ja8y",
  "token_type": "bearer"
}
```

# Tasks

The task API is the one you'll be interacting with the most. It's used to assign tasks and submit player evaluations of them called validations. Each task consists of a set of image data and a seed piece. Each validation consists of the seed piece plus any segments the player selects. We aggregate submitted validations to form a consensus opinion of the actual structure of the cell.

## POST 2.0/tasks/assign

Assigns a task to a user. You may optionally request that the task belongs to a specific cell.


### Request
| Name         | Description                                                          |
|:-------------|:---------------------------------------------------------------------|
| access_token | token that allows calling the api as a specific user                                                                  |
| cell_id (optional) | the returned task will belong to the specified cell. |

### Response 200

The response contains volume objects that contain ids and bounds which are used to access [tile and mesh data](#data).

| Name            | Description                         |
|:----------------|:------------------------------------|
| id              | task id                             |
| seeds           | array of segment ids known to be part of the cell.               |
| cell_id` | the ID of the cell that the task belongs to |
| channel_id      | `channel` id      |
| segmentation_id | `segmentation` id |

### Error Responses
- 404 - no tasks available that fulfill the request, try with a different cell_id or lack of one.

### Example Request

```
$ curl --data 'cell_id=450' https://beta.eyewire.org/2.0/tasks/assign?access_token=78q3ja8y
```

### Example Response

```json
{
  "id": 17444,
  "seeds": [245, 5025, 6500],
  "cell": 10,
  "channel_id": 63200,
  "segmentation_id": 63201,
  "bounds": {
    "min": {
      "x": 2930,
      "y": 4082,
      "z": 6482
    },
    "max": {
      "x": 3186,
      "y": 4338,
      "z": 6738
    }
  }
}
```

## POST 2.0/tasks/:id/submit

Submit a validation for a task. The validation is used to calculate a consensus of the segments that belong to the task. The validation will be analyzed for accuracy and given a suggested score.

### Request
| Name            | Description                           |
|:----------------|:--------------------------------------|
| id | task id
| access_token    | ...                                   |
| status          | one of finished, aborted, or training |
| segments        | comma separated list of segment ids   |
| reap (optional) | is this task submission a reap?       |

### Response 200
| Name        | Description                                                         |
|:------------|:--------------------------------------------------------------------|
| score       | suggested score                                                     |
| accuracy    | estimated accuracy                                                  |
| trailblazer | was the submission one of the first validations for a task |
| special     | 'scythe', 'reaped', null                                                |

### Error Responses

### Example request
```
$ curl --data 'status=finished&segments=1407,1880,3898,4506,4722,5028,5075,5444,3614,3888,4072,1540' https://beta.eyewire.org/2.0/tasks/563914/submit?access_token=d14fa82ab
```

### Example Response

```json
{
  "score": 60,
  "accuracy": 0.5983492834,
  "trailblazer": false,
  "special": null
}
```

# Data

#### GET data.eyewire.org/volume/$volumeID/chunk/0/$x/$y/$z/tile/$slicing/$from:$to

This method allows users to retrieve a set of 128x128 sized images (tiles) of the specified chunk in the specified volume.

### Request
| Name            | Description                           |
|:----------------|:--------------------------------------|
| volumeID | volume id |
|x, y, z | chunk coordinates |
| from:to | the response includes tiles starting at the **from** layer up to but not including the **to** layer |

### Response 200
An array of

| Name | Description |
|:----------------|:--------------------------------------|
| data | a base64 encoded jpeg for channel volumes or base 64 encoded png for segmentation volumes |
| view | id correlating to a plane, 1: XY plane, 2: XZ plane, 3: ZY plane |
| bounds | [bounds object](#bounds-object) |

### Example Request
http://data.eyewire.org/volume/63200/chunk/0/0/0/0/tile/xy/10:30

### Example Response
```json
[
  {
    "data": "data:image/jpeg;base64,/9j/4A...",
    "view": 1,
    "bounds": {
      "min": {
        "x": 2930,
        "y": 4082,
        "z": 6482
      },
      "max": {
        "x": 3186,
        "y": 4338,
        "z": 6738
      }
    }
  },
  ...
]
```
**Notes**:
- The returned Base64 strings contain line breaks (see [RFC 2045][RFC2045]). If your decoder has problems with those, you might want to strip them before decoding.

#### GET data.eyewire.org/volume/$volumeID/chunk/0/$x/$y/$z/mesh/$segmentID

This method allows users to retrieve the 3D model of a specified segment in the specified EyeWire chunk.

### Request
| Name            | Description                           |
|:----------------|:--------------------------------------|
| volId | volume id |
|x, y, z | chunk coordinates  |
| segmentID | segment id |

### Response

Sends back a pure binary representation of a degenerated triangle strip containing interleaved vertex positions and vertex normals.
_Degenerated_ triangle strip because some triangles collapse to lines on purpose, since it is impossible to describe some meshs with only one triangle strip.

If the mesh does not exist, the response is just empty.

### Example Request
http://data.eyewire.org/volume/17096/chunk/0/1/1/0/mesh/2060

### Example Response
```
0x0000: v1 vn1
0x0018: v2 vn2
0x0030: v3 vn3	# first triangle (1, 2, 3) complete
0x0048: v4 vn4	# second triangle (2, 3, 4) complete
0x0060: v5 vn5  # third triangle (3, 4, 5) complete
.
.
.
```
* All values are Little Endian, 4 Byte `floats`.
* v1 is the first vertex coordinate.
* vn1 is the first vertex normal.
* A vertex consists of three `floats` representing its X,Y,Z coordinates, in the given order.
* Vertex Coordinates are within the range [0 .. 1]
* Vertex Normals are normalized.

* **TIP**: There were reported cases of corrupt meshes, appearing to be invisible. You can identify them by looking for meshes where *all* vertex coordinates have values [0 .. 0.001].


# Response Objects

## Bounds Object

Contains a min and a max three dimensional coordinate. Represents a three dimensional block of space.

### Example
```json
"min": {
  "x": 2930,
  "y": 4082,
  "z": 6482
},
"max": {
  "x": 3186,
  "y": 4338,
  "z": 6738
}
```




[RFC2045]:http://tools.ietf.org/html/rfc2045#page-25
