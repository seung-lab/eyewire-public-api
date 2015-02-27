THREE.Segment = function (interleavedData, material) {
  "use strict";

  var _this = this;
  var _interleavedData, _webglPositionNormalBuffer;

  THREE.Object3D.call(this);
  this.interleavedData = interleavedData;
  this.type = THREE.Segment;
  this.material = material;

  this.immediateRenderCallback = function (program, _gl, _frustum) {
    if (!_webglPositionNormalBuffer) {
      _webglPositionNormalBuffer = _gl.createBuffer();
    }
    _gl.disable(_gl.CULL_FACE);

    _gl.bindBuffer(_gl.ARRAY_BUFFER, _webglPositionNormalBuffer);
    _gl.bufferData(_gl.ARRAY_BUFFER, _this.interleavedData, _gl.STATIC_DRAW);

    // NB: Unintiuitive bug fix. Compiler was optimizing away
    // the normal attribute in certain builds of firefox and
    // seemingly randomly returning -1 for the normal attribute
    // location. Since we have constructed the Vertex Array Object (VAO)
    // we can explicitly tell the compiler to use it.
    //
    // VAO objects have a standard definition, that's an additional
    // reason why this is safe to do.
    //
    // - Will Silversmith, Aug. 2014

    // This was causing problems with our Princeton Ubuntu 14.04 installations.
    if (program.attributes.normal === -1) {
    	_gl.bindAttribLocation(program, 0, 'position');
    	_gl.bindAttribLocation(program, 1, 'normal');
    	program.attributes.position = 0;
    	program.attributes.normal = 1;
    }

    // _gl.enableVertexAttribArray(index);
    _gl.enableVertexAttribArray(program.attributes.position);
    _gl.enableVertexAttribArray(program.attributes.normal);

    // _gl.vertexAttribPointer(index, size, type, normalized, stride, pointer)
    _gl.vertexAttribPointer(program.attributes.position, 3, _gl.FLOAT, false, 24, 0);
    _gl.vertexAttribPointer(program.attributes.normal, 3, _gl.FLOAT, false, 24, 12);

    // _gl.drawArrays(mode, start, count)
    // 6 = dimensions per vertex: 3 for position, 3 for normal vector
    _gl.drawArrays(_gl.TRIANGLE_STRIP, 0, _this.interleavedData.length / 6);
  };
};

THREE.Segment.prototype = new THREE.Object3D();
THREE.Segment.prototype.constructor = THREE.Segment;
