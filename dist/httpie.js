const { request } = require('https');
const { globalAgent } = require('http');
const { parse, resolve } = require('url');

function toError(rej, res, err) {
	err = err || new Error(res.statusMessage);
	err.statusMessage = res.statusMessage;
	err.statusCode = res.statusCode;
	err.headers = res.headers;
	err.data = res.data;
	rej(err);
}

function send(method, uri, opts={}) {
	return new Promise((res, rej) => {
		let out = '';
		opts.method = method;
		let { redirect=true } = opts;
		if (uri && !!uri.toJSON) uri = uri.toJSON();
		Object.assign(opts, typeof uri === 'string' ? parse(uri) : uri);
		opts.agent = opts.protocol === 'http:' ? globalAgent : void 0;

		let req = request(opts, r => {
			r.setEncoding('utf8');

			r.on('data', d => {
				out += d;
			});

			r.on('end', () => {
				let type = r.headers['content-type'];
				if (type && out && type.includes('application/json')) {
					try {
						out = JSON.parse(out, opts.reviver);
					} catch (err) {
						return toError(rej, r, err);
					}
				}
				r.data = out;
				if (r.statusCode >= 400) {
					toError(rej, r);
				} else if (r.statusCode > 300 && redirect && r.headers.location) {
					opts.path = resolve(opts.path, r.headers.location);
					return send(method, opts.path.startsWith('/') ? opts : opts.path, opts).then(res, rej);
				} else {
					res(r);
				}
			});
		});

		req.on('timeout', req.abort);
		req.on('error', err => {
			// Node 11.x ~> boolean, else timestamp
			err.timeout = req.aborted;
			rej(err);
		});

		if (opts.body) {
			let isObj = typeof opts.body === 'object' && !Buffer.isBuffer(opts.body);
			let str = isObj ? JSON.stringify(opts.body) : opts.body;
			isObj && req.setHeader('content-type', 'application/json');
			req.setHeader('content-length', Buffer.byteLength(str));
			req.write(str);
		}

		req.end();
	});
}

const get = send.bind(send, 'GET');
const post = send.bind(send, 'POST');
const patch = send.bind(send, 'PATCH');
const del = send.bind(send, 'DELETE');
const put = send.bind(send, 'PUT');

exports.del = del;
exports.get = get;
exports.patch = patch;
exports.post = post;
exports.put = put;
exports.send = send;