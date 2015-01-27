#Eyewire Public API - WIP
- This is a draft, the api is available to try at https://beta.eyewire.org


#Overview

[EyeWire](https://eyewire.org/) is a game to map the brain. Players from around the world collectively analyze the retina to determine the three dimensional structure of neurons. Players map neurons by solving 3D puzzles. They scroll through volumes of stacked microscope images and select 3D segments that extend a seed piece either to the other side of a cube or to a termination. Players decide which segment to add by "coloring inside the lines"  on a 2D cross section of the volume.

The EyeWire REST API provides programmatic access to interact with EyeWire's data. The key api interactions are [assigning tasks](#post-20tasksassign) and [submitting validations](#post-20tasksidsave). Assignments and submissions must have an associated user account and application id. That information is passed to the api as an Oauth2 access token query parameter.

#Defintions
- Oauth2 - [open standard for authorization](http://oauth.net/2/). We support only three-legged authentication. See [our Oauth2 implementation](#oauth2) for more details.
- access token - a string that identifies an EyeWire account and client application.

###EyeWire
- cell: a neuron, tree structure consisting of several *tasks*, the root task is in most cases a part of the cell body
- task: a *volume* with *seeds*; associated with a cell
- volume: the EyeWire dataset consists of 256^3 voxel large cubes, overlapping each other by 32 voxels. The volumes are further divided into 128^3 large *chunks*, hence an EyeWire volume has 8 chunks. However, each volume actually has two volume IDs - one for the channel images, one for the segmentation images
- seeds: initial *segments* players are supposed to follow and add additional segments that match.
- segment: region of similar looking, connected voxels, each segment has a unique identifier for its containing volume.
- chunk: contains layers of 2D images:
- channel: 8bpp greyscale .jpg files containing the electron microscope images.
- segmentation: .png files, used to describe which pixels belong to which segment ID. (The RGBA color represents the segment ID: R + 256*G + 256^2 * B + 256^3 * A)
- validation: a *task* with a list of additional *segments*, for example submitted by a single user.
- consensus: a special *validation*, subset of the union of all validations for a single *task*.
- subspace: used for gathering cell overview meshes, which has a different subdivision. Size of those subspaces depends on the user-specified MIP-level: 2 * 128^mip; Other than _volumes_ they don't overlap.

#Oauth2

We use Oauth2 to allow EyeWire player's to share access to their account with your applications.To get an Oauth2 access token you must register an application.

##Registering an application
An application requires a name and a redirection endpoint which is a url where you will receive auth codes and exchange them for access tokens.

1. Login or register at beta.eyewire.org
2. Visit https://beta.eyewire.org/oauth2/1.0/clients and click 'Create new client'
3. Enter an app name and a redirect uri and click save.
4. You will be redirected to the client details screen containing the client id and secret along with the abilities to edit and delete the client.

##Getting access tokens
To get an access token for a user, redirect them to [oauth2/1.0/auth](#get-oauth210auth) endpoint as detailed below.

After the user logs in and accepts your request, the user will be redirected to the redirection endpoint along with an auth code. You then use the [oauth2/1.0/exchange](#get-oauth210exchange) endpoint to receive an access token.


##GET oauth2/1.0/auth

Redirect the end user to this authentication request url to kick off the process of receiving an access token.

###Request
| Name         | Description                                            |
|:-------------|:-------------------------------------------------------|
| response_type| always 'code' |
| redirect_uri | client redirect_uri                                    |
| client_id    | client id                                              |

###Response:
User will be redirected to the endpoint specified by the redirect_uri with the auth code in the query parameter.

###Error Responses:
In the 'error' query parameter.
- access_denied - if the user denies giving your app permission.


###Example Request
http://beta.eyewire.org/oauth2/1.0/auth?response_type=code&redirect_uri=http://website.com&client_id=141

###Example Response
http://website.com/?code=f9u12m12e9we

###Example Access Denied Response
http://website.com/?error=access_denied


##POST oauth2/1.0/exchange

Returns an access code given an auth code. One time use, the auth code is invalidated.

###Request
| Name         | Description                                            |
|:-------------|:-------------------------------------------------------|
| auth_code    | auth code returned by the end user to the redirect_uri |
| secret       | client secret                                          |
| redirect_uri | client redirect_uri                                    |
| client_id    | client id                                              |
| grant_type | always 'authorization_code'

###Response 200
| Name         | Description                           |
|:-------------|:--------------------------------------|
| access_token | token used to access parts of the api |
| token_type   | the string "bearer" in accordance with the Oauth2 spec        |

###Error Responses
- 400 - invalid_client, the client application information is invalid
- 400 - invalid_grant, the auth code is invalid, possibly already used.
- 400 - unsupported_grant_type, the grant_type is not authorization_code

###Example Request

http://beta.eyewire.org/oauth2/1.0/exchange?auth_code=f9u12m12e9we&redirect_uri=http://website.com&client_id=141&secret=1234&grant_type=authorization_code

###Example Response

```json
{
  "access_token": "78q3ja8y",
  "token_type": "bearer"
}
```

#Tasks

The task API is the one you'll be interacting with the most. It's used to assign tasks and submit player evaluations of them called validations. Each task consists of a set of image data and a seed piece. Each validation consists of the seed piece plus any segments the player selects. We aggregate submitted validations to form a consensus opinion of the actual structure of the cell.

##POST 2.0/tasks/assign

Assigns a task to a user. You may optionally request that the task belongs to a specific cell.


###Request
| Name         | Description                                                          |
|:-------------|:---------------------------------------------------------------------|
| access_token | token that allows calling the api as a specific user                                                                  |
| cell_id (optional) | the returned task will belong to the specified cell. |

###Response 200

The response contains volume objects that contain ids and bounds which are used to access [tile and mesh data](#data).

| Name            | Description                         |
|:----------------|:------------------------------------|
| id              | task id                             |
| seeds           | array of segment ids known to be part of the cell.               |
| cell | the cell that the task belongs to |
| channel      | channel [volume object](#volume-object)      |
| segmentation | segmentation [volume object](#volume-object) |

###Error Responses
- 404 - no tasks available that fulfill the request, try with a different cell_id or lack of one.

###Example Request

http://beta.eyewire.org/2.0/tasks/assign?access_token=78q3ja8y

###Example Response

```json
{
  "id": 17444,
  "seeds": [245, 5025, 6500],
  "cell": 10,
  "channel": {
    "id": 63200,
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
  "segmentation":{
    "id": 63201,
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
}
```

##POST 2.0/tasks/:id/save

Submit a validation for a task. The validation is used to calculate a consensus of the segments that belong to the task. The validation will be analyzed for accuracy and given a suggested score.

###Request
| Name            | Description                           |
|:----------------|:--------------------------------------|
| id | task id
| access_token    | ...                                   |
| status          | one of finished, aborted, or training |
| segments        | comma separated list of segment ids   |
| reap (optional) | is this task submission a reap?       |

###Response 200
| Name        | Description                                                         |
|:------------|:--------------------------------------------------------------------|
| score       | suggested score                                                     |
| accuracy    | estimated accuracy                                                  |
| trailblazer | was the submission one of the first validations for a task |
| special     | 'scythe', 'reaped', null                                                |

###Error Responses
None, is this correct?

###Example Request
http://beta.eyewire.org/2.0/tasks/530321/save?access_token=d14fa82ab88beb6e36fb9f88fa95fed4402a5779&status=finished&segments=170,224,306,296

###Example Response

```json
{
  "score": 60,
  "accuracy": 0.5983492834,
  "trailblazer": false,
  "special": null
}
```

#Data

####GET data.eyewire.org/volume/$volumeID/chunk/0/$x/$y/$z/tile/$slicing/$from:$to

This method allows users to retrieve a set of 128x128 sized images (tiles) of the specified chunk in the specified volume.

###Request
| Name            | Description                           |
|:----------------|:--------------------------------------|
| volumeID | volume id |
|x, y, z | chunk coordinates |
| from:to | the response includes tiles starting at the **from** layer up to but not including the **to** layer |

###Response 200
An array of

| Name | Description |
|:----------------|:--------------------------------------|
| data | a base64 encoded jpeg for channel volumes or base 64 encoded png for segmentation volumes |
| view | id correlating to a plane, 1: XY plane, 2: XZ plane, 3: ZY plane |
| bounds | [bounds object](#bounds-object), same bounds as the volume. |

###Example Request
http://data.eyewire.org/volume/63200/chunk/0/0/0/0/tile/xy/10:30

###Example Response
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

####GET data.eyewire.org/volume/$volumeID/chunk/0/$x/$y/$z/mesh/$segmentID

This method allows users to retrieve the 3D model of a specified segment in the specified EyeWire chunk.

###Request
| Name            | Description                           |
|:----------------|:--------------------------------------|
| volId | volume id |
|x, y, z | chunk coordinates  |
| segmentID | segment id |

###Response

Sends back a pure binary representation of a degenerated triangle strip containing interleaved vertex positions and vertex normals.
_Degenerated_ triangle strip because some triangles collapse to lines on purpose, since it is impossible to describe some meshs with only one triangle strip.

If the mesh does not exist, the response is just empty.

###Example Request
http://data.eyewire.org/volume/17096/chunk/0/1/1/0/mesh/2060

###Example Response
```
0x0000: v1 vn1
0x0008: v2 vn2
0x0010: v3 vn3	# first triangle (1, 2, 3) complete
0x0018: v4 vn4	# second triangle (2, 3, 4) complete
0x0020: v5 vn5  # third triangle (3, 4, 5) complete
.
.
.
```

* All values are Little Endian, 4 Byte `floats`.
* v1 is the first vertex coordinate.
* vn1 is the first vertex normal.
* Vertex Coordinates are within the range [0 .. 1]
* Vertex Normals are normalized.

* **TIP**: There were reported cases of corrupt meshes, appearing to be invisible. You can identify them by looking for meshes where *all* vertex coordinates have values [0 .. 0.001].


#Response Objects

##Volume Object
Contains an volume id and a [bounds object](#bounds-object). The bounds represents the area of space that the volume occupies.

###Example
```json
"id": 63200,
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
```

##Bounds Object

Contains a min and a max three dimensional coordinate. Represents a three dimensional block of space.

###Example
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
