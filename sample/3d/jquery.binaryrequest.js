/* jquery.binaryrequest.js
 *
 * Plugin to restore familiar jQuery AJAX idioms to binary 
 * data requests.
 * 
 * e.g. 
 * var url = 'http://data.eyewire.org/cell/1091/chunk/5/1/1/1/mesh';
 * $.binaryGet(url, { optional get parameters }, function (data, error) {
 *    // code goes here	
 * });
 *
 * This is the same as setting the XMLHttpRequest.responseType = 'arraybuffer'
 * and getting the browser appropriate response property (usually this.response).
 * 
 * Binary response data is passed into data, error events are passed into error.
 * You will still need to wrap the binary data in an appropriate data structure
 * such as "data = new Float32Array(data);" The particular type will of course
 * depend on your application.
 *
 * Dependencies: jQuery 1.5+
 *
 * Author: William Silversmith
 * Affiliation: Seung Lab, Brain and Cognitive Sciences Dept., MIT
 * Date: December 2013 
 */

;(function ($, undefined) {

	/* binaryRequest
	 *
	 * The most general version, accepts a method parameter 
	 * in addition to the others.
	 *
	 * Required:
	 *    [0] method: "GET" or "POST"
	 *    [1] url: The url to send the AJAX request to (it should be free
	 *          of get parameters if you use opts)
	 *
	 * Optional:
	 *    [2] opts: { key1: val1, key2: val2 } converts to method appropriate format
	 *    [3] callback: function taking (data, error)
	 *         data is the raw binary contents of the XMLHttpRequest response and must be
	 *         wrapped in an appropriate data type like "new Float32Array(data)"
	 * 
	 * Returns: this
	 */
	$.binaryRequest = function (method, url, opts, callback) {
		method = method || "";
		method = method.toUpperCase();

		if (method === 'GET') {
			return this.binaryGet(url, opts, callback);
		}
		else if (method === 'POST') {
			return this.binaryPost(url, opts, callback);
		}
		else {
			throw "Unsupported method " + method;
		}

		return this;
	};

	/* binaryGet
	 *
	 * Perform an asyncronous GET request for binary data. 
	 *
	 * Required:
	 *   [1] url: The url to send the AJAX request to (it should be free
	 *         of get parameters if you use opts)
	 *
	 * Optional:
	 *   [2] opts: { key1: val1, key2: val2 } converts to ?key1=val1&key2=val2
	 *   [3] callback: function taking (data, error)
	 *        data is the raw binary contents of the XMLHttpRequest response and must be
	 *        wrapped in an appropriate data type like "new Float32Array(data)" 
	 *  
	 * Returns: this
	 */
	$.binaryGet = function (url, opts, callback) {
		var xhr = new XMLHttpRequest();

		if (opts && typeof opts === 'object') {
			url = url.replace(/[\?\/] *$/, '');
			url += '?' + $.param(opts);
		}
		else if (typeof opts === 'function') {
			callback = opts;
		}

		xhr.open('GET', url, true); // true = async
		xhr.responseType = 'arraybuffer'; //response type must be set _after_ opening the request (esp firefox)
		
		xhr.onload = function () {
			var binaryresponse = this.mozResponseArrayBuffer || this.response;
			callback(binaryresponse, null);
		};

		xhr.onerror = function (error) {
			var binaryresponse = this.mozResponseArrayBuffer || this.response;
			callback(binaryresponse, error);
		};

		xhr.send();

		return xhr;
	};

	/* binaryPost
	 *
	 * Perform an asyncronous POST request for binary data. 
	 *
	 * Required:
	 *   [1] url: The url to send the AJAX request to (it should be free
	 *         of get parameters if you use opts)
	 *
	 * Optional:
	 *   [2] opts: { key1: val1, key2: val2 } converts to ?key1=val1&key2=val2
	 *   [3] callback: function taking (data, error)
	 *        data is the raw binary contents of the XMLHttpRequest response and must be
	 *        wrapped in an appropriate data type like "new Float32Array(data)" 
	 *  
	 * Returns: this
	 */
	$.binaryPost = function (url, opts, callback) {
		var xhr = new XMLHttpRequest();
		
		if (typeof opts === 'function') {
			callback = opts;
		}

		xhr.open('POST', url, true); // true = async
		xhr.responseType = 'arraybuffer'; // must occur after opening connection or Firefox crashes

		xhr.onload = function () {
			var binaryresponse = this.mozResponseArrayBuffer || this.response;
			callback(binaryresponse, null);
		};

		xhr.onerror = function (error) {
			var binaryresponse = this.mozResponseArrayBuffer || this.response;
			callback(binaryresponse, error);
		};

		xhr.setRequestHeader("Connection", "close");

		if (opts && typeof opts === 'object') {
			var params = $.param(opts);
			xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
			xhr.setRequestHeader("Content-length", params.length);
			xhr.send(params);
		}
		else {
			xhr.send();
		}

		return this;
	};

})(jQuery);